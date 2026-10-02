/**
 * Arnés de Python que corre DENTRO de Pyodide (navegador) y en las pruebas (Node). Misma
 * semántica que `run_python_tests` de verify_content.py: ejecuta tu código en un espacio de
 * nombres nuevo y evalúa cada expresión; los valores salen por JSON con `default=repr`.
 * Cada expresión se evalúa aparte para poder decir cuál falló.
 *
 * Seguridad: `exec`/`eval` corren TU código y las expresiones de los tests del repo, dentro del
 * intérprete de Pyodide (WebAssembly en un Web Worker, sin acceso a tu sistema ni a la red).
 */
export const PY_HARNESS = String.raw`
import json as _cx_json, sys as _cx_sys, io as _cx_io, traceback as _cx_tb, os as _cx_os, tempfile as _cx_tmp, shutil as _cx_sh

def _cx_fmt(e):
    line = None
    for fr in _cx_tb.extract_tb(e.__traceback__):
        if fr.filename == "<tu código>":
            line = fr.lineno
    if line is None and isinstance(e, SyntaxError) and e.filename == "<tu código>":
        line = e.lineno
    msg = "".join(_cx_tb.format_exception_only(type(e), e)).strip().splitlines()[-1]
    return (f"línea {line}: " if line else "") + msg

def __cortex_run(code, exprs):
    out = _cx_io.StringIO()
    old = _cx_sys.stdout
    _cx_sys.stdout = out
    res = {"ok": True, "error": None, "results": [], "stdout": ""}
    # Carpeta nueva por corrida (como verify_content.py): los archivos de un intento no
    # contaminan el siguiente.
    old_cwd = _cx_os.getcwd()
    work = _cx_tmp.mkdtemp(prefix="cortex-")
    _cx_os.chdir(work)
    try:
        ns = {"__name__": "__main__"}
        try:
            exec(compile(code, "<tu código>", "exec"), ns)
        except BaseException as e:
            res["ok"] = False
            res["error"] = _cx_fmt(e)
        else:
            for ex in exprs:
                try:
                    v = eval(ex, ns)
                    res["results"].append({"ok": True, "value": _cx_json.dumps(v, default=repr)})
                except BaseException as e:
                    res["results"].append({"ok": False, "error": _cx_fmt(e)})
    finally:
        _cx_sys.stdout = old
        _cx_os.chdir(old_cwd)
        _cx_sh.rmtree(work, ignore_errors=True)
    res["stdout"] = out.getvalue()[:20000]
    return _cx_json.dumps(res)
`;

export type { HarnessResult } from "@/engine/code/types";
