import Dexie, { type DexieOptions, type EntityTable } from "dexie";
import { APP_ID, APP_NAME } from "@/lib/app";
import { defaultProfile } from "./defaults";
import { SCHEMA_HISTORY, SCHEMA_VERSION, type SchemaStep, TABLE_NAMES } from "./schema";
import type {
  AchievementRecord,
  AttemptRecord,
  CardRecord,
  GhostRecord,
  GymResultRecord,
  MetaRecord,
  MistakeRecord,
  MissionRecord,
  PersonalRecord,
  ProfileRecord,
  ReportRecord,
  SessionRecord,
  UnitProgressRecord,
} from "./types";

/** La base guardada es de una versión más nueva que esta app: no se abre ni se toca. */
export class FutureSchemaError extends Error {
  constructor(
    readonly found: number,
    readonly supported: number,
  ) {
    super(
      `Tus datos son de una versión más nueva de ${APP_NAME} (esquema ${found}; esta app entiende hasta el ${supported}). ` +
        "Actualiza la app; tus datos no se tocaron.",
    );
    this.name = "FutureSchemaError";
  }
}

/** Otra pestaña actualizó o borró la base mientras esta la tenía abierta: esta conexión ya no sirve. */
export class DbClosedElsewhereError extends Error {
  constructor() {
    super(
      `Otra pestaña de ${APP_NAME} actualizó o borró tus datos, así que esta se desconectó para no tocarlos. ` +
        "Recarga la página para seguir.",
    );
    this.name = "DbClosedElsewhereError";
  }
}

export class CortexDb extends Dexie {
  meta!: EntityTable<MetaRecord, "key">;
  profile!: EntityTable<ProfileRecord, "id">;
  unitProgress!: EntityTable<UnitProgressRecord, "unitKey">;
  attempts!: EntityTable<AttemptRecord, "id">;
  cards!: EntityTable<CardRecord, "exerciseId">;
  sessions!: EntityTable<SessionRecord, "id">;
  missions!: EntityTable<MissionRecord, "key">;
  records!: EntityTable<PersonalRecord, "key">;
  ghosts!: EntityTable<GhostRecord, "context">;
  achievements!: EntityTable<AchievementRecord, "id">;
  gymResults!: EntityTable<GymResultRecord, "id">;
  mistakes!: EntityTable<MistakeRecord, "exerciseId">;
  reports!: EntityTable<ReportRecord, "id">;

  /** `true` si se cerró porque otra pestaña pidió actualizar o borrar la base. */
  closedElsewhere = false;

  constructor(options: DexieOptions = {}, history: readonly SchemaStep[] = SCHEMA_HISTORY) {
    // Sin `autoOpen`: Dexie reabre solo tras un cierre y esa reapertura se salta la guarda (podría
    // abrir y parchar una base más nueva). Solo se abre con `open()` explícito, vía `openCortexDb`.
    super(APP_ID, { ...options, autoOpen: false });
    for (const step of history) {
      const v = this.version(step.version).stores({ ...step.stores });
      if (step.upgrade) v.upgrade(step.upgrade);
    }
    const current = history[history.length - 1]?.version ?? SCHEMA_VERSION;

    // Otra pestaña quiere subir la versión o borrar la base: se cierra para no bloquearla y queda
    // cerrada (`false` evita el manejador de Dexie, que la dejaría lista para reabrirse sola).
    this.on("versionchange", () => {
      this.closedElsewhere = true;
      this.close();
      return false;
    });

    // Solo corre al crear la base por primera vez.
    this.on("populate", (tx) => {
      void tx.table("meta").add({ key: "schemaVersion", value: current } satisfies MetaRecord);
      void tx.table("profile").add(defaultProfile());
    });

    // Cada registro guarda la versión de esquema con la que se escribió (docs/02).
    for (const name of TABLE_NAMES) {
      if (name === "meta") continue;
      const table = this.table(name);
      table.hook("creating", (_key, obj: { schemaVersion?: number }) => {
        obj.schemaVersion = current;
      });
      table.hook("updating", () => ({ schemaVersion: current }));
    }
  }
}

export interface ProbeResult {
  readonly exists: boolean;
  /** Versión de esquema (la de Dexie, no la nativa ×10). */
  readonly version: number;
  readonly metaVersion: number | null;
}

/**
 * Mira la base SIN declarar esquema: Dexie no hace upgrade ni crea nada. Si no existe, lanza
 * `NoSuchDatabaseError` y la base sigue sin existir.
 */
export async function probeDb(options: DexieOptions = {}): Promise<ProbeResult> {
  const probe = new Dexie(APP_ID, options);
  try {
    await probe.open();
    const version = Math.floor(probe.backendDB().version / 10);
    let metaVersion: number | null = null;
    if (probe.tables.some((t) => t.name === "meta")) {
      const row = (await probe.table("meta").get("schemaVersion")) as MetaRecord | undefined;
      metaVersion = typeof row?.value === "number" ? row.value : null;
    }
    return { exists: true, version, metaVersion };
  } catch (e) {
    if (e instanceof Dexie.NoSuchDatabaseError) return { exists: false, version: 0, metaVersion: null };
    throw e;
  } finally {
    probe.close();
  }
}

/**
 * Abre la base de Cortex. Antes revisa que no sea de una versión más nueva: Dexie 4 la abriría
 * en silencio e incluso podría parcharla (ADR-014).
 */
export async function openCortexDb(
  options: DexieOptions = {},
  history: readonly SchemaStep[] = SCHEMA_HISTORY,
): Promise<CortexDb> {
  const supported = history[history.length - 1]?.version ?? SCHEMA_VERSION;
  const probe = await probeDb(options);
  const found = Math.max(probe.version, probe.metaVersion ?? 0);
  if (found > supported) throw new FutureSchemaError(found, supported);
  const db = new CortexDb(options, history);
  await db.open();
  // Entre la sonda y `open()` otra pestaña pudo subir la versión: se revisa de nuevo ya abierta.
  const native = Math.floor(db.backendDB().version / 10);
  const metaValue = (await db.meta.get("schemaVersion"))?.value;
  const opened = Math.max(native, typeof metaValue === "number" ? metaValue : 0);
  if (opened > supported) {
    db.close();
    throw new FutureSchemaError(opened, supported);
  }
  return db;
}

let shared: Promise<CortexDb> | null = null;

/**
 * Base compartida del navegador (perezosa: importar este módulo en el servidor no toca nada).
 * Si la conexión se cierra, la siguiente llamada vuelve a pasar por la guarda.
 */
export function getDb(): Promise<CortexDb> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("La base local solo existe en el navegador."));
  }
  // Dexie cierra la base al ocultar la página (bfcache) y, sin `autoOpen`, no la reabriría al volver.
  Dexie.disableBfCache = true;
  if (!shared) {
    const opening = openCortexDb().then(
      (db) => {
        db.on("close", () => {
          if (shared === opening) shared = null;
        });
        return db;
      },
      (e: unknown) => {
        shared = null;
        throw e;
      },
    );
    shared = opening;
  }
  return shared;
}
