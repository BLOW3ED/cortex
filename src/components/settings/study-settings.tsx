"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Download } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { setPreferences } from "@/db/progress";
import { useCortexDb, useProfileRecord } from "@/db/use-profile";
import { chestOdds } from "@/engine/chest";
import { CONFIG } from "@/engine/config";
import { downloadText } from "@/lib/download";

function Toggle({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        <p id={`${id}-desc`} className="mt-1 text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch id={id} aria-describedby={`${id}-desc`} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

/** Tema y modo sano (docs/03): preferencias guardadas en el perfil. */
export function StudyPreferences() {
  const db = useCortexDb();
  const ready = db.status === "ready" ? db.db : null;
  const profile = useProfileRecord(ready);
  const prefs = profile?.preferences;
  return (
    <div className="grid gap-6">
      <Toggle
        label="Tema claro"
        description="El tema oscuro es el de siempre; el claro sirve con mucha luz."
        checked={prefs?.theme === "light"}
        disabled={!ready || !prefs}
        onChange={(v) => ready && void setPreferences(ready, { theme: v ? "light" : "dark" })}
      />
      <Toggle
        label="Modo sano"
        description={`Tras ${CONFIG.healthy.minutes} minutos de estudio en un día te sugiere descansar y ya no suma XP ni racha ese día.`}
        checked={prefs?.healthyMode ?? false}
        disabled={!ready || !prefs}
        onChange={(v) => ready && void setPreferences(ready, { healthyMode: v })}
      />
    </div>
  );
}

/** Probabilidades exactas del cofre (la recompensa variable es transparente). */
export function ChestOddsTable() {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Probabilidades del cofre del día</caption>
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1 font-medium">Premio</th>
          <th className="py-1 text-right font-medium">Probabilidad</th>
        </tr>
      </thead>
      <tbody>
        {chestOdds().map((o) => (
          <tr key={o.kind} className="border-t">
            <td className="py-2">{o.label}</td>
            <td className="py-2 text-right font-mono tabular-nums">{Math.round(o.probability * 100)}%</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2} className="pt-2 text-xs text-muted-foreground">
            Si un premio no aplica (congelamientos al máximo, ya tienes todos los marcos), se cambia por XP: nunca sale vacío.
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

/** Reportes de problemas (docs/07, capa 5): se exportan para que Claude Code los corrija. */
export function ReportsPanel() {
  const db = useCortexDb();
  const reports = useLiveQuery(async () => (db.status === "ready" ? db.db.reports.toArray() : undefined), [db]);
  return (
    <div className="grid gap-3">
      <p className="text-sm text-ink-2">
        {reports === undefined ? "…" : reports.length === 0 ? "No hay reportes guardados." : `${reports.length} ${reports.length === 1 ? "reporte guardado" : "reportes guardados"}.`} Descárgalos y pásaselos a Claude Code: «corrige estos reportes».
      </p>
      <div>
        <Button
          variant="secondary"
          disabled={!reports?.length}
          onClick={() => {
            const lines = (reports ?? []).map((r) => `- ${r.exerciseId} (${new Date(r.createdAt).toLocaleString("es-MX")}): ${r.comment.replace(/\n/g, " ")}`);
            downloadText(`cortex-reportes-${new Date().toISOString().slice(0, 10)}.md`, `# Reportes de contenido\n\n${lines.join("\n")}\n`, "text/markdown");
          }}
        >
          <Download aria-hidden /> Descargar reportes
        </Button>
      </div>
    </div>
  );
}
