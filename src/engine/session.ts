import { type Mastery, masteryRank } from "./mastery";
import { seedFrom } from "./rng";

/**
 * Sesión del día (docs/03, "El bucle diario"): calentamiento con repasos vencidos → misión nueva
 * (lección, práctica o jefe de la unidad actual) → reto cognitivo → cierre con cofre.
 */

export const GYM_GAMES = ["nback", "arithmetic", "sequences"] as const;
export type GymGame = (typeof GYM_GAMES)[number];

export interface UnitState {
  readonly key: string;
  readonly subjectId: string;
  readonly number: number;
  readonly lessonDone: boolean;
  readonly status: Mastery;
  /** Último momento en que se estudió algo de la materia (para alternar materias). */
  readonly subjectLastActivity: number | null;
}

export type MissionStep = { readonly kind: "lesson" | "practice" | "boss"; readonly unitKey: string };

/**
 * Unidad actual de cada materia: la primera (en orden) que todavía no está dominada. Si todas lo
 * están, no hay unidad actual en esa materia.
 */
export function currentUnits(units: readonly UnitState[]): UnitState[] {
  const bySubject = new Map<string, UnitState>();
  for (const u of [...units].sort((a, b) => a.number - b.number)) {
    if (masteryRank(u.status) >= masteryRank("mastered")) continue;
    if (!bySubject.has(u.subjectId)) bySubject.set(u.subjectId, u);
  }
  return [...bySubject.values()];
}

/** Paso de la misión para una unidad: lección si no está completa; práctica hasta "practicada"; luego jefe. */
export function stepFor(u: UnitState): MissionStep {
  if (!u.lessonDone) return { kind: "lesson", unitKey: u.key };
  if (masteryRank(u.status) < masteryRank("practiced")) return { kind: "practice", unitKey: u.key };
  return { kind: "boss", unitKey: u.key };
}

/**
 * Misión de hoy: se alterna de materia eligiendo la que lleva más tiempo sin estudiarse
 * (nunca estudiada primero); en empate, el orden del plan.
 */
export function chooseMission(units: readonly UnitState[], subjectOrder: readonly string[]): MissionStep | null {
  const current = currentUnits(units);
  if (!current.length) return null;
  const order = (s: string) => {
    const i = subjectOrder.indexOf(s);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const sorted = [...current].sort(
    (a, b) =>
      (a.subjectLastActivity ?? -1) - (b.subjectLastActivity ?? -1) || order(a.subjectId) - order(b.subjectId),
  );
  const first = sorted[0];
  return first ? stepFor(first) : null;
}

/** El minijuego rota de dominio cada día. */
export function gymGameFor(day: string): GymGame {
  return GYM_GAMES[seedFrom(`gym/${day}`) % GYM_GAMES.length] ?? "arithmetic";
}

export type SessionPhase = "warmup" | "mission" | "gym" | "close";

export interface DailyPlan {
  readonly warmup: readonly string[];
  readonly mission: MissionStep | null;
  readonly gym: GymGame;
}

/** Fases que sí tienen algo que hacer, en orden. */
export function phasesOf(plan: DailyPlan): SessionPhase[] {
  const out: SessionPhase[] = [];
  if (plan.warmup.length) out.push("warmup");
  if (plan.mission) out.push("mission");
  out.push("gym", "close");
  return out;
}
