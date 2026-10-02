import type { Boss, Exercise } from "../schema";
import type { ContentIndex } from "./model";

/**
 * Catálogo de estudio para el navegador: todo lo que la sesión, la práctica, el jefe, el repaso y
 * el mapa necesitan, en un JSON estático (`/catalogo.json`) generado en el build. Puro: sin fs.
 */

export interface CatalogConcept {
  readonly id: string;
  readonly name: string;
  readonly prerequisites: readonly string[];
}

export interface CatalogUnit {
  readonly key: string;
  readonly subjectId: string;
  readonly slug: string;
  readonly number: number;
  readonly title: string;
  readonly minutes: number;
  /** Conceptos que introduce la lección. */
  readonly concepts: readonly string[];
  readonly exerciseIds: readonly string[];
  /** Ejercicios que entran al repaso espaciado. */
  readonly cardIds: readonly string[];
  readonly boss: Boss;
}

export interface CatalogSubject {
  readonly id: string;
  readonly name: string;
  readonly semester: number | null;
  readonly phase: number | null;
  readonly notation: string | null;
  readonly concepts: readonly CatalogConcept[];
  readonly units: readonly CatalogUnit[];
}

export type CatalogExercise = Exercise & { readonly unitKey: string; readonly subjectId: string };

export interface StudyCatalog {
  readonly subjects: readonly CatalogSubject[];
  readonly exercises: Readonly<Record<string, CatalogExercise>>;
}

/** ¿El ejercicio entra al repaso espaciado? (`tarjeta` por defecto `true`). */
export function hasCard(ex: Exercise): boolean {
  return ex.tarjeta !== false;
}

export function buildStudyCatalog(index: ContentIndex): StudyCatalog {
  const exercises: Record<string, CatalogExercise> = {};
  const subjects: CatalogSubject[] = [];
  for (const summary of index.subjects) {
    const content = index.content[summary.id];
    if (!content || content.units.length === 0) continue;
    const units = content.units.map((u): CatalogUnit => {
      for (const ex of u.exercises) exercises[ex.id] = { ...ex, unitKey: u.key, subjectId: u.subjectId };
      return {
        key: u.key,
        subjectId: u.subjectId,
        slug: u.slug,
        number: u.number,
        title: u.frontmatter.titulo,
        minutes: u.frontmatter.duracion_min,
        concepts: u.frontmatter.conceptos,
        exerciseIds: u.exercises.map((e) => e.id),
        cardIds: u.exercises.filter(hasCard).map((e) => e.id),
        boss: u.boss,
      };
    });
    subjects.push({
      id: summary.id,
      name: summary.name,
      semester: summary.semester,
      phase: summary.cortexPhase,
      notation: content.concepts?.notacion ?? null,
      concepts: (content.concepts?.conceptos ?? []).map((c) => ({ id: c.id, name: c.nombre, prerequisites: c.prerequisitos ?? [] })),
      units,
    });
  }
  return { subjects, exercises };
}

export function findUnit(catalog: StudyCatalog, key: string): CatalogUnit | undefined {
  for (const s of catalog.subjects) {
    const u = s.units.find((x) => x.key === key);
    if (u) return u;
  }
  return undefined;
}

export function findSubject(catalog: StudyCatalog, id: string): CatalogSubject | undefined {
  return catalog.subjects.find((s) => s.id === id);
}
