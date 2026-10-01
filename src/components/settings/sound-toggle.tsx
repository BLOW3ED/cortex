"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { useCortexDb } from "@/db/use-profile";

/** Preferencia de sonido. Apagado por defecto; en la Fase 0 solo se guarda (los sonidos llegan en la Fase 1). */
export function SoundToggle() {
  const id = useId();
  const db = useCortexDb();
  const ready = db.status === "ready" ? db.db : null;
  const profile = useLiveQuery(() => ready?.profile.get(1), [ready]);
  const sound = profile?.preferences.sound ?? false;
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <label htmlFor={id} className="font-semibold">
          Sonido
        </label>
        <p id={`${id}-desc`} className="mt-1 text-sm text-muted-foreground">
          Apagado por defecto. Por ahora solo se guarda tu preferencia; los sonidos llegan en la Fase 1.
        </p>
      </div>
      <Switch
        id={id}
        aria-describedby={`${id}-desc`}
        checked={sound}
        disabled={!ready || !profile}
        onCheckedChange={(checked) => {
          void ready?.profile.update(1, { preferences: { ...profile?.preferences, sound: checked } });
        }}
      />
    </div>
  );
}
