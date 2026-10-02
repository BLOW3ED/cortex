import { createRng, type Rng } from "../rng";
import { compileExpression, type CompiledExpression } from "./math";

/**
 * Equivalencia simbólica por evaluación numérica (ADR-007): se evalúan ambas expresiones en
 * puntos aleatorios del dominio (saltando singularidades y valores fuera de dominio) y se
 * comparan con tolerancia relativa. La comprobación fuerte con sympy ya la hizo
 * verify_content.py al escribir el ejercicio.
 */

const REQUIRED_POINTS = 6;
const MAX_TRIALS = 80;
const REL_TOL = 1e-6;
const ABS_TOL = 1e-8;

/** Rangos alternados: mixto, positivo (para raíces y logaritmos) y cercano a 0. */
const RANGES: readonly (readonly [number, number])[] = [
  [-3, 3],
  [0.1, 3.5],
  [-1, 1],
  [1, 6],
];

function samplePoint(rng: Rng, variables: readonly string[], trial: number): Record<string, number> {
  const [lo, hi] = RANGES[trial % RANGES.length] ?? [-3, 3];
  const scope: Record<string, number> = {};
  for (const v of variables) scope[v] = lo + (hi - lo) * rng();
  return scope;
}

export type Equivalence = "equivalent" | "different" | "undetermined";

export function equivalent(a: CompiledExpression, b: CompiledExpression, seed = 12345): Equivalence {
  const variables = [...new Set([...a.variables, ...b.variables])];
  const rng = createRng(seed);
  let valid = 0;
  for (let trial = 0; trial < MAX_TRIALS && valid < REQUIRED_POINTS; trial++) {
    const scope = samplePoint(rng, variables, trial);
    let va: number;
    let vb: number;
    try {
      va = a.evaluate(scope);
      vb = b.evaluate(scope);
    } catch {
      continue;
    }
    if (!Number.isFinite(va) || !Number.isFinite(vb) || Math.abs(va) > 1e9) continue;
    if (Math.abs(va - vb) > Math.max(ABS_TOL, REL_TOL * Math.max(Math.abs(va), Math.abs(vb)))) return "different";
    valid++;
    // Sin variables basta un punto.
    if (variables.length === 0) return "equivalent";
  }
  return valid >= REQUIRED_POINTS ? "equivalent" : "undetermined";
}

/** Compara la expresión del usuario con la oficial. Lanza `ExpressionError` si la del usuario no se entiende. */
export function symbolicMatch(user: string, expected: string | number, variables?: readonly string[]): Equivalence {
  const exp = compileExpression(String(expected));
  const allowed = variables && variables.length ? [...new Set([...variables, ...exp.variables])] : exp.variables.length ? null : [];
  const usr = compileExpression(user, allowed);
  return equivalent(usr, exp);
}
