import type { ContentIndex, SubjectSummary, UnitEntry } from "./model";

export interface SemesterGroup {
  readonly n: number;
  readonly credits: number;
  readonly subjects: readonly SubjectSummary[];
}

export interface AvailableLesson {
  readonly subjectId: string;
  readonly subjectName: string;
  readonly unit: Pick<UnitEntry, "key" | "slug" | "number"> & { readonly title: string; readonly minutes: number };
}

export interface HomeModel {
  readonly semesters: readonly SemesterGroup[];
  readonly electives: readonly SubjectSummary[];
  readonly lessons: readonly AvailableLesson[];
  readonly totals: { readonly subjects: number; readonly withContent: number; readonly units: number };
}

/** Datos del inicio: el plan por semestre, el catálogo de optativas y las lecciones disponibles. */
export function buildHomeModel(index: ContentIndex): HomeModel {
  const bySemester = new Map<number, SubjectSummary[]>();
  for (const s of index.subjects) {
    if (s.semester === null) continue;
    bySemester.set(s.semester, [...(bySemester.get(s.semester) ?? []), s]);
  }
  const semesters = index.plan.semestres.map((sem) => ({
    n: sem.n,
    credits: sem.creditos,
    subjects: bySemester.get(sem.n) ?? [],
  }));
  const nameOf = new Map(index.subjects.map((s) => [s.id, s.name]));
  const lessons = Object.values(index.content).flatMap((c) =>
    c.units.map(
      (u): AvailableLesson => ({
        subjectId: c.id,
        subjectName: nameOf.get(c.id) ?? c.id,
        unit: { key: u.key, slug: u.slug, number: u.number, title: u.frontmatter.titulo, minutes: u.frontmatter.duracion_min },
      }),
    ),
  );
  const planned = index.subjects.filter((s) => s.semester !== null && !s.electiveSlot);
  return {
    semesters,
    electives: index.subjects.filter((s) => s.elective),
    lessons,
    totals: {
      subjects: planned.length,
      withContent: index.subjects.filter((s) => s.hasContent).length,
      units: lessons.length,
    },
  };
}
