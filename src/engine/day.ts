/**
 * Contadores de un día de estudio. Son la base de la racha, las misiones, la liga y el modo sano.
 * Se guardan en la tabla `days` (una fila por día local).
 */
export interface DayStats {
  readonly day: string;
  readonly xp: number;
  readonly answered: number;
  readonly correct: number;
  readonly reviews: number;
  readonly reviewsCorrect: number;
  /** Se vació la cola del calentamiento con al menos una tarjeta. */
  readonly reviewBlockDone: boolean;
  /** Correctos con confianza alta. */
  readonly highConfCorrect: number;
  /** Correctos de dificultad ≥ 4. */
  readonly hardCorrect: number;
  readonly lessons: number;
  readonly gymGames: number;
  readonly bossesWon: number;
  /** Aciertos seguidos ahora mismo y el máximo del día. */
  readonly combo: number;
  readonly bestCombo: number;
  /** Tiempo activo respondiendo (para el modo sano). */
  readonly activeMs: number;
  readonly minimumMet: boolean;
  readonly chestOpened: boolean;
  readonly sessionDone: boolean;
}

export function emptyDay(day: string): DayStats {
  return {
    day,
    xp: 0,
    answered: 0,
    correct: 0,
    reviews: 0,
    reviewsCorrect: 0,
    reviewBlockDone: false,
    highConfCorrect: 0,
    hardCorrect: 0,
    lessons: 0,
    gymGames: 0,
    bossesWon: 0,
    combo: 0,
    bestCombo: 0,
    activeMs: 0,
    minimumMet: false,
    chestOpened: false,
    sessionDone: false,
  };
}

export interface AnswerEvent {
  readonly correct: boolean;
  readonly review: boolean;
  readonly difficulty: number;
  readonly confidence: 1 | 2 | 3 | null;
  readonly timeMs: number;
  readonly xp: number;
}

/** Tiempo activo máximo que cuenta un solo ejercicio (si dejaste la pestaña abierta, no suma de más). */
export const MAX_ACTIVE_MS_PER_ANSWER = 5 * 60_000;

export function addAnswer(d: DayStats, e: AnswerEvent): DayStats {
  const combo = e.correct ? d.combo + 1 : 0;
  return {
    ...d,
    xp: d.xp + e.xp,
    answered: d.answered + 1,
    correct: d.correct + (e.correct ? 1 : 0),
    reviews: d.reviews + (e.review ? 1 : 0),
    reviewsCorrect: d.reviewsCorrect + (e.review && e.correct ? 1 : 0),
    highConfCorrect: d.highConfCorrect + (e.correct && e.confidence === 3 ? 1 : 0),
    hardCorrect: d.hardCorrect + (e.correct && e.difficulty >= 4 ? 1 : 0),
    combo,
    bestCombo: Math.max(d.bestCombo, combo),
    activeMs: d.activeMs + Math.min(Math.max(0, e.timeMs), MAX_ACTIVE_MS_PER_ANSWER),
  };
}
