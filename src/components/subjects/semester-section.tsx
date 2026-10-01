import type { SemesterGroup } from "@/content/core/home-model";
import { SubjectCard } from "./subject-card";

/** Un semestre del mapa: numeral grande en mono a la izquierda, materias a la derecha. */
export function SemesterSection({ group, tracks }: { group: SemesterGroup; tracks: Readonly<Record<string, string>> }) {
  const id = `semestre-${group.n}`;
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t pt-6 md:grid-cols-[7rem_minmax(0,1fr)]">
      <header>
        <h3 id={id} className="sr-only">
          Semestre {group.n}
        </h3>
        <p aria-hidden className="font-mono text-5xl leading-none font-semibold text-ink-2 tabular-nums">
          {String(group.n).padStart(2, "0")}
        </p>
        <p className="console-label mt-2">{group.credits} créditos</p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {group.subjects.map((s) => (
          <SubjectCard key={s.id} subject={s} trackName={tracks[s.track ?? ""] ?? null} />
        ))}
      </ul>
    </section>
  );
}
