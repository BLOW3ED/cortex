"use client";

import { Award, Flame, Sparkles, Target, TrendingUp, X } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import type { Outcome } from "@/db/progress";
import { missionLabel } from "@/engine/missions";
import { cn } from "@/lib/utils";

/**
 * Celebraciones breves (docs/03): subir de nivel, romper un récord, completar una misión, un logro.
 * Se anuncian con `aria-live` y se van solas; nunca bloquean.
 */

type Tone = "level" | "record" | "mission" | "achievement" | "streak";

interface Toast {
  readonly id: number;
  readonly tone: Tone;
  readonly title: string;
  readonly detail?: string;
}

interface CelebrateApi {
  celebrate(t: Omit<Toast, "id">): void;
  /** Convierte un resultado de la capa de progreso en celebraciones. */
  fromOutcome(o: Partial<Outcome>): void;
}

const Ctx = createContext<CelebrateApi | null>(null);
let nextId = 1;

const ICONS: Record<Tone, typeof Award> = { level: TrendingUp, record: Sparkles, mission: Target, achievement: Award, streak: Flame };

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const celebrate = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = nextId++;
      setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );
  const fromOutcome = useCallback(
    (o: Partial<Outcome>) => {
      if (o.levelAfter !== undefined && o.levelBefore !== undefined && o.levelAfter > o.levelBefore) {
        celebrate({ tone: "level", title: `¡Nivel ${o.levelAfter}!`, detail: "Subiste de nivel." });
      }
      for (const m of o.missionsCompleted ?? []) celebrate({ tone: "mission", title: "Misión completada", detail: `${missionLabel(m)} · +30 XP` });
      for (const r of o.recordsBroken ?? []) celebrate({ tone: "record", title: "Récord personal", detail: `${r.label}: ${r.value}` });
      for (const a of o.achievements ?? []) celebrate({ tone: "achievement", title: `Logro: ${a.name}`, detail: a.description });
      for (const e of o.streakEvents ?? []) {
        if (e.kind === "started") celebrate({ tone: "streak", title: "Misión mínima cumplida", detail: "Hoy ya cuenta para tu racha. Puedes parar cuando quieras." });
        if (e.kind === "extended") celebrate({ tone: "streak", title: `Racha de ${e.current} días`, detail: "Hoy ya cuenta. Puedes parar cuando quieras." });
        if (e.kind === "freeze-used") celebrate({ tone: "streak", title: "Te guardamos el lugar", detail: `Se usó ${e.count === 1 ? "un congelamiento" : `${e.count} congelamientos`}.` });
        if (e.kind === "freeze-earned") celebrate({ tone: "streak", title: "Ganaste un congelamiento", detail: "Cubre un día sin estudiar." });
        if (e.kind === "broken") celebrate({ tone: "streak", title: "Empiezas una racha nueva", detail: `Haz doble misión antes del ${e.deadline} y recuperas tus ${e.previous} días.` });
        if (e.kind === "repaired") celebrate({ tone: "streak", title: "Racha recuperada", detail: `${e.current} días.` });
      }
    },
    [celebrate],
  );
  const api = useMemo(() => ({ celebrate, fromOutcome }), [celebrate, fromOutcome]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-3 bottom-3 z-50 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                "fx-right pointer-events-auto flex items-start gap-3 rounded-lg border-2 bg-surface p-3 shadow-[var(--shadow-hard)]",
                t.tone === "level" || t.tone === "achievement" ? "border-xp" : t.tone === "streak" ? "border-streak" : "border-brand",
              )}
            >
              <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", t.tone === "streak" ? "text-streak" : "text-xp")} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t.title}</p>
                {t.detail ? <p className="text-sm text-ink-2">{t.detail}</p> : null}
              </div>
              <button type="button" aria-label="Cerrar aviso" onClick={() => dismiss(t.id)} className="rounded-sm text-muted-foreground hover:text-ink">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useCelebrate(): CelebrateApi {
  const api = useContext(Ctx);
  return api ?? { celebrate: () => {}, fromOutcome: () => {} };
}
