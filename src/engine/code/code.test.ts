import { describe, expect, it } from "vitest";
import { cTestPasses, gradeC, gradePython, pyEqual, pythonTestPasses, summarize } from "./grade";
import { assemble, indentLevel, parsonsExact, traceVerdict } from "./mechanics";

describe("calificación como verify_content.py", () => {
  it("igualdad de Python sobre JSON", () => {
    expect(pyEqual(true, 1)).toBe(true);
    expect(pyEqual([1, 2], [1.0, 2.0])).toBe(true);
    expect(pyEqual({ a: [1, null] }, { a: [1, null] })).toBe(true);
    expect(pyEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(pyEqual("1", 1)).toBe(false);
    expect(pyEqual([1], [1, 1])).toBe(false);
  });

  it("tolerancia numérica y valores no numéricos", () => {
    expect(pythonTestPasses({ esperado: 98.6, tolerancia: 0.000001 }, 98.60000000000001)).toBe(true);
    expect(pythonTestPasses({ esperado: 98.6 }, 98)).toBe(false);
    expect(pythonTestPasses({ esperado: 3 }, 3.0000000000001)).toBe(true);
    expect(pythonTestPasses({ esperado: "abc" }, "abc")).toBe(true);
    expect(pythonTestPasses({ esperado: true }, 1)).toBe(true);
  });

  it("salida de C sin espacios finales", () => {
    expect(cTestPasses({ salida: "7\n" }, "7")).toBe(true);
    expect(cTestPasses({ salida: "7" }, "7\n\n  ")).toBe(true);
    expect(cTestPasses({ salida: "7" }, " 7")).toBe(false);
  });

  it("resume pruebas sin revelar las ocultas", () => {
    const g = gradePython(
      [
        { expr: "f(1)", esperado: 2 },
        { expr: "f(0)", esperado: 0, oculto: true },
      ],
      { ok: true, error: null, stdout: "", results: [{ ok: true, value: "2" }, { ok: true, value: "5" }] },
    );
    expect(g.passed).toBe(false);
    expect(g.ok).toBe(1);
    expect(g.text).toContain("✗ prueba oculta 2");
    expect(g.text).not.toContain("f(0)");
    expect(summarize([]).passed).toBe(false);
  });

  it("C: errores de compilación, tiempo y salida enorme", () => {
    const tests = [{ entrada: "1\n", salida: "1\n" }];
    expect(gradeC(tests, { compile: { ok: false, output: "error: x" }, runs: [] }).text).toMatch(/no compila/);
    expect(gradeC(tests, { compile: { ok: true, output: "" }, runs: [{ stdout: "", stderr: "", exitCode: null, timedOut: true, truncated: false }] }).text).toMatch(/se tardó/);
    expect(gradeC(tests, { compile: { ok: true, output: "" }, runs: [{ stdout: "1\n", stderr: "", exitCode: 0, timedOut: false, truncated: false }] }).passed).toBe(true);
  });
});

describe("Parsons", () => {
  const lineas = ["def f(x):", "    if x > 0:", "        return 1", "    return 0"];
  const ok = lineas.map((l) => ({ text: l.trim(), indent: indentLevel(l) }));

  it("exige orden y, en Python, sangría", () => {
    expect(parsonsExact(lineas, ok, true)).toBe(true);
    expect(parsonsExact(lineas, ok.map((p) => ({ ...p, indent: 0 })), true)).toBe(false);
    expect(parsonsExact(lineas, ok.map((p) => ({ ...p, indent: 0 })), false)).toBe(true);
    expect(parsonsExact(lineas, [ok[1], ok[0], ok[2], ok[3]].filter((x) => x !== undefined), true)).toBe(false);
    expect(parsonsExact(lineas, ok.slice(0, 3), true)).toBe(false);
  });

  it("arma el programa con la sangría elegida", () => {
    expect(assemble(ok, true)).toBe(`${lineas.join("\n")}\n`);
    expect(assemble(ok, false)).toBe("def f(x):\nif x > 0:\nreturn 1\nreturn 0\n");
  });
});

describe("rastreo de memoria", () => {
  const pasos = [
    { linea: 4, pila: [] },
    { linea: 5, pila: [], pregunta: "¿*p?", respuesta: "5", expr: "*p", formato: "%d" },
    { linea: 6, pila: [], pregunta: "¿a?", respuesta: "8", expr: "a", formato: "%d" },
  ];

  it("pide todas las respuestas", () => {
    expect(traceVerdict(pasos, { 1: "5" })).toEqual({ status: "missing", steps: [3] });
  });

  it("califica cada pregunta y explica las fallidas", () => {
    expect(traceVerdict(pasos, { 1: " 5 ", 2: "8" })).toMatchObject({ status: "graded", passed: true });
    const bad = traceVerdict(pasos, { 1: "5", 2: "5" });
    expect(bad).toMatchObject({ status: "graded", passed: false });
    if (bad.status === "graded") expect(bad.lines[1]).toBe("✗ Paso 3: ¿a? → 5 (era 8)");
  });
});
