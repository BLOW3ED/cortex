import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonBody } from "@/components/lessons/lesson-body";
import { UnitActions } from "@/components/pages/unit-actions";
import { Badge } from "@/components/ui/badge";
import { getContentIndex, getUnit, readLessonSource } from "@/content/server";
import { APP_NAME } from "@/lib/app";

// Solo existen las unidades del índice; cualquier otra ruta es 404 (y el build falla si el contenido es inválido).
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(getContentIndex().content).flatMap((s) =>
    s.units.map((u) => ({ materia: s.id, unidad: u.slug })),
  );
}

export async function generateMetadata({ params }: PageProps<"/materias/[materia]/[unidad]">): Promise<Metadata> {
  const { materia, unidad } = await params;
  const unit = getUnit(materia, unidad);
  return { title: unit ? `${unit.frontmatter.titulo} · ${APP_NAME}` : APP_NAME };
}

export default async function LessonPage({ params }: PageProps<"/materias/[materia]/[unidad]">) {
  const { materia, unidad } = await params;
  const unit = getUnit(materia, unidad);
  if (!unit) notFound();
  const index = getContentIndex();
  const subject = index.subjects.find((s) => s.id === materia);
  const conceptNames = new Map(index.content[materia]?.concepts?.conceptos.map((c) => [c.id, c.nombre]));
  const fm = unit.frontmatter;
  const pending = fm.programa_ref.trim().toLowerCase() === "pendiente";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div>
        <nav aria-label="Ruta" className="console-label">
          <Link href="/" className="hover:text-ink">
            Inicio
          </Link>{" "}
          /{" "}
          <Link href={`/materias/${materia}`} className="hover:text-ink">
            {subject?.name ?? materia}
          </Link>
        </nav>
        <header className="mt-4 mb-10">
          <p className="font-mono text-sm text-muted-foreground">
            Unidad {String(unit.number).padStart(2, "0")} · {fm.duracion_min} min
          </p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.03em] text-balance sm:text-5xl">{fm.titulo}</h1>
          <ul aria-label="Conceptos de la lección" className="mt-5 flex flex-wrap gap-1.5">
            {fm.conceptos.map((c) => (
              <li key={c}>
                <Badge className="max-w-full text-left whitespace-normal">{conceptNames.get(c) ?? c}</Badge>
              </li>
            ))}
          </ul>
        </header>
        <article className="lesson-prose">
          <LessonBody file={unit.lessonFile} source={readLessonSource(unit)} />
        </article>
      </div>
      <aside aria-label="Práctica de la unidad" className="grid gap-3 lg:sticky lg:top-20 lg:self-start">
        <UnitActions unitKey={unit.key} exerciseCount={unit.exercises.length} bossName={unit.boss.nombre} />
        <p className="px-1 text-xs text-muted-foreground">{pending ? "Programa oficial: pendiente" : `Programa: ${fm.programa_ref}`}</p>
      </aside>
    </div>
  );
}
