import { CONFIG, type Difficulty } from "./config";
import type { Rng } from "./rng";
import { estimatedMs } from "./srs";

/**
 * Dificultad adaptativa (docs/03, "Flujo"): apunta a ~80–85 % de acierto. Tras 2 errores
 * seguidos baja un nivel y muestra un ejemplo resuelto; tras 4 aciertos rápidos seguidos sube.
 */

export interface FlowItem {
  readonly exerciseId: string;
  readonly difficulty: Difficulty;
  readonly concepts: readonly string[];
  readonly estimatedSeconds?: number;
}

export interface FlowAnswer {
  readonly exerciseId: string;
  readonly correct: boolean;
  readonly timeMs: number;
  readonly difficulty: Difficulty;
  readonly concepts: readonly string[];
  readonly estimatedSeconds?: number;
}

export interface FlowDecision {
  readonly level: Difficulty;
  /** Mostrar un ejemplo resuelto antes del siguiente ejercicio. */
  readonly showWorked: boolean;
  readonly change: "up" | "down" | null;
}

const clampLevel = (n: number): Difficulty => Math.min(5, Math.max(1, Math.round(n))) as Difficulty;

const sharesConcept = (a: FlowAnswer, b: FlowAnswer) => a.concepts.some((c) => b.concepts.includes(c));

export function nextFlow(level: Difficulty, history: readonly FlowAnswer[]): FlowDecision {
  const down = CONFIG.flow.downAfterErrors;
  const lastErrors = history.slice(-down);
  if (lastErrors.length === down && lastErrors.every((h) => !h.correct)) {
    const [first, ...rest] = lastErrors;
    if (first && rest.every((h) => sharesConcept(first, h))) return { level: clampLevel(level - 1), showWorked: true, change: level > 1 ? "down" : null };
  }
  const up = CONFIG.flow.upAfterFastCorrect;
  const lastHits = history.slice(-up);
  const fast = (h: FlowAnswer) => h.correct && h.timeMs < CONFIG.flow.fastFactor * estimatedMs(h.difficulty, h.estimatedSeconds);
  if (lastHits.length === up && lastHits.every(fast)) return { level: clampLevel(level + 1), showWorked: false, change: level < 5 ? "up" : null };
  return { level, showWorked: false, change: null };
}

/** Nivel inicial: la dificultad más baja que todavía no resuelves. */
export function initialLevel(pool: readonly FlowItem[], solved: ReadonlySet<string>): Difficulty {
  const open = pool.filter((p) => !solved.has(p.exerciseId)).map((p) => p.difficulty);
  return clampLevel(open.length ? Math.min(...open) : Math.max(1, ...pool.map((p) => p.difficulty)));
}

export interface PickContext {
  readonly level: Difficulty;
  /** Resueltos alguna vez. */
  readonly solved: ReadonlySet<string>;
  /** Respondidos en esta sesión. */
  readonly seenNow: ReadonlySet<string>;
  readonly lastId: string | null;
  readonly rng: Rng;
}

/** Elige el ejercicio más cercano al nivel, prefiriendo los no resueltos y no vistos en la sesión. */
export function pickExercise(pool: readonly FlowItem[], ctx: PickContext): FlowItem | null {
  const candidates = pool.filter((p) => p.exerciseId !== ctx.lastId);
  const list = candidates.length ? candidates : pool;
  let best: FlowItem | null = null;
  let bestScore = Infinity;
  for (const p of list) {
    const score =
      10 * Math.abs(p.difficulty - ctx.level) + (ctx.solved.has(p.exerciseId) ? 4 : 0) + (ctx.seenNow.has(p.exerciseId) ? 8 : 0) + ctx.rng();
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/**
 * Ejemplo resuelto para mostrar tras dos errores: un ejercicio del mismo concepto, de menor
 * dificultad y ya visto si se puede, con su explicación.
 */
export function workedExampleFor(pool: readonly FlowItem[], concepts: readonly string[], level: Difficulty, excludeId: string | null): FlowItem | null {
  const same = pool.filter((p) => p.exerciseId !== excludeId && p.concepts.some((c) => concepts.includes(c)));
  const easier = same.filter((p) => p.difficulty <= level).sort((a, b) => a.difficulty - b.difficulty);
  return easier[0] ?? same.sort((a, b) => a.difficulty - b.difficulty)[0] ?? null;
}
