import { formatNumber } from "./format";
import { LevelBadge } from "./level-badge";
import { StreakChip } from "./streak-chip";
import { XpBar } from "./xp-bar";

export interface HudData {
  readonly xpTotal: number;
  readonly level: number;
  readonly currentStreak: number;
  /** Avance dentro del nivel actual, 0–1 (lo calcula el motor de la Fase 1); `null` = sin calcular. */
  readonly levelProgress: number | null;
}

/** HUD compacto de la barra superior. `data = null` dibuja el estado de carga (igual en servidor y cliente). */
export function HudBar({ data }: { data: HudData | null }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3" aria-busy={data === null || undefined}>
      <LevelBadge level={data?.level ?? null} />
      <div className="hidden flex-col gap-1 sm:flex">
        <span className="font-mono text-[0.6875rem] leading-none text-muted-foreground tabular-nums">
          {data === null ? "– XP" : `${formatNumber(data.xpTotal)} XP`}
        </span>
        <XpBar progress={data?.levelProgress ?? null} segments={16} className="h-2.5" />
      </div>
      <StreakChip days={data?.currentStreak ?? null} />
    </div>
  );
}
