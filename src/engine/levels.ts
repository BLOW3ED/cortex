import { CONFIG } from "./config";

/** XP necesario para pasar del nivel `n` al `n + 1`: `100 · n^1.5` redondeado (docs/03). */
export function xpToNext(level: number): number {
  return Math.round(CONFIG.levels.base * level ** CONFIG.levels.exponent);
}

/** XP acumulado necesario para LLEGAR al nivel `level` (nivel 1 = 0). */
export function xpForLevel(level: number): number {
  let total = 0;
  for (let n = 1; n < level; n++) total += xpToNext(n);
  return total;
}

export interface LevelInfo {
  readonly level: number;
  /** XP dentro del nivel actual. */
  readonly into: number;
  /** XP que pide el nivel actual para subir. */
  readonly span: number;
  /** Avance en [0, 1). */
  readonly progress: number;
}

export function levelInfo(xpTotal: number): LevelInfo {
  const xp = Math.max(0, Math.floor(Number.isFinite(xpTotal) ? xpTotal : 0));
  let level = 1;
  let floor = 0;
  while (level < CONFIG.levels.max && xp >= floor + xpToNext(level)) {
    floor += xpToNext(level);
    level++;
  }
  const span = xpToNext(level);
  const into = xp - floor;
  return { level, into, span, progress: Math.min(into / span, 0.999999) };
}

/** Título cosmético más alto desbloqueado por nivel. */
export function titleForLevel(level: number): string {
  let title = CONFIG.titles[0]?.title ?? "";
  for (const t of CONFIG.titles) if (level >= t.level) title = t.title;
  return title;
}
