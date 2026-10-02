/*
 * Registros de IndexedDB (docs/02). Los nombres van en inglés (ADR-013). Versión 2 del esquema
 * (Fase 1): perfil con liga, cosméticos y modo sano; tarjetas FSRS completas; tabla `days`.
 */

/** Todos los registros guardan la versión de esquema con la que se escribieron. */
interface Versioned {
  schemaVersion: number;
}

export interface MetaRecord {
  key: string;
  value: number | string;
}

export type ThemePreference = "dark" | "light";

export interface Preferences {
  /** Sonido apagado por defecto (CLAUDE.md). */
  sound: boolean;
  /** Tema oscuro por defecto (docs/03); el claro es opcional. */
  theme: ThemePreference;
  /** Modo sano: tras 90 min en un día sugiere descanso y ya no da XP ni racha (docs/03). */
  healthyMode: boolean;
}

export interface StreakRepair {
  previous: number;
  /** Último día (AAAA-MM-DD) para cumplir la doble misión. */
  deadline: string;
}

export interface LeagueRecord {
  /** Índice de división (0 = Bronce). */
  division: number;
  /** Lunes de la última semana evaluada. */
  weekKey: string | null;
}

export interface Cosmetics {
  /** Marcos del HUD ganados en cofres. */
  frames: string[];
  /** Marco en uso (`null` = el de siempre). */
  frame: string | null;
  /** Insignias raras del cofre. */
  badges: string[];
}

export interface ProfileRecord extends Versioned {
  id: 1;
  xpTotal: number;
  level: number;
  currentStreak: number;
  maxStreak: number;
  streakFreezes: number;
  /** Último día que cumplió la misión mínima. */
  lastStudyDay: string | null;
  streakRepair: StreakRepair | null;
  league: LeagueRecord;
  cosmetics: Cosmetics;
  preferences: Preferences;
}

export type UnitStatus = "new" | "seen" | "practiced" | "mastered" | "expert";

export interface UnitProgressRecord extends Versioned {
  /** `materia/NN-nombre`. */
  unitKey: string;
  subjectId: string;
  status: UnitStatus;
  /** Mejor puntaje de jefe (0–1) o `null` si no se ha peleado. */
  bestBoss: number | null;
  bossAttempts: number;
  /** Lección completada con su mini quiz ≥ 80 %. */
  lessonDone: boolean;
  bossPassed: boolean;
  /** Última actividad en la unidad (ms). */
  lastActivity: number | null;
}

export type AttemptMode = "practice" | "review" | "boss" | "lesson-quiz";

export interface AttemptRecord extends Versioned {
  id?: number;
  exerciseId: string;
  at: number;
  correct: boolean;
  timeMs: number;
  confidence: 1 | 2 | 3 | null;
  answer: string;
  sessionId: number | null;
  /** Desde la v2 (opcionales para los intentos viejos). */
  mode?: AttemptMode;
  hintsUsed?: number;
  xp?: number;
}

export interface CardRecord extends Versioned {
  exerciseId: string;
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  /** 0 nueva, 1 aprendiendo, 2 repaso, 3 reaprendiendo (FSRS). */
  state: number;
  lastReview: number | null;
  /** Se acertó un repaso con intervalo mayor a 21 días (cuenta para "maestría"). */
  longOk: boolean;
}

export type SessionKind = "daily" | "free" | "boss" | "exam" | "gym";

export interface SessionRecord extends Versioned {
  id?: number;
  startedAt: number;
  endedAt: number | null;
  xpEarned: number;
  kind: SessionKind;
  /** Desde la v2 (opcionales). */
  answered?: number;
  correct?: number;
  correctTimeMs?: number;
  unitKey?: string;
}

export interface MissionRecord extends Versioned {
  /** `AAAA-MM-DD/slot`. */
  key: string;
  day: string;
  kind: string;
  target: number;
  progress: number;
  completed: boolean;
}

export interface PersonalRecord extends Versioned {
  key: string;
  value: number;
  at: number;
}

export interface GhostRecord extends Versioned {
  context: string;
  events: unknown[];
}

export interface AchievementRecord extends Versioned {
  id: string;
  unlockedAt: number;
}

export interface GymResultRecord extends Versioned {
  id?: number;
  game: string;
  domain: string;
  level: number;
  score: number;
  at: number;
}

export interface MistakeRecord extends Versioned {
  exerciseId: string;
  misses: number;
  lastAnswer: string;
  note: string;
  /** Último fallo (ms). */
  lastAt: number;
  /** Se falló con confianza alta: "ilusión de saber" (docs/03). */
  illusion: boolean;
  /** Se acertó después del último fallo. */
  fixedAt: number | null;
}

export interface ReportRecord extends Versioned {
  id?: number;
  exerciseId: string;
  comment: string;
  createdAt: number;
}

/** Contadores de un día local (v2). Mismos campos que `DayStats` del motor. */
export interface DayRecord extends Versioned {
  day: string;
  xp: number;
  answered: number;
  correct: number;
  reviews: number;
  reviewsCorrect: number;
  reviewBlockDone: boolean;
  highConfCorrect: number;
  hardCorrect: number;
  lessons: number;
  gymGames: number;
  bossesWon: number;
  combo: number;
  bestCombo: number;
  activeMs: number;
  minimumMet: boolean;
  chestOpened: boolean;
  sessionDone: boolean;
}
