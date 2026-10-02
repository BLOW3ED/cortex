import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/app";

/** Marco de todas las páginas: salto al contenido, barra superior (con lugar para el HUD) y pie. */
export function AppShell({ children, hud }: { children: ReactNode; hud?: ReactNode }) {
  return (
    <>
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-40 border-b bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 rounded-sm font-mono text-sm font-semibold tracking-[0.2em] uppercase">
            <span aria-hidden className="arcade grid size-7 place-items-center rounded-sm border-2 border-[var(--shadow-color)] bg-brand text-xs font-bold text-brand-ink">
              C
            </span>
            <span className="sr-only sm:not-sr-only">{APP_NAME}</span>
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-0.5 text-sm text-ink-2 sm:gap-1">
            <Link href="/" className="rounded-md px-2 py-1.5 hover:bg-surface-2 hover:text-ink sm:px-2.5">
              Inicio
            </Link>
            {/* En pantallas muy angostas el propio HUD lleva a Progreso. */}
            <Link href="/progreso" className="hidden rounded-md px-2 py-1.5 hover:bg-surface-2 hover:text-ink min-[400px]:inline sm:px-2.5">
              Progreso
            </Link>
            <Link href="/ajustes" className="hidden rounded-md px-2 py-1.5 hover:bg-surface-2 hover:text-ink sm:px-2.5 md:inline">
              Ajustes
            </Link>
          </nav>
          <div className="ml-auto">{hud}</div>
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-8 outline-none sm:px-6 sm:py-12">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pt-4 pb-10 sm:px-6">
        <p className="console-label">
          Tus datos viven solo en este navegador ·{" "}
          <Link href="/ajustes" className="underline underline-offset-2 hover:text-ink">
            ajustes y respaldo
          </Link>{" "}
          ·{" "}
          <Link href="/estilo" className="underline underline-offset-2 hover:text-ink">
            sistema visual
          </Link>
        </p>
      </footer>
    </>
  );
}
