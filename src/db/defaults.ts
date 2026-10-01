import { SCHEMA_VERSION } from "./schema";
import type { ProfileRecord } from "./types";

export function defaultProfile(): ProfileRecord {
  return {
    id: 1,
    xpTotal: 0,
    level: 1,
    currentStreak: 0,
    maxStreak: 0,
    streakFreezes: 0,
    preferences: { sound: false },
    schemaVersion: SCHEMA_VERSION,
  };
}
