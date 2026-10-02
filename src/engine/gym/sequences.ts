import { pick, randInt, type Rng } from "../rng";

/**
 * Secuencias con regla oculta (docs/06, razonamiento lógico): se muestran 5 términos y se pide
 * el siguiente. El nivel (1–8) desbloquea reglas más difíciles.
 */

export interface SequenceItem {
  readonly terms: readonly number[];
  readonly answer: number;
  readonly rule: string;
  readonly level: number;
}

type Rule = (rng: Rng) => { terms: number[]; rule: string };

const take = (f: (i: number) => number, n = 6) => Array.from({ length: n }, (_, i) => f(i));

const RULES_BY_LEVEL: readonly (readonly Rule[])[] = [
  // 1: progresión aritmética creciente
  [(r) => { const a = randInt(r, 1, 20); const d = randInt(r, 2, 9); return { terms: take((i) => a + d * i), rule: `suma ${d}` }; }],
  // 2: aritmética con resta
  [(r) => { const a = randInt(r, 40, 90); const d = randInt(r, 2, 9); return { terms: take((i) => a - d * i), rule: `resta ${d}` }; }],
  // 3: geométrica
  [(r) => { const a = randInt(r, 1, 5); const q = randInt(r, 2, 3); return { terms: take((i) => a * q ** i), rule: `multiplica por ${q}` }; }],
  // 4: cuadrados y cuadrados desplazados
  [(r) => { const s = randInt(r, 1, 6); return { terms: take((i) => (i + s) ** 2), rule: "cuadrados consecutivos" }; },
   (r) => { const c = randInt(r, 1, 5); return { terms: take((i) => (i + 1) ** 2 + c), rule: `cuadrados más ${c}` }; }],
  // 5: diferencias crecientes
  [(r) => { const a = randInt(r, 1, 10); const d = randInt(r, 1, 4); return { terms: take((i) => a + d * ((i * (i + 1)) / 2)), rule: `las diferencias crecen de ${d} en ${d}` }; }],
  // 6: tipo Fibonacci
  [(r) => { const a = randInt(r, 1, 5); const b = randInt(r, 1, 6); const t = [a, b]; while (t.length < 6) t.push((t[t.length - 1] ?? 0) + (t[t.length - 2] ?? 0)); return { terms: t, rule: "cada término es la suma de los dos anteriores" }; }],
  // 7: alternada (dos progresiones intercaladas)
  [(r) => { const a = randInt(r, 1, 10); const b = randInt(r, 20, 40); const d = randInt(r, 2, 5); const e = randInt(r, 2, 5); return { terms: take((i) => (i % 2 === 0 ? a + d * (i / 2) : b - e * ((i - 1) / 2))), rule: "dos progresiones intercaladas" }; }],
  // 8: ×k + c
  [(r) => { const a = randInt(r, 1, 4); const k = randInt(r, 2, 3); const c = randInt(r, -2, 3) || 1; const t = [a]; while (t.length < 6) t.push((t[t.length - 1] ?? 0) * k + c); return { terms: t, rule: `multiplica por ${k} y suma ${c}` }; }],
];

export function generateSequence(rng: Rng, levelIn: number): SequenceItem {
  const level = Math.min(RULES_BY_LEVEL.length, Math.max(1, Math.round(levelIn)));
  const rule = pick(rng, RULES_BY_LEVEL[level - 1] ?? []);
  const { terms, rule: text } = rule(rng);
  return { terms: terms.slice(0, 5), answer: terms[5] ?? 0, rule: text, level };
}

export const SEQUENCE_MAX_LEVEL = RULES_BY_LEVEL.length;
