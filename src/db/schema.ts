import type { Transaction } from "dexie";

/**
 * Esquema de IndexedDB (docs/02, ADR-013 y ADR-014).
 *
 * REGLA: una versión publicada NUNCA se edita. Un cambio de esquema agrega una entrada nueva a
 * `SCHEMA_HISTORY` (con su `upgrade` y su prueba de migración) y sube `SCHEMA_VERSION`.
 */

export const SCHEMA_VERSION = 1;

/** Tablas e índices de la versión 1. La primera clave es la primaria (`++` = autoincremental). */
export const STORES_V1 = {
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
} as const;

export type TableName = keyof typeof STORES_V1;
export const TABLE_NAMES = Object.keys(STORES_V1) as TableName[];

/** Tablas de datos de Carlo (todas menos `meta`, que la app regenera). */
export const DATA_TABLES = TABLE_NAMES.filter((t): t is Exclude<TableName, "meta"> => t !== "meta");
export type DataTableName = (typeof DATA_TABLES)[number];

export interface SchemaStep {
  readonly version: number;
  readonly stores: Readonly<Record<string, string | null>>;
  /** Transforma los datos al pasar a esta versión (Dexie la corre dentro de la transacción de upgrade). */
  readonly upgrade?: (tx: Transaction) => PromiseLike<unknown> | void;
}

/** Historial completo y append-only del esquema. */
export const SCHEMA_HISTORY: readonly SchemaStep[] = [{ version: 1, stores: STORES_V1 }];
