import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnitStudyClient } from "@/components/pages/study-pages";
import { getContentIndex, getUnit } from "@/content/server";
import { APP_NAME } from "@/lib/app";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(getContentIndex().content).flatMap((s) => s.units.map((u) => ({ materia: s.id, unidad: u.slug })));
}

export async function generateMetadata({ params }: PageProps<"/materias/[materia]/[unidad]/quiz">): Promise<Metadata> {
  const { materia, unidad } = await params;
  const unit = getUnit(materia, unidad);
  return { title: unit ? `Mini quiz · ${unit.frontmatter.titulo} · ${APP_NAME}` : APP_NAME };
}

export default async function Page({ params }: PageProps<"/materias/[materia]/[unidad]/quiz">) {
  const { materia, unidad } = await params;
  const unit = getUnit(materia, unidad);
  if (!unit) notFound();
  return (
    <div className="max-w-3xl">
      <UnitStudyClient unitKey={unit.key} kind="quiz" />
    </div>
  );
}
