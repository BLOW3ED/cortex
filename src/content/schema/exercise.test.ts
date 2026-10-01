import { describe, expect, it } from "vitest";
import { parseExercise } from "./exercise";

const base = {
  id: "calc-01-001",
  dificultad: 2,
  conceptos: ["limite-polinomio"],
  enunciado: "Calcula algo.",
  explicacion: "Porque sí.",
};
const numeric = { ...base, tipo: "numerico", respuesta: 3, tolerancia: 0, verificar: { sympy: "1+2" } };

function messages(raw: unknown): string[] {
  const r = parseExercise(raw);
  return r.ok ? [] : r.issues.map((i) => `${i.path.join(".")}|${i.code}|${i.message}`);
}

describe("parseExercise · campos comunes", () => {
  it("acepta un numérico válido", () => {
    expect(messages(numeric)).toEqual([]);
  });

  it.each([0, 6, 2.5, "2"])("rechaza dificultad %s", (dificultad) => {
    expect(messages({ ...numeric, dificultad }).some((m) => m.startsWith("dificultad|"))).toBe(true);
  });

  it.each(["calc-1-001", "Calc-01-001", "calc-01-01", "calc_01_001"])("rechaza el id %s", (id) => {
    expect(messages({ ...numeric, id }).some((m) => m.startsWith("id|"))).toBe(true);
  });

  it("rechaza conceptos vacío y explicación faltante", () => {
    const { explicacion: _omit, ...sinExplicacion } = numeric;
    expect(messages({ ...numeric, conceptos: [] })).toEqual([expect.stringContaining("conceptos vacío")]);
    expect(messages(sinExplicacion).some((m) => m.startsWith("explicacion|"))).toBe(true);
  });

  it("rechaza campos desconocidos (errores de dedo)", () => {
    expect(messages({ ...numeric, tolerancai: 0.1 })).toEqual([expect.stringContaining("unrecognized_keys")]);
  });

  it("rechaza un tipo desconocido con un mensaje claro", () => {
    expect(messages({ ...base, tipo: "dibujo" })).toEqual(["tipo|invalid_value|tipo desconocido 'dibujo'"]);
  });

  it("acepta un ejercicio retirado aunque esté incompleto", () => {
    const r = parseExercise({ id: "calc-01-099", retirado: true });
    expect(r.ok && r.retired).toBe(true);
  });

  it("un retirado conserva la regla del id", () => {
    expect(parseExercise({ id: "mal", retirado: true }).ok).toBe(false);
  });

  it("acepta verificar: revision manual como campo común", () => {
    const ex = { ...base, tipo: "completar", texto: "a ___ b", respuestas: ["x"], verificar: { revision: "manual" } };
    expect(messages(ex)).toEqual([]);
  });
});

describe("parseExercise · por tipo", () => {
  it("numérico sin verificar es error", () => {
    const { verificar: _omit, ...sinVerificar } = numeric;
    expect(messages(sinVerificar).some((m) => m.startsWith("verificar|"))).toBe(true);
  });

  it("numérico acepta respuesta como expresión de texto", () => {
    expect(messages({ ...numeric, respuesta: "1/3" })).toEqual([]);
  });

  it("simbólico exige verificar.sympy", () => {
    const ok = { ...base, tipo: "simbolico", respuesta: "2*x", verificar: { sympy: "diff(x**2, x)" } };
    expect(messages(ok)).toEqual([]);
    expect(messages({ ...ok, verificar: { python: "1" } }).length).toBeGreaterThan(0);
  });

  describe("opción múltiple", () => {
    const om = { ...base, tipo: "opcion_multiple", opciones: ["1", "3", "0"], correcta: 1 };
    it("acepta la forma válida con valores numéricos o de texto", () => {
      expect(messages({ ...om, valores: [1, 3, "0"], verificar: { sympy: "3" } })).toEqual([]);
    });
    it("rechaza correcta fuera de rango", () => {
      expect(messages({ ...om, correcta: 3 })).toEqual([expect.stringContaining("'correcta' fuera de rango")]);
    });
    it("rechaza opciones repetidas", () => {
      expect(messages({ ...om, opciones: ["1", "1", "2"] })).toEqual([expect.stringContaining("opciones repetidas")]);
    });
    it("rechaza menos de 2 opciones", () => {
      expect(messages({ ...om, opciones: ["1"], correcta: 0 }).length).toBeGreaterThan(0);
    });
    it("rechaza valores de otra longitud", () => {
      expect(messages({ ...om, valores: [1, 3] })).toEqual([expect.stringContaining("misma longitud")]);
    });
  });

  it("completar: huecos deben coincidir con respuestas", () => {
    const c = { ...base, tipo: "completar", texto: "a ___ b ___", respuestas: ["x", "y"] };
    expect(messages(c)).toEqual([]);
    expect(messages({ ...c, respuestas: ["x"] })).toEqual([expect.stringContaining("huecos (2) != respuestas (1)")]);
    expect(messages({ ...c, texto: "sin huecos", respuestas: [] })).toEqual([
      expect.stringContaining("huecos (0) != respuestas (0)"),
    ]);
  });

  it("ordenar: al menos 3 elementos únicos", () => {
    const o = { ...base, tipo: "ordenar", elementos: ["a", "b", "c"] };
    expect(messages(o)).toEqual([]);
    expect(messages({ ...o, elementos: ["a", "b"] })).toEqual([expect.stringContaining("≥3 elementos únicos")]);
    expect(messages({ ...o, elementos: ["a", "b", "a"] })).toEqual([expect.stringContaining("≥3 elementos únicos")]);
  });

  describe("código", () => {
    const py = {
      ...base,
      id: "prog-01-003",
      tipo: "codigo",
      lenguaje: "python",
      plantilla: "def f(x):\n    pass\n",
      solucion: "def f(x):\n    return x\n",
      tests: [{ expr: "f(2)", esperado: 2 }],
    };
    it("acepta Python con tests {expr, esperado}", () => {
      expect(messages(py)).toEqual([]);
    });
    it("acepta C con tests {entrada, salida}", () => {
      const c = { ...py, lenguaje: "c", tests: [{ entrada: "3 4\n", salida: "7\n" }] };
      expect(messages(c)).toEqual([]);
    });
    it("rechaza C sin salida y lenguajes desconocidos", () => {
      expect(messages({ ...py, lenguaje: "c", tests: [{ entrada: "1" }] }).length).toBeGreaterThan(0);
      expect(messages({ ...py, lenguaje: "rust" }).length).toBeGreaterThan(0);
    });
    it("rechaza código sin tests", () => {
      expect(messages({ ...py, tests: [] }).length).toBeGreaterThan(0);
    });
  });

  it("predecir salida solo en Python", () => {
    const p = { ...base, tipo: "predecir_salida", lenguaje: "python", codigo: "print(1)", respuesta: "1" };
    expect(messages(p)).toEqual([]);
    expect(messages({ ...p, lenguaje: "c" }).length).toBeGreaterThan(0);
  });

  it("autoevaluación exige rúbrica y respuesta modelo", () => {
    const a = { ...base, tipo: "autoevaluacion", rubrica: ["Explica X"], respuesta_modelo: "X es..." };
    expect(messages(a)).toEqual([]);
    expect(messages({ ...a, rubrica: [] }).length).toBeGreaterThan(0);
    const { respuesta_modelo: _omit, ...sinModelo } = a;
    expect(messages(sinModelo).length).toBeGreaterThan(0);
  });
});
