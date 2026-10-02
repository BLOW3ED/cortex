"use client";

import { useEffect, useRef } from "react";
import type { Confidence } from "@/engine/xp";
import { cn } from "@/lib/utils";

const LEVELS: readonly { value: Confidence; label: string; hint: string }[] = [
  { value: 1, label: "Adivino", hint: "No estoy seguro" },
  { value: 2, label: "Creo que sí", hint: "Bastante seguro" },
  { value: 3, label: "Seguro", hint: "Lo sé" },
];

/**
 * Calibración de confianza (docs/03): antes de ver si acertaste, marcas qué tan seguro estás.
 * Teclas 1, 2 y 3. Acertar con "Seguro" da un pequeño bonus; fallar con "Seguro" marca una
 * "ilusión de saber" que se repasa primero.
 */
export function ConfidencePicker({ onPick, onCancel }: { onPick: (c: Confidence) => void; onCancel?: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        e.preventDefault();
        onPick(Number(e.key) as Confidence);
      } else if (e.key === "Escape" && onCancel) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPick, onCancel]);

  return (
    <fieldset className="rounded-lg border border-border-strong bg-surface p-4">
      <legend className="console-label px-1">Antes de ver el resultado · ¿qué tan seguro estás?</legend>
      <div className="mt-1 grid gap-2 sm:grid-cols-3">
        {LEVELS.map((l, i) => (
          <button
            key={l.value}
            ref={i === 0 ? first : undefined}
            type="button"
            onClick={() => onPick(l.value)}
            className={cn(
              "arcade flex items-center gap-3 rounded-md border-2 border-border-strong bg-surface-2 px-3 py-2.5 text-left hover:border-brand",
            )}
          >
            <span className="kbd" aria-hidden>
              {l.value}
            </span>
            <span>
              <span className="block font-semibold">{l.label}</span>
              <span className="block text-xs text-muted-foreground">{l.hint}</span>
            </span>
          </button>
        ))}
      </div>
      {onCancel ? (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="kbd">Esc</span> para corregir tu respuesta.
        </p>
      ) : null}
    </fieldset>
  );
}
