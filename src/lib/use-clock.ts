"use client";

import { useSyncExternalStore } from "react";
import { dayKey } from "@/engine/dates";

/**
 * Reloj de la interfaz redondeado al minuto (los componentes no llaman `Date.now()` al dibujar).
 * En el servidor vale 0; en el navegador se actualiza cada 30 s, así el día cambia solo a medianoche.
 */
const subscribe = (onChange: () => void) => {
  const t = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(t);
};
const minute = () => Math.floor(Date.now() / 60_000) * 60_000;

export function useMinute(): number {
  return useSyncExternalStore(subscribe, minute, () => 0);
}

/** Día local de hoy (`AAAA-MM-DD`); `null` en el servidor. */
export function useToday(): string | null {
  const now = useMinute();
  return now === 0 ? null : dayKey(now);
}
