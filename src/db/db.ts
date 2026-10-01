import Dexie, { type DexieOptions, type EntityTable } from "dexie";
import { APP_ID } from "@/lib/app";
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
      `Tus datos son de una versión más nueva de ${APP_ID} (esquema ${found}; esta app entiende hasta el ${supported}). ` +
        "Actualiza la app; tus datos no se tocaron.",
    );
    this.name = "FutureSchemaError";
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

  constructor(options: DexieOptions = {}, history: readonly SchemaStep[] = SCHEMA_HISTORY) {
    super(APP_ID, options);
    for (const step of history) {
      const v = this.version(step.version).stores({ ...step.stores });
      if (step.upgrade) v.upgrade(step.upgrade);
    }
    const current = history[history.length - 1]?.version ?? SCHEMA_VERSION;

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
  return db;
}

let shared: Promise<CortexDb> | null = null;

/** Base compartida del navegador (perezosa: importar este módulo en el servidor no toca nada). */
export function getDb(): Promise<CortexDb> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("La base local solo existe en el navegador."));
  }
  shared ??= openCortexDb().catch((e: unknown) => {
    shared = null;
    throw e;
  });
  return shared;
}
