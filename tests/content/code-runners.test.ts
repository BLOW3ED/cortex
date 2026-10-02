import { join } from "node:path";
import { loadPyodide, type PyodideAPI } from "pyodide";
import { beforeAll, describe, expect, it } from "vitest";
import type { CodeExercise, DebugExercise, Exercise, ParsonsExercise } from "../../src/content/schema";
import { loadContent } from "../../src/content/loader";
import { gradeC, gradePython } from "../../src/engine/code/grade";
import type { HarnessResult } from "../../src/engine/code/types";
import { compileAndRun, gccAvailable } from "../../src/runners/c-runner";
import { PY_HARNESS } from "../../src/runners/python-harness";

/*
 * Los runners de la app (Pyodide para Python, el runner local de C) deben calificar igual que
 * verify_content.py: TODA solución oficial del repo pasa sus tests en la app, y toda plantilla o
 * código con bug los falla. Así lo que Carlo resuelve bien en el navegador cuenta como bien.
 */

let py: PyodideAPI;

async function runPy(code: string, exprs: readonly string[]): Promise<HarnessResult> {
  const run = py.globals.get("__cortex_run") as (c: string, e: unknown) => string;
  const list = py.toPy([...exprs]);
  try {
    return JSON.parse(run(code, list)) as HarnessResult;
  } finally {
    list.destroy();
  }
}

beforeAll(async () => {
  py = await loadPyodide({ indexURL: join(process.cwd(), "node_modules", "pyodide") + "/" });
  py.runPython(PY_HARNESS);
}, 60_000);

describe("arnés de Python en Pyodide", () => {
  it("evalúa cada expresión aparte y captura la salida", async () => {
    const r = await runPy("def f(x):\n    print('hola', x)\n    return x * 2\n", ["f(2)", "f('a')", "g(1)", "(1, 2)", "{'a': [1.5, None]}"]);
    expect(r.ok).toBe(true);
    expect(r.stdout).toBe("hola 2\nhola a\n");
    expect(r.results.map((x) => (x.ok ? x.value : `ERR ${x.error}`))).toEqual(["4", '"aa"', "ERR NameError: name 'g' is not defined", "[1, 2]", '{"a": [1.5, null]}']);
  });

  it("reporta la línea de un error de sintaxis o de ejecución de tu código", async () => {
    const syntax = await runPy("def f(:\n    pass\n", ["f()"]);
    expect(syntax.ok).toBe(false);
    expect(syntax.error).toMatch(/^línea 1: SyntaxError/);
    const runtime = await runPy("x = 1\ny = x / 0\n", []);
    expect(runtime.error).toBe("línea 2: ZeroDivisionError: division by zero");
    const inFn = await runPy("def f():\n    return [][3]\n", ["f()"]);
    expect(inFn.results[0]).toEqual({ ok: false, error: "línea 2: IndexError: list index out of range" });
  });

  it("califica como verify_content.py (tolerancia, True == 1, tuplas como listas)", async () => {
    const r = await runPy("def f():\n    return 0.1 + 0.2\ndef g():\n    return True\ndef h():\n    return (1, 2.0)\n", ["f()", "g()", "h()"]);
    const s = gradePython(
      [
        { expr: "f()", esperado: 0.3, tolerancia: 0.000001 },
        { expr: "g()", esperado: 1 },
        { expr: "h()", esperado: [1, 2], oculto: true },
      ],
      r,
    );
    expect(s.passed).toBe(true);
    expect(s.text).toContain("prueba oculta 3");
    expect(s.text).not.toContain("h()");
  });
});

const { index } = loadContent(process.cwd());
const all: Exercise[] = Object.values(index?.content ?? {}).flatMap((s) => s.units.flatMap((u) => [...u.exercises]));
const pyCode = all.filter((e): e is Extract<CodeExercise, { lenguaje: "python" }> => e.tipo === "codigo" && e.lenguaje === "python");
const cCode = all.filter((e): e is Extract<CodeExercise, { lenguaje: "c" }> => e.tipo === "codigo" && e.lenguaje === "c");
const debugs = all.filter((e): e is DebugExercise => e.tipo === "depurar");
const parsons = all.filter((e): e is ParsonsExercise => e.tipo === "parsons" && e.tests !== undefined);

describe("todas las soluciones de Python del repo pasan en Pyodide (y las plantillas no)", () => {
  it.each(pyCode.map((e) => [e.id, e] as const))("%s", async (_id, ex) => {
    const exprs = ex.tests.map((t) => t.expr);
    expect(gradePython(ex.tests, await runPy(ex.solucion, exprs)).passed).toBe(true);
    expect(gradePython(ex.tests, await runPy(ex.plantilla, exprs)).passed).toBe(false);
  });
});

describe.skipIf(!gccAvailable())("todas las soluciones de C del repo pasan en el runner local (y las plantillas no)", () => {
  it.each(cCode.map((e) => [e.id, e] as const))("%s", async (_id, ex) => {
    const inputs = ex.tests.map((t) => t.entrada ?? "");
    expect(gradeC(ex.tests, await compileAndRun(ex.solucion, inputs)).passed).toBe(true);
    expect(gradeC(ex.tests, await compileAndRun(ex.plantilla, inputs)).passed).toBe(false);
  }, 60_000);
});

it("el contenido carga (si no, estas pruebas no probarían nada)", () => {
  expect(index).not.toBeNull();
  expect(pyCode.length + cCode.length).toBeGreaterThan(0);
});

describe.skipIf(debugs.length === 0)("Debug Dojo: la solución pasa y el código con el error no", () => {
  it.each(debugs.map((e) => [e.id, e] as const))("%s", async (_id, ex) => {
    if (ex.lenguaje === "python") {
      const exprs = ex.tests.map((t) => t.expr);
      expect(gradePython(ex.tests, await runPy(ex.solucion, exprs)).passed).toBe(true);
      expect(gradePython(ex.tests, await runPy(ex.codigo, exprs)).passed).toBe(false);
    } else if (gccAvailable()) {
      const inputs = ex.tests.map((t) => t.entrada ?? "");
      expect(gradeC(ex.tests, await compileAndRun(ex.solucion, inputs)).passed).toBe(true);
      expect(gradeC(ex.tests, await compileAndRun(ex.codigo, inputs)).passed).toBe(false);
    }
  }, 60_000);
});

describe.skipIf(parsons.length === 0)("Parsons: las líneas en orden forman un programa que pasa", () => {
  it.each(parsons.map((e) => [e.id, e] as const))("%s", async (_id, ex) => {
    const code = `${ex.lineas.join("\n")}\n`;
    if (ex.lenguaje === "python" && ex.tests) {
      expect(gradePython(ex.tests, await runPy(code, ex.tests.map((t) => t.expr))).passed).toBe(true);
    } else if (ex.lenguaje === "c" && ex.tests && gccAvailable()) {
      expect(gradeC(ex.tests, await compileAndRun(code, ex.tests.map((t) => t.entrada ?? ""))).passed).toBe(true);
    }
  }, 60_000);
});
