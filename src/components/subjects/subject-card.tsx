import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { SubjectSummary } from "@/content/core/model";
import { cn } from "@/lib/utils";

function phaseLabel(s: SubjectSummary): string {
  return s.cortexPhase === null ? "Backlog" : `Fase ${s.cortexPhase}`;
}

/** Tarjeta de materia: arcade y enlazada si tiene contenido; panel de consola apagado si no. */
export function SubjectCard({ subject, trackName }: { subject: SubjectSummary; trackName: string | null }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className={cn("text-[0.95rem] leading-snug font-semibold text-balance", !subject.hasContent && "text-ink-2")}>
          {subject.name}
        </h3>
        <Badge variant={subject.hasContent ? "brand" : "outline"} className="mt-0.5">
          {subject.electiveSlot ? "Optativa" : phaseLabel(subject)}
        </Badge>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.6875rem] text-muted-foreground uppercase">
        {trackName ? <span>{trackName}</span> : null}
        {subject.credits !== null ? <span aria-hidden>·</span> : null}
        {subject.credits !== null ? <span>{subject.credits} créditos</span> : null}
      </p>
      <p className={cn("mt-3 text-sm", subject.hasContent ? "font-medium text-brand" : "text-muted-foreground")}>
        {subject.hasContent
          ? `Con contenido · ${subject.unitCount} ${subject.unitCount === 1 ? "unidad" : "unidades"}`
          : "Sin contenido aún"}
      </p>
    </>
  );

  if (!subject.hasContent) {
    return (
      <li data-has-content="false" className="rounded-lg border border-border bg-surface/60 p-4">
        {body}
      </li>
    );
  }
  return (
    <li data-has-content="true">
      <Link
        href={`/materias/${subject.id}`}
        className="arcade block h-full rounded-lg border-2 border-border-strong bg-surface p-4 hover:border-brand"
      >
        {body}
      </Link>
    </li>
  );
}
