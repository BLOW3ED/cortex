/** Nivel actual como chip arcade sólido. */
export function LevelBadge({ level }: { level: number | null }) {
  return (
    <span
      role="img"
      aria-label={level === null ? "Nivel: cargando" : `Nivel ${level}`}
      className="arcade inline-flex h-7 shrink-0 items-center whitespace-nowrap gap-1 rounded-sm border-2 border-[var(--shadow-color)] bg-xp px-2 font-mono text-xs font-bold tracking-[0.08em] text-xp-ink"
    >
      {/* En los celulares más chicos solo el número: el nombre accesible ya dice "Nivel N". */}
      <span aria-hidden className="hidden min-[360px]:inline">
        NV
      </span>
      <span aria-hidden className="tabular-nums">
        {level ?? "–"}
      </span>
    </span>
  );
}
