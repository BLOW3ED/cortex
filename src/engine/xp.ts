import { CONFIG, type Difficulty } from "./config";

export type Confidence = 1 | 2 | 3;

export interface PracticeXpInput {
  readonly difficulty: Difficulty;
  readonly correct: boolean;
  /** Nunca se había intentado este ejercicio. */
  readonly firstEver: boolean;
  /** Aciertos previos de este mismo ejercicio en el día. */
  readonly correctTodayBefore: number;
  readonly hintsUsed: number;
  readonly confidence: Confidence | null;
}

export interface XpBreakdown {
  readonly total: number;
  readonly parts: readonly { readonly label: string; readonly xp: number }[];
}

const NONE: XpBreakdown = { total: 0, parts: [] };

function hintFactor(hints: number): number {
  return Math.max(CONFIG.xp.hintFloor, 1 - CONFIG.xp.hintCost * Math.max(0, hints));
}

function repeatFactor(correctTodayBefore: number): number {
  const f = CONFIG.xp.repeatFactors;
  return f[Math.min(Math.max(0, correctTodayBefore), f.length - 1)] ?? 0;
}

/**
 * XP de un ejercicio de práctica o de jefe (docs/03). Solo se gana al acertar: sin XP por abrir,
 * leer o repetir en bucle (rendimientos decrecientes por ejercicio en el mismo día).
 */
export function practiceXp(input: PracticeXpInput): XpBreakdown {
  if (!input.correct) return NONE;
  const repeat = repeatFactor(input.correctTodayBefore);
  if (repeat === 0) return NONE;
  const base = CONFIG.xp.byDifficulty[input.difficulty];
  const parts: { label: string; xp: number }[] = [{ label: `Dificultad ${input.difficulty}`, xp: base }];
  if (input.firstEver) parts.push({ label: "Al primer intento", xp: base * CONFIG.xp.firstTryBonus });
  if (input.confidence === 3) parts.push({ label: "Confianza calibrada", xp: CONFIG.xp.calibrationBonus });
  const raw = parts.reduce((s, p) => s + p.xp, 0);
  const factor = repeat * hintFactor(input.hintsUsed);
  const total = Math.round(raw * factor);
  if (factor < 1) parts.push({ label: repeat < 1 ? "Repetido hoy" : "Pistas", xp: total - raw });
  return { total, parts: parts.map((p) => ({ label: p.label, xp: Math.round(p.xp) })) };
}

export interface ReviewXpInput {
  readonly correct: boolean;
  /** Días desde el repaso anterior de la tarjeta (0 si es nueva). */
  readonly elapsedDays: number;
  readonly confidence: Confidence | null;
}

/** XP de un repaso FSRS: 6, +2 si el intervalo era largo, +2 si la confianza alta acertó. */
export function reviewXp(input: ReviewXpInput): XpBreakdown {
  if (!input.correct) return NONE;
  const parts: { label: string; xp: number }[] = [{ label: "Repaso", xp: CONFIG.xp.review }];
  if (input.elapsedDays >= CONFIG.xp.reviewLongDays) parts.push({ label: "Intervalo largo", xp: CONFIG.xp.reviewLongBonus });
  if (input.confidence === 3) parts.push({ label: "Confianza calibrada", xp: CONFIG.xp.calibrationBonus });
  return { total: parts.reduce((s, p) => s + p.xp, 0), parts };
}

/** XP de un jefe aprobado: completo la primera vez, una fracción después. */
export function bossXp(reward: number, alreadyPassed: boolean, beatGhost: boolean): XpBreakdown {
  const base = Math.round(alreadyPassed ? reward * CONFIG.xp.bossRepeatFactor : reward);
  const parts: { label: string; xp: number }[] = [{ label: alreadyPassed ? "Jefe (repetición)" : "Jefe derrotado", xp: base }];
  if (beatGhost) parts.push({ label: "Le ganaste al fantasma", xp: CONFIG.xp.ghostBonus });
  return { total: parts.reduce((s, p) => s + p.xp, 0), parts };
}
