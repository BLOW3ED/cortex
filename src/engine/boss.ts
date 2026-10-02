import { CONFIG } from "./config";
import { type Rng, shuffle } from "./rng";

/**
 * Jefes (docs/03): examen disfrazado de pelea. 3 oleadas de dificultad creciente, vidas,
 * tiempo global, entrelazado con unidades previas, aprobado con ≥ 80 % y autopsia al final.
 */

export interface BossQuestion {
  readonly exerciseId: string;
  readonly difficulty: number;
  /** Viene de `repaso_de` (unidad anterior). */
  readonly review: boolean;
}

export interface BossPlan {
  readonly waves: readonly (readonly BossQuestion[])[];
  readonly lives: number;
  readonly timeLimitMs: number;
  readonly passRatio: number;
  readonly hardcore: boolean;
}

export interface BossSpec {
  readonly vidas: number;
  readonly tiempo_segundos: number;
  readonly aprobado_minimo: number;
  readonly preguntas: { readonly propias: readonly string[]; readonly repaso_de?: readonly string[] | null };
}

export interface QuestionInfo {
  readonly difficulty: number;
  /** Las autoevaluaciones no entran a jefes cronometrados (docs/05). */
  readonly selfAssessed: boolean;
}

/**
 * Tamaño de cada oleada con el método del mayor residuo (30/40/30 de `n`); en empate, el sobrante
 * va a la oleada más difícil.
 */
export function waveSizes(n: number): number[] {
  const shares = CONFIG.boss.waves;
  const exact = shares.map((s) => s * n);
  const sizes = exact.map(Math.floor);
  let left = n - sizes.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac || b.i - a.i);
  for (const { i } of order) {
    if (left <= 0) break;
    sizes[i] = (sizes[i] ?? 0) + 1;
    left--;
  }
  return sizes;
}

/** Reparte en oleadas 30/40/30 por dificultad; dentro de cada oleada el orden es aleatorio. */
export function planBoss(spec: BossSpec, info: (id: string) => QuestionInfo | undefined, rng: Rng, hardcore = false): BossPlan {
  const own = new Set(spec.preguntas.propias);
  const reviewIds = new Set((spec.preguntas.repaso_de ?? []).filter((id) => !own.has(id)));
  const questions: BossQuestion[] = [];
  for (const id of [...spec.preguntas.propias, ...(spec.preguntas.repaso_de ?? [])]) {
    const q = info(id);
    if (!q || q.selfAssessed || questions.some((x) => x.exerciseId === id)) continue;
    questions.push({ exerciseId: id, difficulty: q.difficulty, review: reviewIds.has(id) });
  }
  // Orden estable por dificultad (desempate aleatorio) y corte en oleadas.
  const sorted = shuffle(rng, questions).sort((a, b) => a.difficulty - b.difficulty);
  const sizes = waveSizes(sorted.length);
  const waves: BossQuestion[][] = [];
  let start = 0;
  for (const size of sizes) {
    waves.push(shuffle(rng, sorted.slice(start, start + size)));
    start += size;
  }
  return {
    waves: waves.filter((w) => w.length > 0),
    lives: hardcore ? CONFIG.boss.hardcoreLives : spec.vidas,
    timeLimitMs: spec.tiempo_segundos * 1000,
    passRatio: spec.aprobado_minimo,
    hardcore,
  };
}

export interface GhostEvent {
  /** Milisegundos desde el inicio. */
  readonly t: number;
  readonly correct: boolean;
}

export type BossStatus = "playing" | "won" | "lost";

export interface BossRun {
  readonly plan: BossPlan;
  readonly queue: readonly BossQuestion[];
  readonly index: number;
  readonly lives: number;
  readonly startedAt: number;
  readonly results: readonly { readonly exerciseId: string; readonly correct: boolean }[];
  readonly events: readonly GhostEvent[];
  readonly status: BossStatus;
  readonly endedAt: number | null;
  readonly endReason: "complete" | "lives" | "time" | null;
}

export function startBoss(plan: BossPlan, now: number): BossRun {
  const queue = plan.waves.flat();
  return {
    plan,
    queue,
    index: 0,
    lives: plan.lives,
    startedAt: now,
    results: [],
    events: [],
    status: queue.length ? "playing" : "lost",
    endedAt: queue.length ? null : now,
    endReason: queue.length ? null : "complete",
  };
}

export function currentQuestion(run: BossRun): BossQuestion | null {
  return run.status === "playing" ? (run.queue[run.index] ?? null) : null;
}

/** Oleada (1, 2 o 3) de la pregunta actual. */
export function currentWave(run: BossRun): number {
  let seen = 0;
  for (let w = 0; w < run.plan.waves.length; w++) {
    seen += run.plan.waves[w]?.length ?? 0;
    if (run.index < seen) return w + 1;
  }
  return run.plan.waves.length;
}

export function bossScore(run: BossRun): number {
  const total = run.queue.length;
  return total ? run.results.filter((r) => r.correct).length / total : 0;
}

export function timeLeftMs(run: BossRun, now: number): number {
  return Math.max(0, run.plan.timeLimitMs - ((run.endedAt ?? now) - run.startedAt));
}

function finish(run: BossRun, now: number, reason: "complete" | "lives" | "time"): BossRun {
  const passed = reason === "complete" && bossScore(run) >= run.plan.passRatio - 1e-9;
  return { ...run, status: passed ? "won" : "lost", endedAt: now, endReason: reason };
}

export function answerBoss(run: BossRun, correct: boolean, now: number): BossRun {
  const q = currentQuestion(run);
  if (!q) return run;
  if (now - run.startedAt > run.plan.timeLimitMs) return finish(run, now, "time");
  const next: BossRun = {
    ...run,
    index: run.index + 1,
    lives: correct ? run.lives : run.lives - 1,
    results: [...run.results, { exerciseId: q.exerciseId, correct }],
    events: [...run.events, { t: now - run.startedAt, correct }],
  };
  if (next.lives <= 0) return finish(next, now, "lives");
  if (next.index >= next.queue.length) return finish(next, now, "complete");
  return next;
}

export function timeoutBoss(run: BossRun, now: number): BossRun {
  return run.status === "playing" ? finish(run, now, "time") : run;
}

/** Ejercicios fallados o que no alcanzaste a contestar, para la autopsia. */
export function autopsy(run: BossRun): { failed: string[]; unanswered: string[] } {
  return {
    failed: run.results.filter((r) => !r.correct).map((r) => r.exerciseId),
    unanswered: run.queue.slice(run.results.length).map((q) => q.exerciseId),
  };
}

/** Aciertos del fantasma (tu mejor intento) hasta el instante `t`. */
export function ghostCorrectAt(events: readonly GhostEvent[], t: number): number {
  return events.filter((e) => e.t <= t && e.correct).length;
}

export interface GhostSummary {
  readonly correct: number;
  readonly timeMs: number;
}

export function ghostSummary(events: readonly GhostEvent[]): GhostSummary {
  return { correct: events.filter((e) => e.correct).length, timeMs: events.length ? (events[events.length - 1]?.t ?? 0) : 0 };
}

/** ¿Este intento le gana al fantasma? Más aciertos, o los mismos en menos tiempo. */
export function beatsGhost(current: GhostSummary, ghost: GhostSummary | null): boolean {
  if (!ghost) return false;
  return current.correct > ghost.correct || (current.correct === ghost.correct && current.timeMs < ghost.timeMs);
}
