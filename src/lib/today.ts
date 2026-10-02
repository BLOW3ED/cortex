import type { CatalogUnit, StudyCatalog } from "@/content/core/study-catalog";
import type { CortexDb } from "@/db/db";
import { emptyDayRecord } from "@/db/defaults";
import type { DayRecord, UnitProgressRecord } from "@/db/types";
import { dayKey } from "@/engine/dates";
import type { Mastery } from "@/engine/mastery";
import { chooseMission, type MissionStep, type UnitState } from "@/engine/session";
import { allUnits } from "./study";

/**
 * Estado de "hoy" leído de la base: qué falta de la sesión del día. La misión elegida se fija por
 * día en `sessionStorage` (comodidad de esta pestaña) para que no cambie al salir a leer la lección.
 */

export interface UnitView {
  readonly unit: CatalogUnit;
  readonly progress: UnitProgressRecord | null;
}

export function unitStates(catalog: StudyCatalog, progress: readonly UnitProgressRecord[]): UnitState[] {
  const byKey = new Map(progress.map((p) => [p.unitKey, p]));
  const lastBySubject = new Map<string, number>();
  for (const p of progress) if (p.lastActivity !== null) lastBySubject.set(p.subjectId, Math.max(lastBySubject.get(p.subjectId) ?? 0, p.lastActivity));
  return allUnits(catalog).map((u) => {
    const p = byKey.get(u.key);
    return {
      key: u.key,
      subjectId: u.subjectId,
      number: u.number,
      lessonDone: p?.lessonDone ?? false,
      status: (p?.status ?? "new") as Mastery,
      subjectLastActivity: lastBySubject.get(u.subjectId) ?? null,
    };
  });
}

const storage = {
  get(key: string): string | null {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Sin sessionStorage (modo privado estricto): la misión se recalcula, sin más.
    }
  },
};

export function todaysMission(catalog: StudyCatalog, progress: readonly UnitProgressRecord[], day: string): MissionStep | null {
  const key = `cortex:mision:${day}`;
  const saved = storage.get(key);
  if (saved) {
    try {
      const m = JSON.parse(saved) as MissionStep;
      if (allUnits(catalog).some((u) => u.key === m.unitKey)) return m;
    } catch {
      // Valor dañado: se recalcula.
    }
  }
  const m = chooseMission(unitStates(catalog, progress), catalog.subjects.map((s) => s.id));
  if (m) storage.set(key, JSON.stringify(m));
  return m;
}

export function markMissionDone(day: string): void {
  storage.set(`cortex:mision-hecha:${day}`, "1");
}

export interface TodayStatus {
  readonly day: string;
  readonly dayRecord: DayRecord;
  readonly dueCards: number;
  readonly mission: MissionStep | null;
  readonly missionDone: boolean;
  readonly warmupDone: boolean;
  readonly gymDone: boolean;
  readonly progress: readonly UnitProgressRecord[];
}

export async function readToday(db: CortexDb, catalog: StudyCatalog, now: number): Promise<TodayStatus> {
  const day = dayKey(now);
  const [dayRecord, progress, cards] = await Promise.all([db.days.get(day), db.unitProgress.toArray(), db.cards.where("due").belowOrEqual(now).toArray()]);
  const d = dayRecord ?? emptyDayRecord(day);
  const dueCards = cards.filter((c) => catalog.exercises[c.exerciseId]).length;
  const mission = todaysMission(catalog, progress, day);
  const lessonDone = mission?.kind === "lesson" && (progress.find((p) => p.unitKey === mission.unitKey)?.lessonDone ?? false);
  return {
    day,
    dayRecord: d,
    dueCards,
    mission,
    missionDone: !mission || lessonDone || storage.get(`cortex:mision-hecha:${day}`) === "1",
    warmupDone: d.reviewBlockDone || dueCards === 0,
    gymDone: d.gymGames > 0,
    progress,
  };
}
