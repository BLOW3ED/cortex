import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { exportBackup, importBackup } from "./backup";
import { CortexDb, DbClosedError, FutureSchemaError, openCortexDb, probeDb } from "./db";
import { defaultProfile } from "./defaults";
import { SCHEMA_HISTORY, SCHEMA_VERSION, type SchemaStep, STORES_V1, TABLE_NAMES } from "./schema";
import { freshIdb, nativeSnapshot } from "./test-utils";

describe("esquema v1", () => {
  it("no cambia: una versión publicada no se edita (agrega una nueva)", () => {
    expect(SCHEMA_VERSION).toBe(1);
    expect(SCHEMA_HISTORY).toEqual([{ version: 1, stores: STORES_V1 }]);
    expect(STORES_V1).toEqual({
      meta: "key",
      profile: "id",
      unitProgress: "unitKey, subjectId",
      attempts: "++id, exerciseId, sessionId, at",
      cards: "exerciseId, due",
      sessions: "++id, startedAt, kind",
      missions: "key, day",
      records: "key",
      ghosts: "context",
      achievements: "id",
      gymResults: "++id, game, at",
      mistakes: "exerciseId",
      reports: "++id, exerciseId, createdAt",
    });
  });

  it("crea las 12 tablas de docs/02 más meta con sus índices", async () => {
    const opts = freshIdb();
    (await openCortexDb(opts)).close();
    const snap = await nativeSnapshot(opts);
    expect(snap.version).toBe(10); // Dexie guarda la versión ×10
    expect(Object.keys(snap.stores).sort()).toEqual([...TABLE_NAMES].sort());
    expect(snap.stores.attempts).toEqual({ keyPath: "id", autoIncrement: true, indexes: ["at", "exerciseId", "sessionId"] });
    expect(snap.stores.cards).toEqual({ keyPath: "exerciseId", autoIncrement: false, indexes: ["due"] });
  });
});

describe("populate", () => {
  it("al crear la base deja el perfil en ceros, sonido apagado, y meta.schemaVersion = 1", async () => {
    const db = await openCortexDb(freshIdb());
    expect(await db.profile.get(1)).toEqual(defaultProfile());
    expect((await db.profile.get(1))?.preferences.sound).toBe(false);
    expect(await db.meta.get("schemaVersion")).toEqual({ key: "schemaVersion", value: 1 });
    db.close();
  });

  it("no vuelve a correr al reabrir (no pisa los datos)", async () => {
    const opts = freshIdb();
    const db = await openCortexDb(opts);
    await db.profile.update(1, { xpTotal: 42 });
    db.close();
    const again = await openCortexDb(opts);
    expect((await again.profile.get(1))?.xpTotal).toBe(42);
    expect(await again.profile.count()).toBe(1);
    again.close();
  });
});

describe("schemaVersion en cada registro", () => {
  it("se estampa al crear y al actualizar", async () => {
    const db = await openCortexDb(freshIdb());
    const id = await db.reports.add({ exerciseId: "calc-01-001", comment: "x", createdAt: 1, schemaVersion: 0 });
    expect((await db.reports.get(id))?.schemaVersion).toBe(1);
    await db.reports.update(id, { comment: "y" });
    expect((await db.reports.get(id))?.schemaVersion).toBe(1);
    db.close();
  });
});

describe("guarda de versión (ADR-014)", () => {
  const futureHistory = (extra: Record<string, string | null>): SchemaStep[] => [
    ...SCHEMA_HISTORY,
    { version: 2, stores: { ...STORES_V1, ...extra } },
  ];

  it("la sonda no crea una base que no existe", async () => {
    const opts = freshIdb();
    expect(await probeDb(opts)).toEqual({ exists: false, version: 0, metaVersion: null });
    expect(await opts.indexedDB.databases()).toEqual([]);
  });

  it.each([
    ["con una tabla nueva", { nuevaTabla: "id" }],
    ["sin un índice de la v1", { attempts: "++id, exerciseId, at" }],
  ])("una base del futuro %s no se abre ni se toca", async (_label, extra) => {
    const opts = freshIdb();
    const future = await openCortexDb(opts, futureHistory(extra));
    await future.meta.put({ key: "schemaVersion", value: 2 });
    await future.attempts.add({ exerciseId: "calc-01-001", at: 1, correct: true, timeMs: 5, confidence: 3, answer: "3", sessionId: null, schemaVersion: 2 });
    future.close();
    const before = await nativeSnapshot(opts);

    await expect(openCortexDb(opts)).rejects.toBeInstanceOf(FutureSchemaError);

    expect(await nativeSnapshot(opts)).toEqual(before);
    expect(Object.keys(before.stores)).not.toContain("$meta");
  });

  it("también rechaza si meta dice una versión más nueva", async () => {
    const opts = freshIdb();
    const db = await openCortexDb(opts);
    await db.meta.put({ key: "schemaVersion", value: 3 });
    db.close();
    await expect(openCortexDb(opts)).rejects.toThrow(/esquema 3/);
  });

  it("sin la guarda, Dexie abriría en silencio la base del futuro y hasta la parcharía (por eso existe)", async () => {
    const opts = freshIdb();
    (await openCortexDb(opts, futureHistory({ attempts: "++id, exerciseId, at" }))).close();
    const naive = new Dexie("cortex", opts);
    naive.version(1).stores({ ...STORES_V1 });
    await expect(naive.open()).resolves.toBeDefined();
    naive.close();
    const after = await nativeSnapshot(opts);
    expect(after.version).toBe(21);
    expect(after.stores.attempts?.indexes).toContain("sessionId");
  });

  it.each([
    ["con una tabla nueva", { nuevaTabla: "id" }],
    ["sin un índice de la v1", { attempts: "++id, exerciseId, at" }],
  ])("CortexDb solo abre su propia versión: aun sin la sonda, una base del futuro %s queda intacta", async (_label, extra) => {
    const opts = freshIdb();
    (await openCortexDb(opts, futureHistory(extra))).close();
    const before = await nativeSnapshot(opts);
    // Simula la carrera: otra pestaña subió la versión justo después de que la sonda dijera "v1".
    await expect(new CortexDb(opts).open()).rejects.toThrow();
    expect(await nativeSnapshot(opts)).toEqual(before);
  });

  it("si otra pestaña sube la versión, la conexión abierta se cierra y ya no escribe ni se reabre sola", async () => {
    const opts = freshIdb();
    const old = await openCortexDb(opts);
    const backup = await exportBackup(old, "0.0.0");
    let closes = 0;
    old.on("close", () => closes++);

    // "Otra pestaña" con la app v2: sin un índice de la v1 (Dexie lo parcharía) y con una tabla nueva.
    const newer = await openCortexDb(opts, futureHistory({ attempts: "++id, exerciseId, at", nuevaTabla: "id" }));
    await newer.meta.put({ key: "schemaVersion", value: 2 });
    await newer.profile.update(1, { xpTotal: 777 });
    newer.close();
    const before = await nativeSnapshot(opts);
    expect(before.version).toBe(20);

    expect(old.closedElsewhere).toBe(true);
    expect(old.isOpen()).toBe(false);
    expect(closes).toBe(1);
    await expect(old.profile.update(1, { preferences: { sound: true } })).rejects.toBeInstanceOf(Dexie.DatabaseClosedError);
    await expect(old.profile.get(1)).rejects.toBeInstanceOf(Dexie.DatabaseClosedError);
    await expect(importBackup(old, backup)).rejects.toBeInstanceOf(Dexie.DatabaseClosedError);

    expect(await nativeSnapshot(opts)).toEqual(before);
    expect(before.stores.attempts?.indexes).not.toContain("sessionId");
    await expect(openCortexDb(opts)).rejects.toBeInstanceOf(FutureSchemaError);
  });

  it("si otra pestaña borra la base, la conexión abierta se cierra y no la vuelve a crear", async () => {
    const opts = freshIdb();
    const old = await openCortexDb(opts);
    await new Promise<void>((resolve, reject) => {
      const req = opts.indexedDB.deleteDatabase("cortex");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error("no se borró"));
    });
    expect(old.closedElsewhere).toBe(true);
    await expect(old.profile.get(1)).rejects.toBeInstanceOf(Dexie.DatabaseClosedError);
    expect(await opts.indexedDB.databases()).toEqual([]);
  });

  it("si el navegador cierra la conexión a la fuerza (borrar datos del sitio), no se reabre sola", async () => {
    const opts = freshIdb();
    const db = await openCortexDb(opts);
    let closes = 0;
    db.on("close", () => closes++);
    db.backendDB().onclose?.call(db.backendDB(), new Event("close"));
    expect(closes).toBe(1);
    expect(db.isOpen()).toBe(false);
    await expect(db.profile.update(1, { xpTotal: 5 })).rejects.toBeInstanceOf(Dexie.DatabaseClosedError);
  });

  it("primer arranque con dos pestañas: la sonda de una no borra la base que la otra acaba de crear", async () => {
    const opts = freshIdb();
    await probeDb(opts);
    const otherTabProbe = probeDb(opts);
    const first = new CortexDb(opts);
    await first.open();
    await otherTabProbe;
    expect(first.closedElsewhere).toBe(false);
    expect(first.isOpen()).toBe(true);
    expect((await opts.indexedDB.databases()).map((d) => d.name)).toEqual(["cortex"]);
    first.close();
  });

  it("el error de base cerrada explica qué hacer", () => {
    expect(new DbClosedError().message).toMatch(/otra pestaña de Cortex .*o el navegador los borró.*recarga la página/);
    expect(new FutureSchemaError(2, 1).message).toMatch(/más nueva de Cortex \(esquema 2/);
  });
});

describe("migraciones (arnés para versiones futuras)", () => {
  it("v1 → v2 transforma los datos y conserva el resto", async () => {
    const opts = freshIdb();
    const v1 = await openCortexDb(opts);
    await v1.mistakes.add({ exerciseId: "calc-01-001", misses: 2, lastAnswer: "4", note: "", schemaVersion: 1 });
    await v1.profile.update(1, { xpTotal: 99 });
    v1.close();

    const history: SchemaStep[] = [
      ...SCHEMA_HISTORY,
      {
        version: 2,
        stores: { ...STORES_V1, mistakes: "exerciseId, misses" },
        upgrade: (tx) => tx.table("mistakes").toCollection().modify((m: { note: string }) => {
          m.note = m.note || "(migrado)";
        }),
      },
    ];
    const v2 = await openCortexDb(opts, history);
    expect(await v2.mistakes.get("calc-01-001")).toMatchObject({ misses: 2, note: "(migrado)" });
    expect(await v2.mistakes.where("misses").equals(2).count()).toBe(1);
    expect((await v2.profile.get(1))?.xpTotal).toBe(99);
    v2.close();
  });
});

describe("transacciones", () => {
  it("un error dentro de una transacción rw deshace todo", async () => {
    const db = await openCortexDb(freshIdb());
    await expect(
      db.transaction("rw", db.profile, db.reports, async () => {
        await db.profile.update(1, { xpTotal: 500 });
        await db.reports.add({ exerciseId: "x", comment: "y", createdAt: 1, schemaVersion: 1 });
        throw new Error("falla a propósito");
      }),
    ).rejects.toThrow("falla a propósito");
    expect((await db.profile.get(1))?.xpTotal).toBe(0);
    expect(await db.reports.count()).toBe(0);
    db.close();
  });
});

describe("importar el módulo en el servidor", () => {
  it("no toca IndexedDB (getDb es perezoso y rechaza fuera del navegador)", async () => {
    const mod = await import("./db");
    expect(typeof indexedDB).toBe("undefined");
    await expect(mod.getDb()).rejects.toThrow(/solo existe en el navegador/);
  });

  it("Dexie está disponible como dependencia", () => {
    expect(Dexie.semVer).toBe("4.4.6");
  });
});
