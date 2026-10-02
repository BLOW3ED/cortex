import type { Metadata } from "next";
import { GymPageClient } from "@/components/pages/study-pages";
import { APP_NAME } from "@/lib/app";

export const metadata: Metadata = { title: `Gimnasio · ${APP_NAME}` };

export default function GymPage() {
  return (
    <div className="max-w-4xl">
      <header className="mb-8">
        <p className="console-label">Gimnasio cognitivo</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.03em]">Gimnasio</h1>
        <p className="mt-2 max-w-2xl text-ink-2">
          Entrena habilidades útiles para la carrera: memoria de trabajo, cálculo mental y razonamiento. La dificultad se ajusta sola y solo compites contra ti.
        </p>
      </header>
      <GymPageClient />
    </div>
  );
}
