import Dexie, { type DexieOptions, type EntityTable } from "dexie";
import { APP_ID, APP_NAME } from "@/lib/app";
import { defaultProfile } from "./defaults";
import { SCHEMA_HISTORY, SCHEMA_VERSION, type SchemaStep, TABLE_NAMES } from "./schema";
import type {
  AchievementRecord,
  AttemptRecord,
  CardRecord,
  DayRecord,
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

/**
 * La conexión con la base se cerró mientras la página la usaba: otra pestaña la actualizó o la borró,
 * o el navegador la borró (p. ej. "Borrar datos del sitio"). Esta pestaña ya no la toca.
 */
export class DbClosedError extends Error {
  constructor() {
    super(
      `Se cerró la conexión con tus datos (otra pestaña de ${APP_NAME} los actualizó o borró, o el navegador los borró). ` +
        "Esta pestaña ya no los toca: recarga la página para seguir.",
    );
    this.name = "DbClosedError";
  }
}

/** `CortexDb` intentó abrir la base en otra versión que la suya (ver `lockVersion`). */
class VersionLockError extends Error {
  constructor(version: number | undefined) {
    super(`Esta app solo abre su versión de la base (se pidió ${version ?? "la que haya"}).`);
    this.name = "VersionLockError";
  }
}

const isVersionLock = (e: unknown): boolean =>
  e instanceof VersionLockError || (e instanceof Error && "inner" in e && e.inner instanceof VersionLockError);

/**
 * Fábrica de IndexedDB que solo deja abrir `name` en la versión nativa exacta de esta app. Ante una
 * base más nueva, Dexie reintenta sin versión y, si al esquema le falta algo, la parcha a la versión
 * siguiente; con esto ese intento falla antes de tocar nada, aunque otra pestaña haya subido la versión
 * justo después de la sonda.
 */
function lockVersion(factory: IDBFactory, name: string, nativeVersion: number): IDBFactory {
  return new Proxy(factory, {
    get(target, prop) {
      if (prop === "open") {
        return (dbName: string, version?: number) => {
          if (dbName === name && version !== nativeVersion) throw new VersionLockError(version);
          return target.open(dbName, version);
        };
      }
      const value: unknown = Reflect.get(target, prop, target);
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
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
  days!: EntityTable<DayRecord, "day">;

  /** `true` si se cerró porque otra pestaña pidió actualizar o borrar la base. */
  closedElsewhere = false;

  constructor(options: DexieOptions = {}, history: readonly SchemaStep[] = SCHEMA_HISTORY) {
    const current = history[history.length - 1]?.version ?? SCHEMA_VERSION;
    // `DexieOptions` tipa la fábrica como `{ open: Function }`; en la práctica es un `IDBFactory`.
    const factory = (options.indexedDB as IDBFactory | undefined) ?? (typeof indexedDB === "undefined" ? undefined : indexedDB);
    // Sin `autoOpen`: Dexie reabre solo tras un cierre y esa reapertura se salta la guarda. Solo se
    // abre con `open()` explícito (vía `openCortexDb`) y únicamente en la versión de esta app.
    super(APP_ID, {
      ...options,
      autoOpen: false,
      ...(factory ? { indexedDB: lockVersion(factory, APP_ID, Math.round(current * 10)) } : {}),
    });
    for (const step of history) {
      const v = this.version(step.version).stores({ ...step.stores });
      if (step.upgrade) v.upgrade(step.upgrade);
    }

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
    // Solo las tablas que existen en la última versión de este historial (las pruebas abren la v1).
    const last = history[history.length - 1]?.stores ?? {};
    for (const name of TABLE_NAMES) {
      if (name === "meta" || !last[name]) continue;
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
 * Mira la base SIN declarar esquema: Dexie no hace upgrade. Si no existe, no se abre (o, sin
 * `databases()`, Dexie lanza `NoSuchDatabaseError` y la base sigue sin existir).
 */
export async function probeDb(options: DexieOptions = {}): Promise<ProbeResult> {
  // Si la base no existe, Dexie la crea y la borra al instante; ese borrado podría alcanzar a la base
  // que otra pestaña acaba de crear (primer arranque con dos pestañas). `databases()` evita abrirla.
  const factory = (options.indexedDB as IDBFactory | undefined) ?? (typeof indexedDB === "undefined" ? undefined : indexedDB);
  if (typeof factory?.databases === "function") {
    const names = (await factory.databases()).map((d) => d.name);
    if (!names.includes(APP_ID)) return { exists: false, version: 0, metaVersion: null };
  }
  const probe = new Dexie(APP_ID, options);
  // Si otra pestaña pide subir la versión mientras la sonda está abierta, se cierra y no la bloquea.
  probe.on("versionchange", () => {
    probe.close();
    return false;
  });
  try {
    await probe.open();
    const version = Math.floor(probe.backendDB().version / 10);
    let metaVersion: number | null = null;
    if (probe.tables.some((t) => t.name === "meta")) {
      // Dentro de una transacción explícita: su promesa se cumple cuando la transacción TERMINA, así
      // `close()` no deja lecturas en vuelo (que cuentan como conexión abierta y dan un `blocked`).
      const row = await probe.transaction("r", "meta", () => probe.table("meta").get("schemaVersion") as Promise<MetaRecord | undefined>);
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
  try {
    await db.open();
  } catch (e) {
    if (!isVersionLock(e)) throw e;
    // Otra pestaña subió la versión entre la sonda y `open()` (o al esquema le falta algo y Dexie
    // quiso parcharlo): no se tocó nada.
    const now = await probeDb(options);
    const found = Math.max(now.version, now.metaVersion ?? 0);
    if (found > supported) throw new FutureSchemaError(found, supported);
    throw new Error("Tus datos no tienen la forma que espera esta versión de la app; no se tocaron.", { cause: e });
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
