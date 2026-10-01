import { describe, expect, it, vi } from "vitest";
import { type Backup } from "./backup-schema";
import {
  backupFileName,
  backupSizeError,
  exportBackup,
  importBackup,
  parseBackup,
  serializeBackup,
  summarizeBackup,
  summarizeDb,
  utf8ByteLength,
} from "./backup";
import { type CortexDb, openCortexDb } from "./db";
import { DATA_TABLES } from "./schema";
import { freshIdb } from "./test-utils";

const NOW = new Date("2026-10-01T18:30:00.000Z");

async function filledDb(): Promise<CortexDb> {
  const db = await openCortexDb(freshIdb());
  await db.profile.update(1, { xpTotal: 1234, level: 5, currentStreak: 3, maxStreak: 9, streakFreezes: 1, preferences: { sound: true } });
  await db.unitProgress.add({ unitKey: "calculo/01-limites", subjectId: "calculo", status: "practiced", bestBoss: 0.75, bossAttempts: 2, schemaVersion: 1 });
  await db.attempts.bulkAdd([
    { exerciseId: "calc-01-001", at: 1, correct: true, timeMs: 900, confidence: 3, answer: "3", sessionId: 1, schemaVersion: 1 },
    { exerciseId: "calc-01-002", at: 2, correct: false, timeMs: 4000, confidence: 2, answer: "5", sessionId: 1, schemaVersion: 1 },
  ]);
  await db.cards.add({ exerciseId: "calc-01-001", due: 10, stability: 2.5, difficulty: 5, reps: 1, lapses: 0, lastReview: 1, schemaVersion: 1 });
  await db.sessions.add({ startedAt: 0, endedAt: 600, xpEarned: 50, kind: "daily", schemaVersion: 1 });
  await db.missions.add({ key: "2026-10-01/1", day: "2026-10-01", kind: "ejercicios", target: 3, progress: 3, completed: true, schemaVersion: 1 });
  await db.records.add({ key: "precision", value: 0.9, at: 5, schemaVersion: 1 });
  await db.ghosts.add({ context: "jefe:calculo/01-limites", events: [{ t: 1, ok: true }], schemaVersion: 1 });
  await db.achievements.add({ id: "memoria-de-elefante", unlockedAt: 7, schemaVersion: 1 });
  await db.gymResults.add({ game: "n-back", domain: "memoria", level: 2, score: 80, at: 8, schemaVersion: 1 });
  await db.mistakes.add({ exerciseId: "calc-01-002", misses: 1, lastAnswer: "5", note: "olvidé factorizar", schemaVersion: 1 });
  await db.reports.add({ exerciseId: "calc-01-003", comment: "¿opción ambigua?", createdAt: 9, schemaVersion: 1 });
  return db;
}

const tablesOf = (b: Backup) => b.tables;

describe("exportar → importar (ida y vuelta)", () => {
  it("conserva todos los datos e ids, en las 12 tablas", async () => {
    const source = await filledDb();
    const backup = await exportBackup(source, "0.0.0", NOW);
    const parsed = parseBackup(serializeBackup(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const target = await openCortexDb(freshIdb());
    await importBackup(target, parsed.backup);
    const again = await exportBackup(target, "0.0.0", NOW);
    expect(tablesOf(again)).toEqual(tablesOf(backup));
    expect(Object.values(summarizeBackup(again).counts).every((n) => n >= 1)).toBe(true);
    expect(await target.meta.get("schemaVersion")).toEqual({ key: "schemaVersion", value: 1 });
    source.close();
    target.close();
  });

  it("funciona con una base recién creada (solo el perfil)", async () => {
    const db = await openCortexDb(freshIdb());
    const backup = await exportBackup(db, "0.0.0", NOW);
    expect(summarizeBackup(backup).counts.profile).toBe(1);
    const parsed = parseBackup(serializeBackup(backup));
    expect(parsed.ok).toBe(true);
    db.close();
  });

  it("el reemplazo borra lo que no viene en el respaldo", async () => {
    const empty = await openCortexDb(freshIdb());
    const emptyBackup = await exportBackup(empty, "0.0.0", NOW);
    const target = await filledDb();
    await importBackup(target, emptyBackup);
    const counts = await summarizeDb(target);
    expect(counts).toEqual(Object.fromEntries(DATA_TABLES.map((t) => [t, t === "profile" ? 1 : 0])));
    expect((await target.profile.get(1))?.xpTotal).toBe(0);
    empty.close();
    target.close();
  });

  it("si algo falla a la mitad, no cambia nada (transacción atómica)", async () => {
    const source = await openCortexDb(freshIdb());
    const backup = await exportBackup(source, "0.0.0", NOW);
    const target = await filledDb();
    const before = await exportBackup(target, "0.0.0", NOW);
    vi.spyOn(target.table("reports"), "clear").mockRejectedValueOnce(new Error("disco lleno"));
    await expect(importBackup(target, backup)).rejects.toThrow("disco lleno");
    expect(tablesOf(await exportBackup(target, "0.0.0", NOW))).toEqual(tablesOf(before));
    source.close();
    target.close();
  });

  it("nombra el archivo con la fecha local", () => {
    expect(backupFileName(new Date(2026, 9, 1, 23, 59))).toBe("cortex-2026-10-01.cortex-backup.json");
  });
});

describe("respaldos inválidos se rechazan sin tocar la base", () => {
  let valid: Backup;
  const mutate = (f: (b: Record<string, unknown>) => void) => {
    const copy = structuredClone(valid) as unknown as Record<string, unknown>;
    f(copy);
    return JSON.stringify(copy);
  };

  it.each<[string, () => string, RegExp]>([
    ["no es JSON", () => "hola", /no es un JSON válido/],
    ["JSON truncado", () => serializeBackup(valid).slice(0, 200), /no es un JSON válido/],
    ["de otra app", () => mutate((b) => (b.app = "otra")), /No es un respaldo de cortex/],
    ["formato desconocido", () => mutate((b) => (b.format = 2)), /Formato de respaldo 2 desconocido/],
    ["esquema del futuro", () => mutate((b) => (b.schemaVersion = 2)), /versión más nueva/],
    ["esquema 0", () => mutate((b) => (b.schemaVersion = 0)), /Versión de esquema inválida/],
    ["esquema -1", () => mutate((b) => (b.schemaVersion = -1)), /Versión de esquema inválida/],
    ["esquema 1.5", () => mutate((b) => (b.schemaVersion = 1.5)), /Versión de esquema inválida/],
    ["esquema como texto", () => mutate((b) => (b.schemaVersion = "1")), /Versión de esquema inválida/],
    ["falta una tabla", () => mutate((b) => delete (b.tables as Record<string, unknown>).cards), /tables\.cards/],
    ["tabla desconocida", () => mutate((b) => ((b.tables as Record<string, unknown>).trucos = [])), /trucos/],
    ["perfil inválido", () => mutate((b) => (((b.tables as { profile: { xpTotal: unknown }[] }).profile[0] ?? { xpTotal: 0 }).xpTotal = -5)), /profile\.0\.xpTotal/],
    ["sin perfil", () => mutate((b) => ((b.tables as Record<string, unknown>).profile = [])), /exactamente un perfil/],
    ["clave repetida", () => mutate((b) => { const t = b.tables as { achievements: unknown[] }; t.achievements = [{ id: "a", unlockedAt: 1, schemaVersion: 1 }, { id: "a", unlockedAt: 2, schemaVersion: 1 }]; }), /achievements: la clave "a" se repite/],
    ["registro sin clave", () => mutate((b) => ((b.tables as Record<string, unknown>).reports = [{ comment: "x", schemaVersion: 1 }])), /tables\.reports\.0\.id/],
    ["id autoincremental gigante", () => mutate((b) => ((b.tables as Record<string, unknown>).attempts = [{ id: Number.MAX_SAFE_INTEGER, schemaVersion: 1 }])), /tables\.attempts\.0\.id/],
  ])("%s", async (_name, make, expected) => {
    const db = await filledDb();
    valid = await exportBackup(db, "0.0.0", NOW);
    const before = await summarizeDb(db);
    const r = parseBackup(make());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" | ")).toMatch(expected);
    expect(await summarizeDb(db)).toEqual(before);
    db.close();
  });

  it("rechaza archivos más grandes que el límite", () => {
    const r = parseBackup("x".repeat(2048), 1024);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/el máximo es/);
  });
});

describe("tamaño del respaldo", () => {
  it("cuenta los bytes UTF-8 igual que TextEncoder (acentos, emoji, sustitutos sueltos)", () => {
    for (const text of ["", "hola", "límite ñ €", "racha 🔥 x", "\ud800 suelto", "fin \udc00"]) {
      expect(utf8ByteLength(text)).toBe(new TextEncoder().encode(text).length);
    }
  });

  it("se exporta compacto y un respaldo justo en el límite se puede importar", async () => {
    const db = await filledDb();
    const text = serializeBackup(await exportBackup(db, "0.0.0", NOW));
    expect(text).not.toMatch(/\n {2}/);
    const bytes = utf8ByteLength(text);
    expect(parseBackup(text, bytes).ok).toBe(true);
    expect(parseBackup(text, bytes - 1).ok).toBe(false);
    expect(backupSizeError(bytes, bytes)).toBeNull();
    expect(backupSizeError(bytes, bytes - 1)).toMatch(/el máximo es/);
    db.close();
  });
});
