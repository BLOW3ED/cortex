import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SkillMapClient } from "@/components/pages/insight-pages";
import { getContentIndex } from "@/content/server";
import { APP_NAME } from "@/lib/app";

export const dynamicParams = false;

export function generateStaticParams() {
  return getContentIndex()
    .subjects.filter((s) => s.hasContent)
    .map((s) => ({ materia: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/materias/[materia]/mapa">): Promise<Metadata> {
  const { materia } = await params;
  const subject = getContentIndex().subjects.find((s) => s.id === materia);
  return { title: subject ? `Mapa · ${subject.name} · ${APP_NAME}` : APP_NAME };
}

export default async function SkillMapPage({ params }: PageProps<"/materias/[materia]/mapa">) {
  const { materia } = await params;
  const subject = getContentIndex().subjects.find((s) => s.id === materia);
  if (!subject?.hasContent) notFound();
  return (
    <div>
      <nav aria-label="Ruta" className="console-label">
        <Link href="/" className="hover:text-ink">
          Inicio
        </Link>{" "}
        /{" "}
        <Link href={`/materias/${materia}`} className="hover:text-ink">
          {subject.name}
        </Link>
      </nav>
      <header className="mt-4 mb-8 max-w-3xl">
        <h1 className="text-4xl font-extrabold tracking-[-0.03em]">Mapa de maestría</h1>
        <p className="mt-2 text-ink-2">Cada concepto pasa de sin ver → vista → practicada → dominada → maestría. Un concepto muestra qué prerrequisito te falta ver.</p>
      </header>
      <SkillMapClient subjectId={materia} />
    </div>
  );
}
