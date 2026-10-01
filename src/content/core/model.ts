import type { Boss, ConceptsFile, Exercise, LessonFrontmatter, Plan, RetiredExercise } from "../schema";

/** Archivo leído del repo. `path` es relativo a la raíz y usa `/`. */
export interface RawFile {
  readonly path: string;
  readonly text: string;
}

export interface RawUnit {
  /** Carpeta de la unidad, p. ej. `01-limites`. */
  readonly dir: string;
  readonly lesson: RawFile | null;
  readonly exercises: RawFile | null;
  readonly boss: RawFile | null;
}

export interface RawSubject {
  /** Carpeta de la materia = id del plan, p. ej. `calculo`. */
  readonly dir: string;
  readonly concepts: RawFile | null;
  readonly units: readonly RawUnit[];
}

export interface RawContent {
  readonly plan: RawFile | null;
  readonly subjects: readonly RawSubject[];
}

/** Materia del plan (o del catálogo de optativas) con su estado de contenido. */
export interface SubjectSummary {
  readonly id: string;
  readonly name: string;
  /** Semestre del mapa curricular; `null` para el catálogo de optativas. */
  readonly semester: number | null;
  readonly track: string | null;
  readonly credits: number | null;
  /** Fase de Cortex en la que se construye (`null` = backlog). */
  readonly cortexPhase: number | null;
  /** Espacio de optativa del mapa ("Optativa A"). */
  readonly electiveSlot: boolean;
  /** Materia del catálogo de optativas. */
  readonly elective: boolean;
  readonly hasContent: boolean;
  readonly unitCount: number;
}

/**
 * Unidad lista para usarse. Contrato estable con la Fase 1: `key` (`materia/NN-nombre`) y los ids
 * de ejercicio son las llaves que unen el contenido con Dexie (unitProgress, cards, attempts...).
 */
export interface UnitEntry {
  readonly key: string;
  readonly subjectId: string;
  readonly slug: string;
  readonly number: number;
  readonly lessonFile: string;
  readonly frontmatter: LessonFrontmatter;
  readonly exercises: readonly Exercise[];
  readonly retired: readonly RetiredExercise[];
  readonly boss: Boss;
}

export interface SubjectContent {
  readonly id: string;
  readonly concepts: ConceptsFile | null;
  readonly units: readonly UnitEntry[];
}

export interface ExerciseLocation {
  readonly unitKey: string;
  readonly retired: boolean;
}

export interface ContentIndex {
  readonly plan: Plan;
  /** Materias en orden del mapa curricular, seguidas del catálogo de optativas. */
  readonly subjects: readonly SubjectSummary[];
  readonly content: Readonly<Record<string, SubjectContent>>;
  readonly exercises: Readonly<Record<string, ExerciseLocation>>;
}
