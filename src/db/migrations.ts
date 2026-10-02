import type { Transaction } from "dexie";

/**
 * Transformaciones de registros entre versiones del esquema. Son funciones puras para que el
 * `upgrade` de Dexie y la migración de respaldos viejos (`migrateBackup`) hagan exactamente lo mismo.
 */

type Row = Record<string, unknown>;

const DAY_MS = 86_400_000;
const isObj = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);

/** Perfil v1 → v2: liga, cosméticos, reparación y preferencias nuevas con sus valores por defecto. */
export function profileV1toV2(p: Row): Row {
  const prefs = isObj(p.preferences) ? p.preferences : {};
  return {
    ...p,
    lastStudyDay: p.lastStudyDay ?? null,
    streakRepair: p.streakRepair ?? null,
    league: p.league ?? { division: 0, weekKey: null },
    cosmetics: p.cosmetics ?? { frames: [], frame: null, badges: [] },
    preferences: { theme: "dark", healthyMode: false, ...prefs },
  };
}

/** Tarjeta v1 → v2: campos completos de FSRS deducidos de lo que había. */
export function cardV1toV2(c: Row): Row {
  const reps = typeof c.reps === "number" ? c.reps : 0;
  const due = typeof c.due === "number" ? c.due : 0;
  const last = typeof c.lastReview === "number" ? c.lastReview : null;
  return {
    ...c,
    elapsedDays: c.elapsedDays ?? 0,
    scheduledDays: c.scheduledDays ?? (last === null ? 0 : Math.max(0, Math.round((due - last) / DAY_MS))),
    learningSteps: c.learningSteps ?? 0,
    state: c.state ?? (reps > 0 ? 2 : 0),
    longOk: c.longOk ?? false,
  };
}

export function mistakeV1toV2(m: Row): Row {
  return { ...m, lastAt: m.lastAt ?? 0, illusion: m.illusion ?? false, fixedAt: m.fixedAt ?? null };
}

export function unitProgressV1toV2(u: Row): Row {
  return {
    ...u,
    lessonDone: u.lessonDone ?? (u.status !== undefined && u.status !== "new"),
    bossPassed: u.bossPassed ?? (u.status === "mastered" || u.status === "expert"),
    lastActivity: u.lastActivity ?? null,
  };
}

/** `upgrade` de Dexie v1 → v2 (corre dentro de la transacción de actualización). */
export async function upgradeV1toV2(tx: Transaction): Promise<void> {
  const replaceAll = (fn: (r: Row) => Row) => (row: Row) => {
    const next = fn(row);
    for (const k of Object.keys(next)) row[k] = next[k];
  };
  await tx.table("profile").toCollection().modify(replaceAll(profileV1toV2));
  await tx.table("cards").toCollection().modify(replaceAll(cardV1toV2));
  await tx.table("mistakes").toCollection().modify(replaceAll(mistakeV1toV2));
  await tx.table("unitProgress").toCollection().modify(replaceAll(unitProgressV1toV2));
  await tx.table("meta").put({ key: "schemaVersion", value: 2 });
}
