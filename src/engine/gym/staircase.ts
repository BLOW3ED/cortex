import { CONFIG } from "../config";

/**
 * Escalera adaptativa (docs/06): 2 aciertos seguidos → sube un nivel; 1 error → baja uno.
 * Converge a ~70 % de acierto en tareas de velocidad.
 */
export interface Staircase {
  readonly level: number;
  readonly min: number;
  readonly max: number;
  readonly hits: number;
  readonly misses: number;
}

export function createStaircase(level: number, min = 1, max = 10): Staircase {
  return { level: Math.min(max, Math.max(min, Math.round(level))), min, max, hits: 0, misses: 0 };
}

export function stepStaircase(s: Staircase, correct: boolean): Staircase {
  if (correct) {
    const hits = s.hits + 1;
    if (hits >= CONFIG.gym.upAfter) return { ...s, level: Math.min(s.max, s.level + 1), hits: 0, misses: 0 };
    return { ...s, hits, misses: 0 };
  }
  const misses = s.misses + 1;
  if (misses >= CONFIG.gym.downAfter) return { ...s, level: Math.max(s.min, s.level - 1), hits: 0, misses: 0 };
  return { ...s, hits: 0, misses };
}
