import { CONFIG } from "./config";
import { addDays, daysBetween, weekStart } from "./dates";

/**
 * Liga semanal personal (docs/03): tu XP de la semana contra el promedio de tus 4 semanas
 * anteriores. Sin presión externa: es tu propio ritmo.
 */

export interface LeagueState {
  /** Índice en `CONFIG.league.divisions` (0 = Bronce). */
  readonly division: number;
  /** Lunes de la última semana ya evaluada. */
  readonly weekKey: string | null;
}

export const START_LEAGUE: LeagueState = { division: 0, weekKey: null };

export interface DayXp {
  readonly day: string;
  readonly xp: number;
}

export function weekXp(days: readonly DayXp[], monday: string): number {
  return days.filter((d) => weekStart(d.day) === monday).reduce((s, d) => s + d.xp, 0);
}

/**
 * Promedio de las semanas anteriores a `monday` (hasta 4), contando solo desde la primera
 * semana con actividad. `null` si no hay ninguna semana anterior con historia.
 */
export function baseline(days: readonly DayXp[], monday: string): number | null {
  const active = days.filter((d) => d.xp > 0).map((d) => weekStart(d.day));
  if (active.length === 0) return null;
  const first = active.reduce((a, b) => (a < b ? a : b));
  const weeks: number[] = [];
  for (let i = 1; i <= CONFIG.league.weeksBack; i++) {
    const w = addDays(monday, -7 * i);
    if (daysBetween(first, w) < 0) break;
    weeks.push(weekXp(days, w));
  }
  if (weeks.length === 0) return null;
  return weeks.reduce((s, x) => s + x, 0) / weeks.length;
}

export function ratioFor(days: readonly DayXp[], monday: string): number | null {
  const b = baseline(days, monday);
  if (b === null || b <= 0) return null;
  return weekXp(days, monday) / b;
}

export function divisionDelta(ratio: number | null): -1 | 0 | 1 {
  if (ratio === null) return 0;
  if (ratio >= CONFIG.league.up) return 1;
  if (ratio < CONFIG.league.down) return -1;
  return 0;
}

/** Evalúa las semanas que ya terminaron desde la última evaluación y mueve la división. */
export function evaluateLeague(state: LeagueState, days: readonly DayXp[], today: string): { state: LeagueState; moves: { week: string; delta: -1 | 0 | 1 }[] } {
  const current = weekStart(today);
  const max = CONFIG.league.divisions.length - 1;
  if (state.weekKey === null) return { state: { ...state, weekKey: current }, moves: [] };
  let division = state.division;
  const moves: { week: string; delta: -1 | 0 | 1 }[] = [];
  // Cada semana completa entre la última evaluada y la actual (máximo 52 para no iterar sin fin).
  for (let w = state.weekKey, n = 0; daysBetween(w, current) > 0 && n < 52; w = addDays(w, 7), n++) {
    const delta = divisionDelta(ratioFor(days, w));
    division = Math.min(max, Math.max(0, division + delta));
    moves.push({ week: w, delta });
  }
  return { state: { division, weekKey: current }, moves };
}

export function divisionName(i: number): string {
  return CONFIG.league.divisions[Math.min(Math.max(0, i), CONFIG.league.divisions.length - 1)] ?? "";
}
