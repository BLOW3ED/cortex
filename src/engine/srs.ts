import { type Card, createEmptyCard, fsrs, type Grade, Rating, type State } from "ts-fsrs";
import { CONFIG, type Difficulty } from "./config";
import { DAY_MS } from "./dates";
import type { Confidence } from "./xp";

/**
 * Envoltura de `ts-fsrs` (ADR-006). La app guarda tarjetas planas (números, sin `Date`) para que
 * IndexedDB y el respaldo JSON las lean igual; aquí se traducen al formato de la librería.
 */

export interface SrsCard {
  readonly exerciseId: string;
  readonly due: number;
  readonly stability: number;
  readonly difficulty: number;
  readonly elapsedDays: number;
  readonly scheduledDays: number;
  readonly learningSteps: number;
  readonly reps: number;
  readonly lapses: number;
  /** 0 nueva, 1 aprendiendo, 2 repaso, 3 reaprendiendo (enum `State` de ts-fsrs). */
  readonly state: number;
  readonly lastReview: number | null;
}

const scheduler = fsrs({
  request_retention: CONFIG.srs.requestRetention,
  maximum_interval: CONFIG.srs.maximumIntervalDays,
  enable_fuzz: false,
});

function toLib(c: SrsCard): Card {
  return {
    due: new Date(c.due),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsedDays,
    scheduled_days: c.scheduledDays,
    learning_steps: c.learningSteps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as State,
    ...(c.lastReview !== null ? { last_review: new Date(c.lastReview) } : {}),
  };
}

function fromLib(exerciseId: string, c: Card): SrsCard {
  return {
    exerciseId,
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    lastReview: c.last_review ? c.last_review.getTime() : null,
  };
}

export function newCard(exerciseId: string, now: number): SrsCard {
  return fromLib(exerciseId, createEmptyCard(new Date(now)));
}

export interface GradeInput {
  readonly correct: boolean;
  readonly hintsUsed: number;
  readonly timeMs: number;
  readonly difficulty: Difficulty;
  readonly estimatedSeconds?: number;
  readonly confidence: Confidence | null;
}

export function estimatedMs(difficulty: Difficulty, estimatedSeconds?: number): number {
  return 1000 * (estimatedSeconds ?? CONFIG.flow.estimatedSecondsByDifficulty[difficulty]);
}

/** Traduce un intento a una calificación FSRS: fallo → Again; con pistas o dudoso → Hard; rápido y seguro → Easy. */
export function gradeFrom(g: GradeInput): Grade {
  if (!g.correct) return Rating.Again;
  if (g.hintsUsed > 0 || g.confidence === 1) return Rating.Hard;
  const fast = g.timeMs < CONFIG.flow.fastFactor * estimatedMs(g.difficulty, g.estimatedSeconds);
  if (fast && g.confidence === 3) return Rating.Easy;
  return Rating.Good;
}

export interface ReviewResult {
  readonly card: SrsCard;
  /** Días desde el repaso anterior (0 si era nueva). */
  readonly elapsedDays: number;
}

export function reviewCard(card: SrsCard, grade: Grade, now: number): ReviewResult {
  const elapsedDays = card.lastReview === null ? 0 : Math.max(0, (now - card.lastReview) / DAY_MS);
  const { card: next } = scheduler.next(toLib(card), new Date(now), grade);
  return { card: fromLib(card.exerciseId, next), elapsedDays };
}

export function isDue(card: SrsCard, now: number): boolean {
  return card.due <= now;
}

/** Intervalo programado en días (para mostrar "vuelve en 3 días"). */
export function intervalDays(card: SrsCard, now: number): number {
  return Math.max(0, (card.due - now) / DAY_MS);
}

/**
 * Cola del calentamiento: tarjetas vencidas. Primero se eligen las marcadas como "ilusión de
 * saber" y las más atrasadas; luego se ordenan de fácil a difícil (docs/03).
 */
export function warmupQueue(
  cards: readonly SrsCard[],
  now: number,
  max: number = CONFIG.srs.warmupMax,
  priority: ReadonlySet<string> = new Set(),
): SrsCard[] {
  const due = cards.filter((c) => isDue(c, now));
  const chosen = [...due]
    .sort((a, b) => Number(priority.has(b.exerciseId)) - Number(priority.has(a.exerciseId)) || a.due - b.due)
    .slice(0, Math.max(0, max));
  return chosen.sort((a, b) => a.difficulty - b.difficulty || a.exerciseId.localeCompare(b.exerciseId));
}

export { Rating };
