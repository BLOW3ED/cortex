import { Heart } from "lucide-react";

/** Vidas de un jefe (docs/03): corazones llenos y vacíos. */
export function Lives({ current, max }: { current: number; max: number }) {
  const safeMax = Math.max(0, Math.floor(max));
  const safeCurrent = Math.min(safeMax, Math.max(0, Math.floor(current)));
  return (
    <span role="img" aria-label={`${safeCurrent} de ${safeMax} ${safeMax === 1 ? "vida" : "vidas"}`} className="inline-flex items-center gap-1">
      {Array.from({ length: safeMax }, (_, i) => (
        <Heart
          key={i}
          aria-hidden
          data-full={i < safeCurrent || undefined}
          className="size-5 text-life data-full:drop-shadow-[1px_1px_0_var(--shadow-color)]"
          fill={i < safeCurrent ? "currentColor" : "none"}
          strokeWidth={2.25}
        />
      ))}
    </span>
  );
}
