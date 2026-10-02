/**
 * Logros ligados a hitos reales, no a tiempo perdido (docs/03). Algunos son secretos: se ven
 * como "???" hasta desbloquearlos, para que explorar tenga premio.
 */

export interface AchievementStats {
  readonly totalCorrect: number;
  readonly level: number;
  readonly streak: number;
  readonly reviewRun: number;
  readonly bossesPassed: number;
  readonly hardcorePassed: number;
  readonly ghostsBeaten: number;
  readonly lessons: number;
  /** Hora local (0–23) de la actividad que se está evaluando; `null` si no aplica. */
  readonly hour: number | null;
  readonly gymNbackMax: number;
  readonly gymArithmeticRun: number;
  readonly gymSequencesLevel: number;
  /** Ejercicio de C con memoria dinámica correcto al primer intento (Fase 2). */
  readonly zeroLeak: number;
}

export interface AchievementDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly secret?: boolean;
  readonly check: (s: AchievementStats) => boolean;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: "primer-acierto", name: "Primer acierto", description: "Resolviste bien tu primer ejercicio.", check: (s) => s.totalCorrect >= 1 },
  { id: "cien-aciertos", name: "Centena", description: "100 ejercicios resueltos bien.", check: (s) => s.totalCorrect >= 100 },
  { id: "mil-aciertos", name: "Millar", description: "1000 ejercicios resueltos bien.", check: (s) => s.totalCorrect >= 1000 },
  { id: "primera-leccion", name: "Primera lección", description: "Completaste una lección con su mini quiz.", check: (s) => s.lessons >= 1 },
  { id: "racha-7", name: "Semana completa", description: "7 días de racha.", check: (s) => s.streak >= 7 },
  { id: "racha-30", name: "Hábito de hierro", description: "30 días de racha.", check: (s) => s.streak >= 30 },
  { id: "nivel-5", name: "Nivel 5", description: "Llegaste al nivel 5.", check: (s) => s.level >= 5 },
  { id: "nivel-10", name: "Nivel 10", description: "Llegaste al nivel 10.", check: (s) => s.level >= 10 },
  { id: "memoria-de-elefante", name: "Memoria de elefante", description: "30 repasos seguidos acertados.", check: (s) => s.reviewRun >= 30 },
  { id: "primer-jefe", name: "Primer jefe", description: "Derrotaste a tu primer jefe.", check: (s) => s.bossesPassed >= 1 },
  { id: "sin-red", name: "Sin red", description: "Derrotaste un jefe en modo hardcore (1 vida, sin pistas).", check: (s) => s.hardcorePassed >= 1 },
  { id: "fantasma", name: "Más rápido que tu sombra", description: "Le ganaste a tu fantasma en un jefe.", check: (s) => s.ghostsBeaten >= 1 },
  { id: "cero-fugas", name: "Cero fugas", description: "Ejercicio de C con memoria dinámica correcto al primer intento.", check: (s) => s.zeroLeak >= 1 },
  { id: "n-back-3", name: "Tres atrás", description: "Llegaste a 3-back en el gimnasio.", check: (s) => s.gymNbackMax >= 3 },
  { id: "n-back-4", name: "N-back 4", description: "Llegaste a 4-back en el gimnasio.", check: (s) => s.gymNbackMax >= 4 },
  { id: "cincuenta-calculos", name: "Calculadora humana", description: "50 cálculos mentales seguidos sin error.", check: (s) => s.gymArithmeticRun >= 50 },
  { id: "patron-oculto", name: "Patrón oculto", description: "Nivel 5 en secuencias lógicas.", check: (s) => s.gymSequencesLevel >= 5 },
  { id: "madrugador", name: "El madrugador", description: "Estudiaste antes de las 8 de la mañana.", secret: true, check: (s) => s.hour !== null && s.hour < 8 },
  { id: "nocturno", name: "El nocturno", description: "Estudiaste después de las 10 de la noche.", secret: true, check: (s) => s.hour !== null && s.hour >= 22 },
];

/** Logros nuevos con estas estadísticas (los ya desbloqueados no se repiten). */
export function newAchievements(stats: AchievementStats, unlocked: ReadonlySet<string>): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && a.check(stats));
}

/** Logro por derrotar a un jefe: usa la insignia de `jefe.yaml`. */
export function bossAchievementId(insignia: string): string {
  return `jefe:${insignia}`;
}
