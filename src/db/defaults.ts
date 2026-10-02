import { SCHEMA_VERSION } from "./schema";
import type { DayRecord, ProfileRecord } from "./types";

export function defaultProfile(): ProfileRecord {
  return {
    id: 1,
    xpTotal: 0,
    level: 1,
    currentStreak: 0,
    maxStreak: 0,
    streakFreezes: 0,
    lastStudyDay: null,
    streakRepair: null,
    league: { division: 0, weekKey: null },
    cosmetics: { frames: [], frame: null, badges: [] },
    preferences: { sound: false, theme: "dark", healthyMode: false },
    schemaVersion: SCHEMA_VERSION,
  };
}

export function emptyDayRecord(day: string): DayRecord {
  return {
    day,
    xp: 0,
    answered: 0,
    correct: 0,
    reviews: 0,
    reviewsCorrect: 0,
    reviewBlockDone: false,
    highConfCorrect: 0,
    hardCorrect: 0,
    lessons: 0,
    gymGames: 0,
    bossesWon: 0,
    combo: 0,
    bestCombo: 0,
    activeMs: 0,
    minimumMet: false,
    chestOpened: false,
    sessionDone: false,
    schemaVersion: SCHEMA_VERSION,
  };
}
