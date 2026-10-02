import { z } from "zod";
import "@/content/schema/common"; // mensajes de Zod en español
import type { DataTableName } from "./schema";

/** Versión del formato de archivo de respaldo (independiente del esquema de la base). */
export const BACKUP_FORMAT = 1;

const version = z.number().int().positive();
const stringKey = z.string().min(1);
// Muy por encima de cualquier id real. Sin tope, un id cercano a 2^53 agotaría para siempre el
// generador de claves de la tabla (`clear()` no lo reinicia) y no se podría agregar nada más.
const autoKey = z.number().int().positive().max(2 ** 31 - 1);

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "día AAAA-MM-DD");

export const profileRecordSchema = z.strictObject({
  id: z.literal(1),
  xpTotal: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  currentStreak: z.number().int().nonnegative(),
  maxStreak: z.number().int().nonnegative(),
  streakFreezes: z.number().int().nonnegative(),
  lastStudyDay: day.nullable(),
  streakRepair: z.strictObject({ previous: z.number().int().nonnegative(), deadline: day }).nullable(),
  league: z.strictObject({ division: z.number().int().min(0).max(4), weekKey: day.nullable() }),
  cosmetics: z.strictObject({ frames: z.array(z.string()), frame: z.string().nullable(), badges: z.array(z.string()) }),
  preferences: z.strictObject({ sound: z.boolean(), theme: z.enum(["dark", "light"]), healthyMode: z.boolean() }),
  schemaVersion: version,
});

/**
 * Tablas de las Fases 1+: en F0 solo se exige la clave primaria y `schemaVersion`; el resto de
 * campos se valida cuando su fase los defina (sin perder lo que haya).
 */
const loose = (key: string, keySchema: z.ZodType) => z.looseObject({ [key]: keySchema, schemaVersion: version });

/** Clave primaria de cada tabla (igual que STORES_V2). */
export const PRIMARY_KEYS: Record<DataTableName, string> = {
  profile: "id",
  unitProgress: "unitKey",
  attempts: "id",
  cards: "exerciseId",
  sessions: "id",
  missions: "key",
  records: "key",
  ghosts: "context",
  achievements: "id",
  gymResults: "id",
  mistakes: "exerciseId",
  reports: "id",
  days: "day",
};

const tables = z.strictObject({
  profile: z.array(profileRecordSchema).length(1, "el respaldo debe traer exactamente un perfil"),
  unitProgress: z.array(loose("unitKey", stringKey)),
  attempts: z.array(loose("id", autoKey)),
  cards: z.array(loose("exerciseId", stringKey)),
  sessions: z.array(loose("id", autoKey)),
  missions: z.array(loose("key", stringKey)),
  records: z.array(loose("key", stringKey)),
  ghosts: z.array(loose("context", stringKey)),
  achievements: z.array(loose("id", stringKey)),
  gymResults: z.array(loose("id", autoKey)),
  mistakes: z.array(loose("exerciseId", stringKey)),
  reports: z.array(loose("id", autoKey)),
  days: z.array(loose("day", day)),
} satisfies Record<DataTableName, z.ZodType>);

export const backupSchema = z.strictObject({
  app: z.string(),
  format: z.number(),
  schemaVersion: z.number(),
  exportedAt: z.iso.datetime(),
  appVersion: z.string(),
  tables,
});

export type Backup = z.infer<typeof backupSchema>;
export type BackupTables = Backup["tables"];
