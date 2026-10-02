import { CONFIG } from "./config";
import type { DayStats } from "./day";
import { createRng, seedFrom, shuffle } from "./rng";

/** Misiones diarias (docs/03): 3 por día, elegidas con la semilla del día, 30 XP cada una. */

export type MissionKind = "correct" | "reviews" | "high-confidence" | "hard" | "gym" | "lesson" | "combo";

export interface MissionDef {
  readonly kind: MissionKind;
  readonly target: number;
  readonly label: (target: number) => string;
  readonly metric: (d: DayStats) => number;
}

export const MISSIONS: Readonly<Record<MissionKind, MissionDef>> = {
  correct: { kind: "correct", target: 10, label: (t) => `Resuelve ${t} ejercicios bien`, metric: (d) => d.correct },
  reviews: { kind: "reviews", target: 5, label: (t) => `Haz ${t} repasos`, metric: (d) => d.reviews },
  "high-confidence": {
    kind: "high-confidence",
    target: 3,
    label: (t) => `Acierta ${t} con confianza alta`,
    metric: (d) => d.highConfCorrect,
  },
  hard: { kind: "hard", target: 2, label: (t) => `Resuelve ${t} retos de dificultad 4 o 5`, metric: (d) => d.hardCorrect },
  gym: { kind: "gym", target: 1, label: () => "Juega un reto del gimnasio", metric: (d) => d.gymGames },
  lesson: { kind: "lesson", target: 1, label: () => "Completa una lección con su mini quiz", metric: (d) => d.lessons },
  combo: { kind: "combo", target: 5, label: (t) => `Encadena ${t} aciertos seguidos`, metric: (d) => d.bestCombo },
};

export interface Mission {
  readonly key: string;
  readonly day: string;
  readonly slot: number;
  readonly kind: MissionKind;
  readonly target: number;
  readonly progress: number;
  readonly completed: boolean;
}

export interface MissionContext {
  /** Tarjetas vencidas hoy (sin ellas no tiene sentido pedir repasos). */
  readonly dueReviews: number;
  /** Hay una lección sin completar disponible. */
  readonly lessonAvailable: boolean;
}

/** Misiones del día, reproducibles: el mismo día y contexto dan las mismas misiones. */
export function generateMissions(day: string, ctx: MissionContext): Mission[] {
  const kinds = (Object.keys(MISSIONS) as MissionKind[]).filter(
    (k) => (k !== "reviews" || ctx.dueReviews >= MISSIONS.reviews.target) && (k !== "lesson" || ctx.lessonAvailable),
  );
  const chosen = shuffle(createRng(seedFrom(`misiones/${day}`)), kinds).slice(0, CONFIG.missions.perDay);
  return chosen.map((kind, slot) => ({
    key: `${day}/${slot}`,
    day,
    slot,
    kind,
    target: MISSIONS[kind].target,
    progress: 0,
    completed: false,
  }));
}

/** Avance de las misiones con los contadores del día; reporta cuáles se completaron ahora. */
export function updateMissions(missions: readonly Mission[], d: DayStats): { missions: Mission[]; justCompleted: Mission[] } {
  const justCompleted: Mission[] = [];
  const next = missions.map((m) => {
    const progress = Math.min(m.target, MISSIONS[m.kind].metric(d));
    const completed = m.completed || progress >= m.target;
    const updated = { ...m, progress, completed };
    if (completed && !m.completed) justCompleted.push(updated);
    return updated;
  });
  return { missions: next, justCompleted };
}

export function missionLabel(m: Pick<Mission, "kind" | "target">): string {
  return MISSIONS[m.kind].label(m.target);
}
