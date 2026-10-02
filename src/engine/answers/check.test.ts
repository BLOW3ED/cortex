import { describe, expect, it } from "vitest";
import type { Exercise } from "@/content/schema";
import { checkAnswer } from "./check";
import { closeEnough, compileExpression, evaluateNumber, ExpressionError } from "./math";
import { symbolicMatch } from "./symbolic";
import { blankMatches, normalizeOutput, normalizeText } from "./text";

const common = { id: "calc-01-001", dificultad: 2, conceptos: ["c"], enunciado: "e", explicacion: "x" } as const;
const ex = (e: Record<string, unknown>): Exercise => ({ ...common, ...e }) as unknown as Exercise;

describe("números", () => {
  it("entiende decimales, fracciones, coma decimal y constantes", () => {
    expect(evaluateNumber("0.5")).toBe(0.5);
    expect(evaluateNumber(".5")).toBe(0.5);
    expect(evaluateNumber("1/2")).toBe(0.5);
    expect(evaluateNumber("0,5")).toBe(0.5);
    expect(evaluateNumber("-3,25")).toBe(-3.25);
    expect(evaluateNumber("sqrt(2)/2")).toBeCloseTo(Math.SQRT1_2);
    expect(evaluateNumber("pi/4")).toBeCloseTo(Math.PI / 4);
    expect(evaluateNumber("2**3")).toBe(8);
    expect(evaluateNumber(" −4 ")).toBe(-4);
  });

  it("rechaza variables y funciones desconocidas con mensaje", () => {
    expect(() => evaluateNumber("x+1")).toThrow(ExpressionError);
    expect(() => evaluateNumber("import(1)")).toThrow(ExpressionError);
    expect(() => evaluateNumber("derivative(1)")).toThrow(ExpressionError);
    expect(() => evaluateNumber("1 +")).toThrow(ExpressionError);
    expect(() => compileExpression("")).toThrow(/vacía/);
  });

  it("usa la misma tolerancia que verify_content.py", () => {
    expect(closeEnough(0.33333, 1 / 3, 0)).toBe(false);
    expect(closeEnough(0.3333333333, 1 / 3, 0)).toBe(true); // 1e-9 relativo, como Python
    expect(closeEnough(0.333, 1 / 3, 0.001)).toBe(true);
    expect(closeEnough(3 + 1e-12, 3, 0)).toBe(true);
    expect(closeEnough(Infinity, Infinity, 0)).toBe(true);
  });
});

describe("equivalencia simbólica", () => {
  it("acepta formas equivalentes", () => {
    expect(symbolicMatch("x+3", "x+3")).toBe("equivalent");
    expect(symbolicMatch("3 + x", "x+3")).toBe("equivalent");
    expect(symbolicMatch("(x^2-9)/(x-3)", "x+3")).toBe("equivalent");
    expect(symbolicMatch("2x(x+1)", "2*x**2 + 2*x")).toBe("equivalent");
    expect(symbolicMatch("sin(x)^2 + cos(x)^2 + x", "1 + x")).toBe("equivalent");
    expect(symbolicMatch("sqrt(x)*sqrt(x)", "x")).toBe("equivalent");
    expect(symbolicMatch("ln(e^x)", "x")).toBe("equivalent");
    expect(symbolicMatch("x·y", "x*y", ["x", "y"])).toBe("equivalent");
  });

  it("entiende lo que escribe MathLive (ascii-math) y la escritura común", () => {
    expect(symbolicMatch("sin ^2x+cos ^2x+x+2", "x+3")).toBe("equivalent");
    expect(symbolicMatch("|x|", "Abs(x)")).toBe("equivalent");
    expect(symbolicMatch("sqrt(x) * sqrt(x)+3", "x+3")).toBe("equivalent");
    expect(symbolicMatch("2pi x", "2*pi*x")).toBe("equivalent");
    expect(symbolicMatch("e^x", "exp(x)")).toBe("equivalent");
    expect(symbolicMatch("ln x + sin(x)", "log(x) + sin(x)")).toBe("equivalent");
    expect(symbolicMatch("sin^2(x+1)", "sin(x+1)**2")).toBe("equivalent");
    expect(symbolicMatch("(x^2-9)/(x-3)", "x+3")).toBe("equivalent");
  });

  it("rechaza formas distintas", () => {
    expect(symbolicMatch("x-3", "x+3")).toBe("different");
    expect(symbolicMatch("x^2", "2*x")).toBe("different");
    expect(symbolicMatch("y+3", "x+3")).toBe("different");
  });

  it("no acepta variables cuando la respuesta es constante", () => {
    expect(() => symbolicMatch("x", "1")).toThrow(/variable/);
  });
});

describe("texto", () => {
  it("normaliza acentos, mayúsculas, espacios y comillas", () => {
    expect(normalizeText("  Factorízá ")).toBe("factoriza");
    expect(normalizeText("`//`")).toBe("//");
    expect(blankMatches("CANCELA", "cancela")).toBe(true);
    expect(blankMatches("2.0", "2")).toBe(true);
    expect(blankMatches("1/2", "0.5")).toBe(true);
    expect(blankMatches("%", "//")).toBe(false);
  });

  it("compara salidas como verify_content.py (strip)", () => {
    expect(normalizeOutput("555\r\n15  \n\n")).toBe("555\n15");
    expect(normalizeOutput("  3\n")).toBe("3");
    expect(normalizeOutput("a\n b")).toBe("a\n b");
  });
});

describe("checkAnswer", () => {
  it("opción múltiple", () => {
    const e = ex({ tipo: "opcion_multiple", opciones: ["1", "3"], correcta: 1 });
    expect(checkAnswer(e, { kind: "choice", index: 1 }).status).toBe("correct");
    expect(checkAnswer(e, { kind: "choice", index: 0 })).toEqual({ status: "wrong", expected: "3" });
  });

  it("numérico con tolerancia y respuesta escrita como expresión", () => {
    const e = ex({ tipo: "numerico", respuesta: 0.5, tolerancia: 0.001, verificar: { sympy: "1/2" } });
    expect(checkAnswer(e, { kind: "text", value: "1/2" }).status).toBe("correct");
    expect(checkAnswer(e, { kind: "text", value: "0.4999" }).status).toBe("correct");
    expect(checkAnswer(e, { kind: "text", value: "0.6" }).status).toBe("wrong");
    expect(checkAnswer(e, { kind: "text", value: "abc" }).status).toBe("invalid");
    const third = ex({ tipo: "numerico", respuesta: "1/3", verificar: { sympy: "Rational(1,3)" } });
    expect(checkAnswer(third, { kind: "text", value: "1/3" }).status).toBe("correct");
    expect(checkAnswer(third, { kind: "text", value: "0.333" }).status).toBe("wrong");
  });

  it("simbólico", () => {
    const e = ex({ tipo: "simbolico", respuesta: "x+3", verificar: { sympy: "x+3" } });
    expect(checkAnswer(e, { kind: "text", value: "3+x" }).status).toBe("correct");
    expect(checkAnswer(e, { kind: "text", value: "3x" }).status).toBe("wrong");
    expect(checkAnswer(e, { kind: "text", value: "3+" }).status).toBe("invalid");
  });

  it("completar, ordenar, predecir y autoevaluación", () => {
    const c = ex({ tipo: "completar", texto: "a ___ b ___", respuestas: ["factoriza", "cancela"] });
    expect(checkAnswer(c, { kind: "blanks", values: ["Factoriza", "cancela "] }).status).toBe("correct");
    expect(checkAnswer(c, { kind: "blanks", values: ["factoriza", ""] }).status).toBe("invalid");
    expect(checkAnswer(c, { kind: "blanks", values: ["x", "y"] }).status).toBe("wrong");

    const o = ex({ tipo: "ordenar", elementos: ["a", "b", "c"] });
    expect(checkAnswer(o, { kind: "order", items: ["a", "b", "c"] }).status).toBe("correct");
    expect(checkAnswer(o, { kind: "order", items: ["b", "a", "c"] }).status).toBe("wrong");

    const p = ex({ tipo: "predecir_salida", lenguaje: "python", codigo: "print(1)", respuesta: "555\n15" });
    expect(checkAnswer(p, { kind: "text", value: "555\n15\n" }).status).toBe("correct");
    expect(checkAnswer(p, { kind: "text", value: "555 15" }).status).toBe("wrong");

    const s = ex({ tipo: "autoevaluacion", rubrica: ["a", "b", "c"], respuesta_modelo: "m" });
    expect(checkAnswer(s, { kind: "self", text: "mi idea", met: [true, true, true] }).status).toBe("correct");
    expect(checkAnswer(s, { kind: "self", text: "mi idea", met: [true, true, false] }).status).toBe("wrong");
    expect(checkAnswer(s, { kind: "self", text: " ", met: [true, true, true] }).status).toBe("invalid");
  });

  it("no acepta una respuesta del tipo equivocado", () => {
    const e = ex({ tipo: "opcion_multiple", opciones: ["1", "3"], correcta: 1 });
    expect(checkAnswer(e, { kind: "text", value: "3" }).status).toBe("invalid");
  });
});
