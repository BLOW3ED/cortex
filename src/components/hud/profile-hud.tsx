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
    const label =
      state.error instanceof FutureSchemaError
        ? "Datos de una versión más nueva"
        : state.error instanceof DbClosedElsewhereError
          ? "Recarga la página"
          : "No pude abrir tus datos";
    return (
      <span
        role="status"
        title={state.error.message}
        className="inline-flex items-center gap-1.5 rounded-sm border border-warning px-2 py-1 font-mono text-xs text-warning"
      >
        <TriangleAlert aria-hidden className="size-3.5" />
        {label}
      </span>
    );
  }
  if (state.status === "loading") return <HudBar data={null} />;
  const p = state.profile;
  // La curva de niveles llega en la Fase 1; sin XP el avance es 0, con XP aún no se calcula.
  return <HudBar data={{ xpTotal: p.xpTotal, level: p.level, currentStreak: p.currentStreak, levelProgress: p.xpTotal === 0 ? 0 : null }} />;
}
