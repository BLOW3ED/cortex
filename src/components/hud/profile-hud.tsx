"use client";

import { TriangleAlert } from "lucide-react";
import { DbClosedElsewhereError, FutureSchemaError } from "@/db/db";
import { useProfile } from "@/db/use-profile";
import { HudBar } from "./hud-bar";

/**
 * HUD con el perfil real de IndexedDB. En el servidor y en el primer render dibuja el estado de
 * carga (sin números), así que no hay diferencias de hidratación.
 */
export function ProfileHud() {
  const state = useProfile();
  if (state.status === "error") {
    const [label, short] =
      state.error instanceof FutureSchemaError
        ? ["Datos de una versión más nueva", "Versión nueva"]
        : state.error instanceof DbClosedElsewhereError
          ? ["Recarga la página", "Recarga"]
          : ["No pude abrir tus datos", "Sin datos"];
    return (
      <span
        role="status"
        title={state.error.message}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-warning px-2 py-1 font-mono text-xs whitespace-nowrap text-warning"
      >
        <TriangleAlert aria-hidden className="size-3.5" />
        {/* En móvil, texto corto a la vista; el lector de pantalla siempre oye el completo. */}
        <span aria-hidden className="sm:hidden">
          {short}
        </span>
        <span className="sr-only sm:not-sr-only">{label}</span>
      </span>
    );
  }
  if (state.status === "loading") return <HudBar data={null} />;
  const p = state.profile;
  // La curva de niveles llega en la Fase 1; sin XP el avance es 0, con XP aún no se calcula.
  return <HudBar data={{ xpTotal: p.xpTotal, level: p.level, currentStreak: p.currentStreak, levelProgress: p.xpTotal === 0 ? 0 : null }} />;
}
