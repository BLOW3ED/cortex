import type { CatalogExercise, CatalogUnit, StudyCatalog } from "@/content/core/study-catalog";
import type { CortexDb } from "@/db/db";
import type { ExerciseRef, UnitRef } from "@/db/progress";
import type { Difficulty } from "@/engine/config";
import type { MissionContext } from "@/engine/missions";

/** Puentes entre el catálogo de contenido y la capa de progreso. */

export function exerciseRef(ex: CatalogExercise): ExerciseRef {
  return {
    id: ex.id,
    unitKey: ex.unitKey,
    subjectId: ex.subjectId,
    difficulty: ex.dificultad as Difficulty,
    concepts: ex.conceptos,
    card: ex.tarjeta !== false,
    ...(ex.tiempo_estimado_s !== undefined ? { estimatedSeconds: ex.tiempo_estimado_s } : {}),
    ...("lenguaje" in ex && typeof ex.lenguaje === "string" ? { language: ex.lenguaje } : {}),
  };
}

export function unitRef(u: CatalogUnit): UnitRef {
  return { key: u.key, subjectId: u.subjectId, exerciseIds: u.exerciseIds, cardIds: u.cardIds };
}

export function allUnits(catalog: StudyCatalog): CatalogUnit[] {
  return catalog.subjects.flatMap((s) => s.units);
}

/** Contexto para generar las misiones del día. */
export async function missionContext(db: CortexDb, catalog: StudyCatalog, now: number): Promise<MissionContext> {
  const known = new Set(Object.keys(catalog.exercises));
  const dueReviews = await db.cards.where("due").belowOrEqual(now).filter((c) => known.has(c.exerciseId)).count();
  const done = new Set((await db.unitProgress.toArray()).filter((u) => u.lessonDone).map((u) => u.unitKey));
  return { dueReviews, lessonAvailable: allUnits(catalog).some((u) => !done.has(u.key)) };
}

export function unitHref(u: Pick<CatalogUnit, "subjectId" | "slug">, tail = ""): string {
  return `/materias/${u.subjectId}/${u.slug}${tail}`;
}
