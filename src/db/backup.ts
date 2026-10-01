import { APP_ID } from "@/lib/app";
import { type Backup, BACKUP_FORMAT, backupSchema, type BackupTables, PRIMARY_KEYS } from "./backup-schema";
import type { CortexDb } from "./db";
import { DATA_TABLES, type DataTableName, SCHEMA_VERSION } from "./schema";

/** Tamaño máximo por defecto de un respaldo a importar (100 MB). */
export const DEFAULT_MAX_BACKUP_BYTES = 100 * 1024 * 1024;

/** Bytes que ocupa un texto en UTF-8, sin copiarlo. */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;

/** Mensaje si un respaldo de `bytes` pasa del máximo que se puede importar; `null` si cabe. */
export function backupSizeError(bytes: number, maxBytes: number = DEFAULT_MAX_BACKUP_BYTES): string | null {
  return bytes > maxBytes ? `El archivo pesa ${megabytes(bytes)}; el máximo es ${megabytes(maxBytes)}.` : null;
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; errors: string[] };

/** `cortex-AAAA-MM-DD.cortex-backup.json` con la fecha local. */
export function backupFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${APP_ID}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.cortex-backup.json`;
}

/** Lee todas las tablas de datos en una sola transacción de lectura. */
export async function exportBackup(db: CortexDb, appVersion: string, now: Date = new Date()): Promise<Backup> {
  const tables = await db.transaction("r", DATA_TABLES.map((t) => db.table(t)), async () => {
    const entries = await Promise.all(DATA_TABLES.map(async (t) => [t, await db.table(t).toArray()] as const));
    return Object.fromEntries(entries) as unknown as BackupTables;
  });
  return { app: APP_ID, format: BACKUP_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), appVersion, tables };
}

/** JSON compacto: con sangría pesaría ~65 % más y se acercaría antes al máximo de importación. */
export function serializeBackup(backup: Backup): string {
  return `${JSON.stringify(backup)}\n`;
}

/**
 * Valida un respaldo completo ANTES de tocar la base. Nunca lanza: devuelve los errores en español.
 */
export function parseBackup(text: string, maxBytes: number = DEFAULT_MAX_BACKUP_BYTES): ParseResult {
  const tooBig = backupSizeError(utf8ByteLength(text), maxBytes);
  if (tooBig) return { ok: false, errors: [tooBig] };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["El archivo no es un JSON válido (¿está incompleto o es otro archivo?)."] };
  }
  const head = data as { app?: unknown; format?: unknown; schemaVersion?: unknown } | null;
  if (typeof head !== "object" || head === null || head.app !== APP_ID) {
    return { ok: false, errors: [`No es un respaldo de ${APP_ID}.`] };
  }
  if (head.format !== BACKUP_FORMAT) {
    return { ok: false, errors: [`Formato de respaldo ${String(head.format)} desconocido (esta app lee el ${BACKUP_FORMAT}).`] };
  }
  const v = head.schemaVersion;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) {
    return { ok: false, errors: [`Versión de esquema inválida: ${JSON.stringify(v)}.`] };
  }
  if (v > SCHEMA_VERSION) {
    return { ok: false, errors: [`El respaldo es de una versión más nueva (esquema ${v}; esta app entiende hasta el ${SCHEMA_VERSION}). Actualiza la app.`] };
  }
  const r = backupSchema.safeParse(migrateBackup(data as Backup));
  if (!r.success) {
    return { ok: false, errors: r.error.issues.slice(0, 20).map((i) => `${i.path.join(".") || "respaldo"}: ${i.message}`) };
  }
  const dupes = DATA_TABLES.flatMap((t) => {
    const key = PRIMARY_KEYS[t];
    const seen = new Set<unknown>();
    return (r.data.tables[t] as Record<string, unknown>[]).flatMap((row) => {
      const k = row[key];
      if (seen.has(k)) return [`${t}: la clave ${JSON.stringify(k)} se repite.`];
      seen.add(k);
      return [];
    });
  });
  if (dupes.length) return { ok: false, errors: dupes };
  return { ok: true, backup: r.data };
}

/** Lleva un respaldo viejo a la versión actual. En v1 no hay nada que migrar. */
export function migrateBackup(backup: Backup): Backup {
  switch (backup.schemaVersion) {
    case 1:
      return backup;
    default:
      return backup;
  }
}

export interface BackupSummary {
  readonly exportedAt: string;
  readonly appVersion: string;
  readonly counts: Readonly<Record<DataTableName, number>>;
  readonly xpTotal: number;
  readonly level: number;
}

export function summarizeBackup(backup: Backup): BackupSummary {
  const counts = Object.fromEntries(DATA_TABLES.map((t) => [t, backup.tables[t].length])) as Record<DataTableName, number>;
  const profile = backup.tables.profile[0];
  return { exportedAt: backup.exportedAt, appVersion: backup.appVersion, counts, xpTotal: profile?.xpTotal ?? 0, level: profile?.level ?? 1 };
}

/** Resumen de lo que hay ahora en la base (para comparar antes de importar). */
export async function summarizeDb(db: CortexDb): Promise<Readonly<Record<DataTableName, number>>> {
  const entries = await Promise.all(DATA_TABLES.map(async (t) => [t, await db.table(t).count()] as const));
  return Object.fromEntries(entries) as Record<DataTableName, number>;
}

/**
 * Reemplaza TODOS los datos por los del respaldo en una sola transacción: si algo falla, no
 * cambia nada (decisión D7). Los ids se conservan; `meta` se regenera.
 */
export async function importBackup(db: CortexDb, backup: Backup): Promise<void> {
  await db.transaction("rw", [...DATA_TABLES.map((t) => db.table(t)), db.meta], async () => {
    for (const t of DATA_TABLES) await db.table(t).clear();
    for (const t of DATA_TABLES) {
      const rows = backup.tables[t] as object[];
      if (rows.length) await db.table(t).bulkAdd(rows);
    }
    await db.meta.put({ key: "schemaVersion", value: SCHEMA_VERSION });
  });
}
