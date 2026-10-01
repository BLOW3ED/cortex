import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/app";

export const metadata: Metadata = { title: `Página no encontrada · ${APP_NAME}` };

/** 404 en español: rutas mal escritas o materias que todavía no tienen contenido. */
export default function NotFound() {
  return (
    <div className="max-w-2xl">
      <p className="console-label">Error 404</p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">No encontré esa página</h1>
      <p className="mt-3 text-ink-2">
        Puede que la dirección esté mal escrita o que esa materia todavía no tenga lecciones. Las que ya tienen contenido
        están en el inicio.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
