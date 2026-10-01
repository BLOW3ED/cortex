/*
 * Registros de IndexedDB (docs/02). Los nombres van en inglés (ADR-013). Las tablas de las
 * Fases 1+ ya existen desde la v1; sus campos no indexados se afinan en su fase.
 */

/** Todos los registros guardan la versión de esquema con la que se escribieron. */
interface Versioned {
  schemaVersion: number;
}

export interface MetaRecord {
  key: string;
  value: number | string;
}

export interface Preferences {
  /** Sonido apagado por defecto (CLAUDE.md). */
  sound: boolean;
}

export interface ProfileRecord extends Versioned {
  id: 1;
  xpTotal: number;
  level: number;
  currentStreak: number;
  maxStreak: number;
  streakFreezes: number;
  preferences: Preferences;
}

export type UnitStatus = "new" | "seen" | "practiced" | "mastered" | "expert";

export interface UnitProgressRecord extends Versioned {
  /** `materia/NN-nombre`. */
  unitKey: string;
  subjectId: string;
  status: UnitStatus;
  bestBoss: number | null;
  bossAttempts: number;
}

export interface AttemptRecord extends Versioned {
  id?: number;
  exerciseId: string;
  at: number;
  correct: boolean;
  timeMs: number;
  confidence: 1 | 2 | 3 | null;
  answer: string;
  sessionId: number | null;
}

export interface CardRecord extends Versioned {
  exerciseId: string;
  due: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReview: number | null;
}

export type SessionKind = "daily" | "free" | "boss" | "exam" | "gym";

export interface SessionRecord extends Versioned {
  id?: number;
  startedAt: number;
  endedAt: number | null;
  xpEarned: number;
  kind: SessionKind;
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
}

export interface ReportRecord extends Versioned {
  id?: number;
  exerciseId: string;
  comment: string;
  createdAt: number;
}
