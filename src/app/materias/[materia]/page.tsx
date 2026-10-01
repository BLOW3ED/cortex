import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getContentIndex } from "@/content/server";
import { APP_NAME } from "@/lib/app";

// Solo las materias con contenido tienen página.
export const dynamicParams = false;

export function generateStaticParams() {
  return getContentIndex()
    .subjects.filter((s) => s.hasContent)
    .map((s) => ({ materia: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/materias/[materia]">): Promise<Metadata> {
  const { materia } = await params;
  const subject = getContentIndex().subjects.find((s) => s.id === materia);
  return { title: subject ? `${subject.name} · ${APP_NAME}` : APP_NAME };
}

export default async function SubjectPage({ params }: PageProps<"/materias/[materia]">) {
  const { materia } = await params;
  const index = getContentIndex();
  const subject = index.subjects.find((s) => s.id === materia);
  const content = index.content[materia];
  if (!subject || !content) notFound();
  const track = subject.track ? index.plan.tracks[subject.track] : null;

  return (
    <div>
      <nav aria-label="Ruta" className="console-label">
        <Link href="/" className="hover:text-ink">
          Inicio
        </Link>{" "}
        / {subject.name}
      </nav>
      <header className="mt-4 max-w-3xl">
        <h1 className="text-4xl font-extrabold tracking-[-0.03em] text-balance sm:text-5xl">{subject.name}</h1>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {subject.semester !== null ? <Badge>Semestre {subject.semester}</Badge> : null}
          {track ? <Badge>{track}</Badge> : null}
          {subject.credits !== null ? <Badge>{subject.credits} créditos</Badge> : null}
          <Badge variant="outline">{subject.cortexPhase === null ? "Backlog" : `Fase ${subject.cortexPhase}`}</Badge>
        </div>
        <p className="mt-4 text-ink-2">
          {content.concepts?.conceptos.length ?? 0} conceptos en el mapa · {content.units.length}{" "}
          {content.units.length === 1 ? "unidad" : "unidades"}
        </p>
      </header>

      <section aria-labelledby="unidades" className="mt-10">
        <h2 id="unidades" className="console-label mb-4">
          Unidades
        </h2>
        <ol className="grid gap-3">
          {content.units.map((u) => (
            <li key={u.key}>
              <Link
                href={`/materias/${materia}/${u.slug}`}
                className="arcade group flex items-center gap-5 rounded-lg border-2 border-border-strong bg-surface p-4 hover:border-brand"
              >
                <span className="font-mono text-4xl font-semibold text-xp tabular-nums">{String(u.number).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold text-balance">{u.frontmatter.titulo}</span>
                  <span className="mt-1 block font-mono text-xs text-muted-foreground">
                    {u.frontmatter.duracion_min} min · {u.exercises.length} ejercicios · jefe «{u.boss.nombre}»
                  </span>
                </span>
                <ArrowRight aria-hidden className="size-5 text-ink-2 group-hover:text-brand" />
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
