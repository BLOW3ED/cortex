#!/usr/bin/env python3
"""Verifica el contenido de Cortex.

Uso:
    python scripts/verify_content.py                 # todo content/
    python scripts/verify_content.py content/calculo # una materia o unidad

Comprueba estructura (ids, campos, referencias, grafo de conceptos) y
CORRECTITUD de las respuestas (sympy / ejecución de código).
Sale con código 1 si hay errores. Las advertencias no fallan el script.

Nota de seguridad: ejecuta código y evalúa expresiones escritas por nosotros
(contenido de confianza del propio repo). No lo uses con contenido de terceros.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import sympy as sp
import yaml

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
PLAN = ROOT / "curriculum" / "plan-2020.json"

TIPOS = {
    "opcion_multiple", "numerico", "simbolico", "completar", "ordenar",
    "codigo", "predecir_salida", "autoevaluacion",
    "depurar", "parsons", "rastreo_memoria",
}
# printf con salida determinista (sin %p). Igual que TRACE_FORMAT_RE de la app.
TRACE_FORMAT_RE = re.compile(r"^%(?:\.\d+)?(?:d|i|u|c|s|f|g|x|ld|lu|lf|zu)$")
ID_RE = re.compile(r"^[a-z]+-\d{2}-\d{3}$")
KEBAB_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
PY_TIMEOUT = 10
C_TIMEOUT = 10

errors: list[str] = []
warnings: list[str] = []
stats = {"unidades": 0, "ejercicios": 0, "verificados": 0, "manuales": 0, "c_omitidos": 0}


def err(where: str, msg: str) -> None:
    errors.append(f"ERROR   {where}: {msg}")


def warn(where: str, msg: str) -> None:
    warnings.append(f"AVISO   {where}: {msg}")


# ---------------------------------------------------------------- sympy
_SYMS = sp.symbols("x y z t n k")
_NS = {name: getattr(sp, name) for name in dir(sp) if not name.startswith("_")}
_NS.update({s.name: s for s in _SYMS})
_NS["pi"] = sp.pi
_NS["E"] = sp.E


def eval_sympy(expr: str):
    return eval(expr, {"__builtins__": {}}, _NS)  # noqa: S307 (contenido de confianza)


def eval_python(expr: str):
    import math, statistics, fractions  # noqa: E401
    env = {"math": math, "statistics": statistics, "Fraction": fractions.Fraction,
           "sum": sum, "min": min, "max": max, "len": len, "range": range,
           "round": round, "abs": abs, "sorted": sorted, "pow": pow}
    return eval(expr, {"__builtins__": {}}, env)  # noqa: S307


def to_float(v) -> float:
    return float(sp.N(sp.sympify(v)))


def close(a, b, tol: float) -> bool:
    return abs(a - b) <= max(tol, 1e-9 * max(1.0, abs(b)))


def parse_expr(s: str):
    from sympy.parsing.sympy_parser import (
        convert_xor, implicit_multiplication_application, parse_expr as pe,
        standard_transformations,
    )
    tr = standard_transformations + (implicit_multiplication_application, convert_xor)
    return pe(str(s), transformations=tr, local_dict={s_.name: s_ for s_ in _SYMS})


# ---------------------------------------------------------------- ejecución
def run_python_tests(code: str, tests: list[dict]) -> tuple[bool, str]:
    exprs = [t["expr"] for t in tests]
    harness = (
        "import json\n"
        f"{code}\n"
        "_r = []\n"
        f"for _e in {exprs!r}:\n"
        "    _r.append(eval(_e))\n"
        "print(json.dumps(_r, default=repr))\n"
    )
    try:
        # En una carpeta temporal: si el código crea archivos, no ensucia el repo.
        with tempfile.TemporaryDirectory() as d:
            p = subprocess.run([sys.executable, "-c", harness], capture_output=True,
                               text=True, timeout=PY_TIMEOUT, cwd=d)
    except subprocess.TimeoutExpired:
        return False, "timeout"
    if p.returncode != 0:
        return False, (p.stderr.strip().splitlines() or ["error de ejecución"])[-1]
    try:
        got = json.loads(p.stdout.strip().splitlines()[-1])
    except Exception:  # noqa: BLE001
        return False, f"salida no interpretable: {p.stdout[:80]!r}"
    for t, g in zip(tests, got):
        exp, tol = t.get("esperado"), float(t.get("tolerancia", 0))
        if isinstance(exp, (int, float)) and isinstance(g, (int, float)) and not isinstance(exp, bool):
            if not close(float(g), float(exp), tol):
                return False, f"{t['expr']} -> {g!r}, esperado {exp!r}"
        elif g != exp:
            return False, f"{t['expr']} -> {g!r}, esperado {exp!r}"
    return True, "ok"


def run_python_output(code: str) -> tuple[bool, str]:
    try:
        with tempfile.TemporaryDirectory() as d:
            p = subprocess.run([sys.executable, "-c", code], capture_output=True,
                               text=True, timeout=PY_TIMEOUT, cwd=d)
    except subprocess.TimeoutExpired:
        return False, "timeout"
    if p.returncode != 0:
        return False, (p.stderr.strip().splitlines() or ["error"])[-1]
    return True, p.stdout


def run_c_tests(code: str, tests: list[dict]) -> tuple[bool, str]:
    with tempfile.TemporaryDirectory() as d:
        src, exe = Path(d) / "main.c", Path(d) / "main"
        src.write_text(code)
        c = subprocess.run(["gcc", "-Wall", "-O0", "-o", str(exe), str(src), "-lm"],
                           capture_output=True, text=True, timeout=C_TIMEOUT)
        if c.returncode != 0:
            return False, "no compila: " + c.stderr.strip().splitlines()[0]
        for t in tests:
            try:
                p = subprocess.run([str(exe)], input=t.get("entrada", ""),
                                   capture_output=True, text=True, timeout=C_TIMEOUT, cwd=d)
            except subprocess.TimeoutExpired:
                return False, "timeout"
            if p.stdout.rstrip() != str(t["salida"]).rstrip():
                return False, f"entrada {t.get('entrada','')!r} -> {p.stdout!r}, esperado {t['salida']!r}"
    return True, "ok"


def run_c_output(code: str, entrada: str = "") -> tuple[bool, str]:
    """Compila y corre un programa en C; devuelve su salida."""
    with tempfile.TemporaryDirectory() as d:
        src, exe = Path(d) / "main.c", Path(d) / "main"
        src.write_text(code)
        c = subprocess.run(["gcc", "-Wall", "-O0", "-o", str(exe), str(src), "-lm"],
                           capture_output=True, text=True, timeout=C_TIMEOUT)
        if c.returncode != 0:
            return False, "no compila: " + (c.stderr.strip().splitlines() or ["?"])[0]
        try:
            p = subprocess.run([str(exe)], input=entrada, capture_output=True, text=True,
                               timeout=C_TIMEOUT, cwd=d)
        except subprocess.TimeoutExpired:
            return False, "timeout"
        return True, p.stdout


def run_tests(lenguaje: str, code: str, tests: list[dict]) -> tuple[bool, str] | None:
    """Corre tests de Python o de C. `None` si es C y no hay gcc."""
    if lenguaje == "python":
        return run_python_tests(code, tests)
    if lenguaje == "c":
        if not shutil.which("gcc"):
            return None
        return run_c_tests(code, tests)
    return False, "lenguaje debe ser 'python' o 'c'"


def changed_lines(before: str, after: str) -> tuple[set[int], bool]:
    """Líneas (1-based) de `before` que cambian o se borran; y si hubo inserciones puras."""
    import difflib
    a, b = before.rstrip("\n").split("\n"), after.rstrip("\n").split("\n")
    touched: set[int] = set()
    inserted = False
    for tag, i1, i2, _j1, _j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if tag in ("replace", "delete"):
            touched.update(range(i1 + 1, i2 + 1))
        elif tag == "insert":
            inserted = True
    return touched, inserted


def trace_checks(ex: dict) -> list[dict]:
    """Comprobaciones de un rastreo: preguntas y celdas con `expr`."""
    checks = []
    for k, paso in enumerate(ex.get("pasos", [])):
        vez = paso.get("vez", 1)
        if paso.get("pregunta"):
            checks.append({"linea": paso["linea"], "vez": vez, "expr": paso.get("expr"),
                           "formato": paso.get("formato"), "esperado": str(paso.get("respuesta", "")),
                           "donde": f"paso {k + 1} (pregunta)"})
        for zona in ("pila", "heap"):
            for celda in paso.get(zona) or []:
                if celda.get("expr"):
                    checks.append({"linea": paso["linea"], "vez": vez, "expr": celda["expr"],
                                   "formato": celda.get("formato"), "esperado": str(celda.get("valor", "")),
                                   "donde": f"paso {k + 1}, {zona} '{celda.get('nombre')}'"})
    return checks


def run_trace(code: str, checks: list[dict]) -> list[str]:
    """Inyecta un printf con marca tras cada línea revisada, ejecuta y compara. Devuelve errores."""
    lines = code.rstrip("\n").split("\n")
    after: dict[int, list[str]] = {}
    for i, c in enumerate(checks):
        fmt = str(c["formato"])
        if not TRACE_FORMAT_RE.match(fmt):
            return [f"{c['donde']}: formato '{fmt}' no permitido"]
        after.setdefault(int(c["linea"]), []).append(
            f'printf("@@CX{i}@@{fmt}\\n", {c["expr"]});')
    out_lines = []
    for n, line in enumerate(lines, start=1):
        out_lines.append(line)
        out_lines.extend(after.get(n, []))
    ok, out = run_c_output("\n".join(out_lines) + "\n")
    if not ok:
        return [f"el código instrumentado falla: {out}"]
    seen: dict[int, list[str]] = {}
    for raw in out.splitlines():
        m = re.match(r"^@@CX(\d+)@@(.*)$", raw)
        if m:
            seen.setdefault(int(m.group(1)), []).append(m.group(2))
    errores = []
    for i, c in enumerate(checks):
        vals = seen.get(i, [])
        vez = int(c.get("vez") or 1)
        if len(vals) < vez:
            errores.append(f"{c['donde']}: la línea {c['linea']} no se ejecuta {vez} vez/veces")
        elif vals[vez - 1].strip() != c["esperado"].strip():
            errores.append(f"{c['donde']}: {c['expr']} vale {vals[vez - 1]!r}, no {c['esperado']!r}")
    return errores


# ---------------------------------------------------------------- ejercicios
def check_exercise(where: str, ex: dict, conceptos_ok: set[str] | None) -> None:
    stats["ejercicios"] += 1
    for campo in ("id", "tipo", "dificultad", "conceptos", "enunciado", "explicacion"):
        if campo not in ex:
            err(where, f"falta '{campo}'")
            return
    eid, tipo = ex["id"], ex["tipo"]
    w = f"{where} [{eid}]"
    if not ID_RE.match(str(eid)):
        err(w, "id no cumple <prefijo>-<NN>-<NNN>")
    if tipo not in TIPOS:
        err(w, f"tipo desconocido '{tipo}'")
        return
    if not isinstance(ex["dificultad"], int) or not 1 <= ex["dificultad"] <= 5:
        err(w, "dificultad debe ser entero 1-5")
    if not ex["conceptos"]:
        err(w, "conceptos vacío")
    elif conceptos_ok is not None:
        for c in ex["conceptos"]:
            if c not in conceptos_ok:
                err(w, f"concepto inexistente '{c}'")
    if len(ex.get("pistas", [])) > 3:
        warn(w, "más de 3 pistas")

    ver = ex.get("verificar") or {}
    try:
        if tipo == "numerico":
            if "respuesta" not in ex:
                return err(w, "falta 'respuesta'")
            tol = float(ex.get("tolerancia", 0))
            if "sympy" in ver:
                got = to_float(eval_sympy(ver["sympy"]))
            elif "python" in ver:
                got = to_float(eval_python(ver["python"]))
            elif ver.get("revision") == "manual":
                stats["manuales"] += 1
                return
            else:
                return err(w, "numerico sin 'verificar' (sympy|python|revision: manual)")
            if not close(got, to_float(ex["respuesta"]), tol):
                err(w, f"respuesta {ex['respuesta']} pero la verificación da {got}")
            else:
                stats["verificados"] += 1

        elif tipo == "simbolico":
            if "respuesta" not in ex or "sympy" not in ver:
                return err(w, "simbolico requiere 'respuesta' y verificar.sympy")
            diff = sp.simplify(parse_expr(ex["respuesta"]) - eval_sympy(ver["sympy"]))
            if diff != 0:
                err(w, f"no equivalente: diferencia = {diff}")
            else:
                stats["verificados"] += 1

        elif tipo == "opcion_multiple":
            ops, cor = ex.get("opciones"), ex.get("correcta")
            if not isinstance(ops, list) or len(ops) < 2:
                return err(w, "opciones inválidas")
            if not isinstance(cor, int) or not 0 <= cor < len(ops):
                return err(w, "'correcta' fuera de rango")
            if len(set(map(str, ops))) != len(ops):
                err(w, "opciones repetidas")
            if "valores" in ex and "sympy" in ver:
                if len(ex["valores"]) != len(ops):
                    return err(w, "'valores' debe tener la misma longitud que 'opciones'")
                got = to_float(eval_sympy(ver["sympy"]))
                if not close(got, to_float(ex["valores"][cor]), 0):
                    err(w, f"valores[correcta]={ex['valores'][cor]} pero la verificación da {got}")
                else:
                    # ninguna otra opción debe igualar el valor correcto
                    for i, v in enumerate(ex["valores"]):
                        if i != cor and close(got, to_float(v), 0):
                            err(w, f"la opción {i} también es correcta")
                    stats["verificados"] += 1
            else:
                stats["manuales"] += 1

        elif tipo == "completar":
            huecos = str(ex.get("texto", "")).count("___")
            if huecos == 0 or huecos != len(ex.get("respuestas", [])):
                err(w, f"huecos ({huecos}) != respuestas ({len(ex.get('respuestas', []))})")
            stats["manuales"] += 1

        elif tipo == "ordenar":
            el = ex.get("elementos", [])
            if len(el) < 3 or len(set(map(str, el))) != len(el):
                err(w, "ordenar requiere ≥3 elementos únicos")
            stats["manuales"] += 1

        elif tipo == "autoevaluacion":
            if not ex.get("rubrica") or not ex.get("respuesta_modelo"):
                err(w, "requiere 'rubrica' y 'respuesta_modelo'")
            stats["manuales"] += 1

        elif tipo == "predecir_salida":
            ok, out = run_python_output(ex["codigo"])
            if not ok:
                err(w, f"el código falla: {out}")
            elif out.strip() != str(ex["respuesta"]).strip():
                err(w, f"salida real {out.strip()!r} != respuesta {str(ex['respuesta']).strip()!r}")
            else:
                stats["verificados"] += 1

        elif tipo == "codigo":
            leng = ex.get("lenguaje")
            for campo in ("plantilla", "solucion", "tests"):
                if campo not in ex:
                    return err(w, f"codigo requiere '{campo}'")
            if leng == "python":
                ok, det = run_python_tests(ex["solucion"], ex["tests"])
                if not ok:
                    err(w, f"la solución no pasa sus tests: {det}")
                else:
                    stats["verificados"] += 1
                    pok, _ = run_python_tests(ex["plantilla"], ex["tests"])
                    if pok:
                        err(w, "la plantilla ya pasa los tests (el ejercicio sería trivial)")
            elif leng == "c":
                if not shutil.which("gcc"):
                    warn(w, "gcc no disponible: ejercicio de C NO verificado")
                    stats["c_omitidos"] += 1
                    return
                ok, det = run_c_tests(ex["solucion"], ex["tests"])
                if not ok:
                    err(w, f"la solución en C falla: {det}")
                else:
                    stats["verificados"] += 1
            else:
                err(w, "lenguaje debe ser 'python' o 'c'")

        elif tipo == "depurar":
            leng = ex.get("lenguaje")
            for campo in ("codigo", "linea_bug", "solucion", "tests"):
                if campo not in ex:
                    return err(w, f"depurar requiere '{campo}'")
            r = run_tests(leng, ex["solucion"], ex["tests"])
            if r is None:
                warn(w, "gcc no disponible: ejercicio de C NO verificado")
                stats["c_omitidos"] += 1
                return
            if not r[0]:
                return err(w, f"la solución no pasa sus tests: {r[1]}")
            r_bug = run_tests(leng, ex["codigo"], ex["tests"])
            if r_bug and r_bug[0]:
                return err(w, "el código con el error ya pasa los tests (no hay bug que encontrar)")
            declared = ex["linea_bug"] if isinstance(ex["linea_bug"], list) else [ex["linea_bug"]]
            touched, inserted = changed_lines(ex["codigo"], ex["solucion"])
            if inserted:
                err(w, "la solución agrega líneas: el error debe estar en líneas existentes (linea_bug)")
            elif touched != set(declared):
                err(w, f"la solución cambia las líneas {sorted(touched)} pero linea_bug dice {sorted(declared)}")
            else:
                stats["verificados"] += 1

        elif tipo == "parsons":
            leng = ex.get("lenguaje")
            lineas = ex.get("lineas") or []
            if len(lineas) < 3:
                return err(w, "parsons requiere ≥3 líneas")
            trimmed = {str(l).strip() for l in lineas}
            for d in ex.get("distractores") or []:
                if str(d).strip() in trimmed:
                    err(w, f"el distractor '{str(d).strip()}' también está en las líneas")
            if ex.get("tests"):
                r = run_tests(leng, "\n".join(lineas) + "\n", ex["tests"])
                if r is None:
                    warn(w, "gcc no disponible: ejercicio de C NO verificado")
                    stats["c_omitidos"] += 1
                elif not r[0]:
                    err(w, f"las líneas en orden no pasan los tests: {r[1]}")
                else:
                    stats["verificados"] += 1
            else:
                stats["manuales"] += 1

        elif tipo == "rastreo_memoria":
            if "codigo" not in ex or not ex.get("pasos"):
                return err(w, "rastreo_memoria requiere 'codigo' y 'pasos'")
            checks = trace_checks(ex)
            if not any(p.get("pregunta") for p in ex["pasos"]):
                return err(w, "rastreo requiere al menos una pregunta")
            for c in checks:
                if not c.get("expr") or not c.get("formato"):
                    return err(w, f"{c['donde']}: requiere 'expr' y 'formato'")
            if not shutil.which("gcc"):
                warn(w, "gcc no disponible: rastreo NO verificado")
                stats["c_omitidos"] += 1
                return
            errores = run_trace(ex["codigo"], checks)
            for e in errores:
                err(w, e)
            if not errores:
                stats["verificados"] += 1
    except Exception as e:  # noqa: BLE001
        err(w, f"excepción al verificar: {type(e).__name__}: {e}")


# ---------------------------------------------------------------- unidades
def load_yaml(path: Path):
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        err(str(path.relative_to(ROOT)), f"YAML inválido: {e}")
        return None


def check_conceptos(materia_dir: Path) -> set[str] | None:
    f = materia_dir / "conceptos.yaml"
    where = str(f.relative_to(ROOT))
    if not f.exists():
        warn(str(materia_dir.relative_to(ROOT)), "no hay conceptos.yaml")
        return None
    data = load_yaml(f)
    if not data:
        return None
    ids, prereq = set(), {}
    for c in data.get("conceptos", []):
        cid = c.get("id", "")
        if not KEBAB_RE.match(cid):
            err(where, f"id de concepto inválido '{cid}'")
        if cid in ids:
            err(where, f"concepto duplicado '{cid}'")
        ids.add(cid)
        prereq[cid] = c.get("prerequisitos", []) or []
    for cid, ps in prereq.items():
        for p in ps:
            if ":" not in p and p not in ids:
                err(where, f"'{cid}' requiere inexistente '{p}'")
    # ciclos (DFS)
    state: dict[str, int] = {}

    def dfs(n: str, path: list[str]) -> None:
        state[n] = 1
        for p in prereq.get(n, []):
            if p in prereq:
                if state.get(p) == 1:
                    err(where, "ciclo de prerrequisitos: " + " -> ".join(path + [n, p]))
                elif state.get(p) is None:
                    dfs(p, path + [n])
        state[n] = 2

    for n in list(prereq):
        if state.get(n) is None:
            dfs(n, [])
    return ids


def check_unit(unit_dir: Path, conceptos_ok: set[str] | None, all_ids: dict[str, str]) -> None:
    rel = str(unit_dir.relative_to(ROOT))
    stats["unidades"] += 1
    for f in ("leccion.mdx", "ejercicios.yaml", "jefe.yaml"):
        if not (unit_dir / f).exists():
            err(rel, f"falta {f}")
    # lección
    lec = unit_dir / "leccion.mdx"
    if lec.exists():
        txt = lec.read_text(encoding="utf-8")
        m = re.match(r"^---\n(.*?)\n---\n", txt, re.S)
        if not m:
            err(rel + "/leccion.mdx", "sin front matter")
        else:
            fm = yaml.safe_load(m.group(1)) or {}
            for k in ("titulo", "materia", "unidad", "duracion_min", "conceptos", "programa_ref"):
                if k not in fm:
                    err(rel + "/leccion.mdx", f"front matter sin '{k}'")
            if fm.get("programa_ref", "").strip().lower() == "pendiente":
                warn(rel + "/leccion.mdx", "programa_ref pendiente (alinear con el programa oficial)")
            for c in fm.get("conceptos", []) or []:
                if conceptos_ok is not None and c not in conceptos_ok:
                    err(rel + "/leccion.mdx", f"concepto inexistente '{c}'")
        for tag in ("Predice", "Resumen", "Feynman"):
            if f"<{tag}" not in txt:
                warn(rel + "/leccion.mdx", f"no usa <{tag}>")
    # ejercicios
    ids_unit: set[str] = set()
    ejf = unit_dir / "ejercicios.yaml"
    if ejf.exists():
        data = load_yaml(ejf)
        if data:
            for ex in data.get("ejercicios", []):
                eid = ex.get("id")
                if eid in all_ids:
                    err(rel, f"id duplicado '{eid}' (también en {all_ids[eid]})")
                all_ids[eid] = rel
                ids_unit.add(eid)
                if ex.get("retirado"):
                    continue
                check_exercise(rel, ex, conceptos_ok)
            if len(data.get("ejercicios", [])) < 6:
                warn(rel, "menos de 6 ejercicios (la meta es 15–25 por unidad)")
    # jefe
    jf = unit_dir / "jefe.yaml"
    if jf.exists():
        j = load_yaml(jf)
        if j:
            for k in ("nombre", "vidas", "tiempo_segundos", "aprobado_minimo", "preguntas", "recompensa"):
                if k not in j:
                    err(rel + "/jefe.yaml", f"falta '{k}'")
            pr = (j.get("preguntas") or {})
            propias = pr.get("propias", [])
            for i in propias + (pr.get("repaso_de") or []):
                if i not in all_ids and i not in ids_unit:
                    # los de repaso pueden estar en unidades aún no cargadas: se revisan al final
                    pass
            if len(propias) < 6:
                warn(rel + "/jefe.yaml", "menos de 6 preguntas propias")
            for i in propias:
                if i not in ids_unit:
                    err(rel + "/jefe.yaml", f"pregunta propia '{i}' no existe en esta unidad")
            _boss_refs.append((rel + "/jefe.yaml", pr.get("repaso_de") or []))
            # al menos una pregunta de dificultad >= 4
            if ejf.exists():
                data = load_yaml(ejf) or {}
                dif = {e["id"]: e.get("dificultad", 0) for e in data.get("ejercicios", []) if "id" in e}
                if propias and max((dif.get(i, 0) for i in propias), default=0) < 4:
                    warn(rel + "/jefe.yaml", "ninguna pregunta de dificultad ≥ 4")


_boss_refs: list[tuple[str, list[str]]] = []


def check_plan() -> set[str]:
    ids: set[str] = set()
    if not PLAN.exists():
        err("curriculum/plan-2020.json", "no existe")
        return ids
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    cred = hrs_t = hrs_p = 0.0
    for sem in plan["semestres"]:
        s_cred = 0.0
        for m in sem["materias"]:
            ids.add(m["id"])
            s_cred += m["creditos"]
            hrs_t += m["teoria"]
            hrs_p += m["practica"]
            if abs(m["teoria"] + m["practica"] - m["th"]) > 1e-9:
                err("plan-2020.json", f"{m['id']}: teoria+practica != th")
        if abs(s_cred - sem["creditos"]) > 1e-9:
            err("plan-2020.json", f"semestre {sem['n']}: créditos suman {s_cred}, dice {sem['creditos']}")
        cred += s_cred
    t = plan["totales"]
    if abs(cred - t["creditos_tepic"]) > 1e-9 or abs(hrs_t - t["teoria"]) > 1e-9 or abs(hrs_p - t["practica"]) > 1e-9:
        err("plan-2020.json", f"totales no cuadran: créditos {cred}, teoría {hrs_t}, práctica {hrs_p}")
    return ids


def main(argv: list[str]) -> int:
    materias_plan = check_plan()
    target = Path(argv[1]).resolve() if len(argv) > 1 else CONTENT
    all_ids: dict[str, str] = {}

    materia_dirs: list[Path] = []
    if target == CONTENT:
        materia_dirs = sorted(p for p in CONTENT.iterdir() if p.is_dir() and not p.name.startswith("_"))
    elif target.parent == CONTENT:
        materia_dirs = [target]
    else:  # una unidad
        materia_dirs = [target.parent]

    for md in materia_dirs:
        if md.name not in materias_plan:
            warn(str(md.relative_to(ROOT)), "la materia no existe en curriculum/plan-2020.json")
        conceptos_ok = check_conceptos(md)
        units = sorted(p for p in md.iterdir() if p.is_dir() and re.match(r"^\d{2}-", p.name))
        if target.parent != CONTENT and target != CONTENT:
            units = [target]
        for u in units:
            check_unit(u, conceptos_ok, all_ids)

    for where, refs in _boss_refs:
        for r in refs:
            if r not in all_ids:
                err(where, f"repaso_de '{r}' no existe")

    for w in warnings:
        print(w)
    for e in errors:
        print(e)
    print(
        f"\nUnidades: {stats['unidades']} · Ejercicios: {stats['ejercicios']} · "
        f"Verificados por código: {stats['verificados']} · Revisión manual: {stats['manuales']}"
        + (f" · C omitidos: {stats['c_omitidos']}" if stats["c_omitidos"] else "")
    )
    if errors:
        print(f"\n✗ {len(errors)} error(es), {len(warnings)} aviso(s)")
        return 1
    print(f"\n✓ Todo en orden ({len(warnings)} aviso(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
