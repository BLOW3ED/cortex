"use client";

import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { useCortexDb, useProfileRecord } from "@/db/use-profile";

/** Preferencia de sonido. Apagado por defecto (CLAUDE.md). */
export function SoundToggle() {
  const id = useId();
  const db = useCortexDb();
  const ready = db.status === "ready" ? db.db : null;
  const profile = useProfileRecord(ready);
  const sound = profile?.preferences.sound ?? false;
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <label htmlFor={id} className="font-semibold">
          Sonido
        </label>
        <p id={`${id}-desc`} className="mt-1 text-sm text-muted-foreground">
          Apagado por defecto. Si lo enciendes, suenan avisos cortos al acertar, fallar y subir de nivel.
        </p>
      </div>
      <Switch
        id={id}
        aria-describedby={`${id}-desc`}
        checked={sound}
        disabled={!ready || !profile}
        onCheckedChange={(checked) => {
          void ready?.profile.update(1, { "preferences.sound": checked });
        }}
      />
    </div>
  );
}
