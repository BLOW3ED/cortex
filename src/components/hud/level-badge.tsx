/** Nivel actual como chip arcade sólido. */
export function LevelBadge({ level }: { level: number | null }) {
  return (
    <span
      aria-label={level === null ? "Nivel: cargando" : `Nivel ${level}`}
      className="arcade inline-flex h-7 items-center gap-1 rounded-sm border-2 border-[var(--shadow-color)] bg-xp px-2 font-mono text-xs font-bold tracking-[0.08em] text-xp-ink"
    >
      <span aria-hidden>NV</span>
      <span aria-hidden className="tabular-nums">
        {level ?? "–"}
      </span>
    </span>
  );
}
