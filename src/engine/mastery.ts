import { CONFIG } from "./config";

/**
 * Mapa de maestría (docs/03): sin ver → vista → practicada → dominada → maestría. Las unidades
 * usan los mismos nombres que `unitProgress.status` (new, seen, practiced, mastered, expert).
 */

export const MASTERY_ORDER = ["new", "seen", "practiced", "mastered", "expert"] as const;
export type Mastery = (typeof MASTERY_ORDER)[number];

export const MASTERY_LABELS: Readonly<Record<Mastery, string>> = {
  new: "Sin ver",
  seen: "Vista",
  practiced: "Practicada",
  mastered: "Dominada",
  expert: "Maestría",
};

export const masteryRank = (m: Mastery): number => MASTERY_ORDER.indexOf(m);

export interface ConceptEvidence {
  /** Lo introduce una lección ya completada. */
  readonly lessonDone: boolean;
  /** Intentos en ejercicios que lo usan. */
  readonly attempts: number;
  readonly correct: number;
  /** Se aprobó el jefe de una unidad donde se trabaja. */
  readonly bossPassed: boolean;
  /** Alguna tarjeta suya se acertó en un repaso con intervalo > 21 días. */
  readonly longReviewOk: boolean;
}

export function conceptMastery(e: ConceptEvidence): Mastery {
  const practiced = e.correct >= CONFIG.mastery.practicedCorrect;
  if (practiced && e.bossPassed && e.longReviewOk) return "expert";
  if (practiced && e.bossPassed) return "mastered";
  if (practiced) return "practiced";
  if (e.lessonDone || e.attempts > 0) return "seen";
  return "new";
}

export interface UnitEvidence {
  readonly lessonDone: boolean;
  /** Fracción de los ejercicios de la unidad resueltos al menos una vez. */
  readonly solvedShare: number;
  readonly bossPassed: boolean;
  /** Fracción de las tarjetas de la unidad acertadas en un repaso de > 21 días. */
  readonly longReviewShare: number;
}

export function unitMastery(e: UnitEvidence): Mastery {
  if (e.bossPassed && e.longReviewShare >= CONFIG.boss.expertCardShare) return "expert";
  if (e.bossPassed) return "mastered";
  if (e.solvedShare >= CONFIG.mastery.unitPracticedShare) return "practiced";
  if (e.lessonDone || e.solvedShare > 0) return "seen";
  return "new";
}

/** Prerrequisitos (de la misma materia) que aún están "sin ver": bloquean el concepto. */
export function missingPrerequisites(
  prerequisites: readonly string[],
  states: Readonly<Record<string, Mastery | undefined>>,
): string[] {
  return prerequisites.filter((p) => !p.includes(":") && (states[p] ?? "new") === "new");
}
