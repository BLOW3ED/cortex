import { CONFIG } from "./config";
import { addDays, daysBetween } from "./dates";

/**
 * Racha con perdón (docs/03): cuenta el día si se cumple la misión mínima; los congelamientos
 * cubren días sin estudiar; si se rompe, una doble misión en 48 h la repara. Sin culpa.
 */

export interface StreakState {
  readonly current: number;
  readonly max: number;
  readonly freezes: number;
  /** Último día en que se cumplió la misión mínima. */
  readonly lastDay: string | null;
  /** Reparación disponible tras romper la racha. */
  readonly repair: { readonly previous: number; readonly deadline: string } | null;
}

export type StreakEvent =
  | { readonly kind: "started" }
  | { readonly kind: "extended"; readonly current: number }
  | { readonly kind: "freeze-used"; readonly count: number }
  | { readonly kind: "freeze-earned"; readonly freezes: number }
  | { readonly kind: "broken"; readonly previous: number; readonly deadline: string }
  | { readonly kind: "repaired"; readonly current: number };

export const EMPTY_STREAK: StreakState = { current: 0, max: 0, freezes: 0, lastDay: null, repair: null };

export interface DayProgress {
  readonly correct: number;
  readonly reviewBlockDone: boolean;
}

/** Misión mínima: 3 correctos o un repaso completo. */
export function minimumMet(d: DayProgress, multiplier = 1): boolean {
  if (multiplier <= 1) return d.correct >= CONFIG.streak.minCorrect || d.reviewBlockDone;
  // Doble misión: el doble de correctos, o el repaso completo más la misión de correctos.
  return d.correct >= CONFIG.streak.minCorrect * multiplier || (d.reviewBlockDone && d.correct >= CONFIG.streak.minCorrect);
}

/** Se llama cuando el día `today` cumple la misión mínima por primera vez. */
export function onMinimumMet(s: StreakState, today: string): { state: StreakState; events: StreakEvent[] } {
  if (s.lastDay === today) return { state: s, events: [] };
  const events: StreakEvent[] = [];
  let { current, freezes, repair } = s;
  if (s.lastDay === null || current === 0) {
    current = 1;
    events.push({ kind: "started" });
  } else {
    const missed = daysBetween(s.lastDay, today) - 1;
    if (missed <= 0) {
      current += 1;
      events.push({ kind: "extended", current });
    } else if (missed <= freezes) {
      freezes -= missed;
      current += 1;
      events.push({ kind: "freeze-used", count: missed }, { kind: "extended", current });
    } else {
      const deadline = addDays(today, CONFIG.streak.repairDays - 1);
      repair = { previous: current, deadline };
      events.push({ kind: "broken", previous: current, deadline });
      current = 1;
    }
  }
  if (current > 0 && current % CONFIG.streak.freezeEvery === 0 && freezes < CONFIG.streak.maxFreezes) {
    freezes += 1;
    events.push({ kind: "freeze-earned", freezes });
  }
  return { state: { current, max: Math.max(s.max, current), freezes, lastDay: today, repair }, events };
}

/** Si hay reparación pendiente y hoy se cumplió la doble misión a tiempo, se recupera la racha. */
export function tryRepair(s: StreakState, today: string, d: DayProgress): { state: StreakState; events: StreakEvent[] } {
  if (!s.repair) return { state: s, events: [] };
  if (daysBetween(today, s.repair.deadline) < 0) return { state: { ...s, repair: null }, events: [] };
  if (!minimumMet(d, CONFIG.streak.repairMultiplier)) return { state: s, events: [] };
  const current = s.repair.previous + s.current;
  return { state: { ...s, current, max: Math.max(s.max, current), repair: null }, events: [{ kind: "repaired", current }] };
}

/**
 * Racha que se muestra hoy: si los días sin estudiar caben en los congelamientos, se conserva
 * ("te guardamos el lugar"); si no, se ve en 0 hasta volver a estudiar.
 */
export function visibleStreak(s: StreakState, today: string): { current: number; atRisk: boolean } {
  if (!s.lastDay || s.current === 0) return { current: 0, atRisk: false };
  const missed = daysBetween(s.lastDay, today) - 1;
  if (missed <= 0) return { current: s.current, atRisk: false };
  if (missed <= s.freezes) return { current: s.current, atRisk: true };
  return { current: 0, atRisk: false };
}
