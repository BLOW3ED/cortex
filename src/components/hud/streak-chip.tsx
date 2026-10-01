import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompact, plural } from "./format";

/** Racha en días. En 0 invita a empezar, sin culpa (docs/03). Hasta `md` solo el número (corto). */
export function StreakChip({ days }: { days: number | null }) {
  const active = days !== null && days > 0;
  const text = days === null ? "–" : active ? plural(days, "día", "días") : "Empieza hoy";
  const short = days === null ? "–" : active ? formatCompact(days) : null;
  return (
    <span
      role="img"
      aria-label={days === null ? "Racha: cargando" : active ? `Racha: ${plural(days, "día", "días")}` : "Racha: empieza hoy"}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-sm border px-1.5 font-mono text-xs font-semibold tracking-[0.04em] whitespace-nowrap md:gap-1.5 md:px-2",
        active ? "arcade border-2 border-[var(--shadow-color)] bg-streak text-streak-ink" : "border-border-strong text-ink-2",
      )}
    >
      <Flame aria-hidden className="size-3.5" fill={active ? "currentColor" : "none"} />
      {short === null ? null : (
        <span aria-hidden className="tabular-nums md:hidden">
          {short}
        </span>
      )}
      <span aria-hidden className="hidden md:inline">
        {text}
      </span>
    </span>
  );
}
