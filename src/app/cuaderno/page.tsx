import type { Metadata } from "next";
import { NotebookClient } from "@/components/pages/insight-pages";
import { APP_NAME } from "@/lib/app";

export const metadata: Metadata = { title: `Cuaderno de errores · ${APP_NAME}` };

export default function NotebookPage() {
  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <p className="console-label">Se llena solo</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.03em]">Cuaderno de errores</h1>
        <p className="mt-2 text-ink-2">Cada fallo queda aquí con tu respuesta y la explicación. Primero las «ilusiones de saber»: lo que fallaste estando seguro.</p>
      </header>
      <NotebookClient />
    </div>
  );
}
