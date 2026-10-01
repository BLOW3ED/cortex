import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonBody } from "@/components/lessons/lesson-body";
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

  return (
    <main>
      <nav aria-label="Ruta">
        <Link href="/">Inicio</Link> / {subject?.name ?? materia}
      </nav>
      <header>
        <p>
          Unidad {unit.number} · {fm.duracion_min} min
          {fm.programa_ref.toLowerCase() === "pendiente" ? " · programa oficial pendiente" : ` · ${fm.programa_ref}`}
        </p>
        <h1>{fm.titulo}</h1>
        <ul aria-label="Conceptos de la lección">
          {fm.conceptos.map((c) => (
            <li key={c}>{conceptNames.get(c) ?? c}</li>
          ))}
        </ul>
      </header>
      <article>
        <LessonBody file={unit.lessonFile} source={readLessonSource(unit)} />
      </article>
      <aside aria-label="Práctica de la unidad">
        <h2>Práctica y jefe</h2>
        <p>
          {unit.exercises.length} ejercicios y el jefe «{unit.boss.nombre}». La práctica jugable llega en la Fase 1.
        </p>
      </aside>
    </main>
  );
}
