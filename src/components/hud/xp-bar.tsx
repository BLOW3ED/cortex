import { cn } from "@/lib/utils";
import { clamp01 } from "./format";

/**
 * Barra de XP en ticks (rasgo firma de la consola). Solo dibuja el progreso que recibe: la curva
 * de niveles es de la Fase 1 (src/engine/config.ts). `progress = null` = todavía cargando.
 */
export function XpBar({ progress, segments = 20, className }: { progress: number | null; segments?: number; className?: string }) {
  const value = progress === null ? null : clamp01(progress);
  const filled = value === null ? 0 : Math.round(value * segments);
  return (
    <div
      role="progressbar"
      aria-label="Progreso al siguiente nivel"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(value * 100)}
      aria-busy={value === null || undefined}
      className={cn("flex h-4 items-stretch gap-[3px]", className)}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          aria-hidden
          data-filled={i < filled || undefined}
          className="w-1.5 rounded-[1px] bg-surface-3 data-filled:bg-xp motion-safe:transition-colors motion-safe:duration-[var(--dur-base)]"
        />
      ))}
    </div>
  );
}
