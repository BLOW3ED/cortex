import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { plural } from "./format";

/** Racha en días. En 0 invita a empezar, sin culpa (docs/03). */
export function StreakChip({ days }: { days: number | null }) {
  const active = days !== null && days > 0;
  const text = days === null ? "–" : active ? plural(days, "día", "días") : "Empieza hoy";
  return (
    <span
      aria-label={days === null ? "Racha: cargando" : active ? `Racha: ${plural(days, "día", "días")}` : "Racha: empieza hoy"}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-sm border px-2 font-mono text-xs font-semibold tracking-[0.04em]",
        active ? "arcade border-2 border-[var(--shadow-color)] bg-streak text-streak-ink" : "border-border-strong text-ink-2",
      )}
    >
      <Flame aria-hidden className="size-3.5" fill={active ? "currentColor" : "none"} />
      <span aria-hidden>{text}</span>
    </span>
  );
}
