import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SingleExerciseClient } from "@/components/pages/study-pages";
import { getContentIndex } from "@/content/server";
import { APP_NAME } from "@/lib/app";

// Un ejercicio suelto (desde el cuaderno de errores o la autopsia). Solo existen los del índice.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.entries(getContentIndex().exercises)
    .filter(([, loc]) => !loc.retired)
    .map(([id]) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/ejercicios/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Ejercicio ${id} · ${APP_NAME}` };
}

export default async function ExercisePage({ params }: PageProps<"/ejercicios/[id]">) {
  const { id } = await params;
  const loc = getContentIndex().exercises[id];
  if (!loc || loc.retired) notFound();
  return (
    <div className="max-w-4xl">
      <SingleExerciseClient exerciseId={id} />
    </div>
  );
}
