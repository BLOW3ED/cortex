import type { CTest, PythonTest } from "@/content/schema";
import type { CRunResponse, HarnessResult } from "./types";

/**
 * Calificación de ejercicios de código (Fase 2). Reproduce EXACTAMENTE las reglas de
 * `scripts/verify_content.py`, para que lo que el verificador aprobó con la solución oficial
 * también lo apruebe la app con la tuya:
 *  - Python: cada `expr` se evalúa tras ejecutar tu código y se compara con `esperado` después de
 *    pasar por JSON (`json.dumps(..., default=repr)`). Números: tolerancia absoluta o relativa 1e-9.
 *  - C: la salida estándar se compara sin los espacios finales (`rstrip`).
 */

/** Igualdad como `==` de Python sobre valores JSON (True == 1, [1, 2] == [1.0, 2.0]). */
export function pyEqual(a: unknown, b: unknown): boolean {
  const numLike = (v: unknown) => typeof v === "number" || typeof v === "boolean";
  if (numLike(a) && numLike(b)) return Number(a) === Number(b);
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => pyEqual(x, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    return ka.length === kb.length && ka.every((k) => k in (b as object) && pyEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return a === b;
}

/** `close()` de verify_content.py. */
function close(got: number, expected: number, tol: number): boolean {
  return Math.abs(got - expected) <= Math.max(tol, 1e-9 * Math.max(1, Math.abs(expected)));
}

/** ¿Un valor obtenido (ya decodificado de JSON) cumple el test de Python? */
export function pythonTestPasses(test: Pick<PythonTest, "esperado" | "tolerancia">, got: unknown): boolean {
  const exp = test.esperado;
  if (typeof exp === "number" && (typeof got === "number" || typeof got === "boolean")) {
    return close(Number(got), exp, test.tolerancia ?? 0);
  }
  return pyEqual(got, exp);
}

/** ¿La salida de un programa en C cumple el test? */
export function cTestPasses(test: Pick<CTest, "salida">, stdout: string): boolean {
  return stdout.replace(/\s+$/, "") === test.salida.replace(/\s+$/, "");
}

export interface TestOutcome {
  readonly index: number;
  readonly passed: boolean;
  readonly hidden: boolean;
  /** Texto para mostrar (vacío si es oculto). */
  readonly label: string;
  readonly expected: string;
  readonly got: string;
}

export interface GradeSummary {
  readonly passed: boolean;
  readonly total: number;
  readonly ok: number;
  readonly outcomes: readonly TestOutcome[];
  /** Resumen en texto para la retroalimentación y el cuaderno de errores. */
  readonly text: string;
}

export function summarize(outcomes: readonly TestOutcome[], error: string | null = null): GradeSummary {
  const ok = outcomes.filter((o) => o.passed).length;
  const lines = outcomes.map((o) =>
    o.hidden ? `${o.passed ? "✓" : "✗"} prueba oculta ${o.index + 1}` : `${o.passed ? "✓" : "✗"} ${o.label} → ${o.got}${o.passed ? "" : ` (esperado ${o.expected})`}`,
  );
  const passed = error === null && outcomes.length > 0 && ok === outcomes.length;
  const text = [error ? `Error: ${error}` : null, `${ok}/${outcomes.length} pruebas`, ...lines].filter(Boolean).join("\n");
  return { passed, total: outcomes.length, ok, outcomes, text };
}

/** Texto corto de un valor JSON para mostrarlo (como lo imprimiría Python, aproximado). */
export function showValue(v: unknown): string {
  if (v === null) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "string") return JSON.stringify(v).length > 60 ? `${JSON.stringify(v).slice(0, 57)}…"` : `'${v}'`;
  const s = JSON.stringify(v);
  return s.length > 60 ? `${s.slice(0, 59)}…` : s;
}

export function showOutput(s: string): string {
  const t = s.replace(/\s+$/, "");
  return t.length > 80 ? `${JSON.stringify(t.slice(0, 77))}…` : JSON.stringify(t);
}

/** Califica los tests de Python con lo que regresó el arnés. */
export function gradePython(tests: readonly PythonTest[], run: HarnessResult): GradeSummary {
  if (!run.ok) {
    return summarize(
      tests.map((t, i) => ({ index: i, passed: false, hidden: Boolean(t.oculto), label: t.expr, expected: showValue(t.esperado), got: "—" })),
      run.error ?? "tu código no se pudo ejecutar",
    );
  }
  const outcomes = tests.map((t, i): TestOutcome => {
    const r = run.results[i];
    const base = { index: i, hidden: Boolean(t.oculto), label: t.expr, expected: showValue(t.esperado) };
    if (!r) return { ...base, passed: false, got: "sin resultado" };
    if (!r.ok) return { ...base, passed: false, got: r.error };
    let got: unknown;
    try {
      got = JSON.parse(r.value);
    } catch {
      return { ...base, passed: false, got: r.value };
    }
    return { ...base, passed: pythonTestPasses(t, got), got: showValue(got) };
  });
  return summarize(outcomes);
}

/** Califica los tests de C con lo que regresó el runner. */
export function gradeC(tests: readonly CTest[], resp: CRunResponse): GradeSummary {
  if (!resp.compile.ok) {
    return summarize(
      tests.map((t, i) => ({ index: i, passed: false, hidden: Boolean(t.oculto), label: `entrada ${showOutput(t.entrada ?? "")}`, expected: showOutput(t.salida), got: "—" })),
      `no compila:\n${resp.compile.output}`,
    );
  }
  const outcomes = tests.map((t, i): TestOutcome => {
    const r = resp.runs[i];
    const base = { index: i, hidden: Boolean(t.oculto), label: `entrada ${showOutput(t.entrada ?? "")}`, expected: showOutput(t.salida) };
    if (!r) return { ...base, passed: false, got: "sin resultado" };
    if (r.timedOut) return { ...base, passed: false, got: "se tardó demasiado (¿ciclo infinito?)" };
    if (r.truncated) return { ...base, passed: false, got: "imprimió demasiado" };
    const passed = cTestPasses(t, r.stdout);
    const crash = r.exitCode !== 0 && r.exitCode !== null ? ` (terminó con código ${r.exitCode})` : "";
    return { ...base, passed, got: `${showOutput(r.stdout)}${crash}` };
  });
  return summarize(outcomes);
}
