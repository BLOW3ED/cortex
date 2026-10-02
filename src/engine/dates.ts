/**
 * Días como `AAAA-MM-DD` en hora local (docs/02). Las cuentas entre días se hacen con fechas UTC
 * construidas desde el texto, así un cambio de horario de verano no mueve la cuenta.
 */

export const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");

/** Día local de un instante. */
export function dayKey(at: number | Date): string {
  const d = typeof at === "number" ? new Date(at) : at;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function dayToUtc(day: string): number {
  const m = DAY_RE.exec(day);
  if (!m) throw new Error(`día inválido: ${day}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Días enteros de `from` a `to` (positivo si `to` es después). */
export function daysBetween(from: string, to: string): number {
  return Math.round((dayToUtc(to) - dayToUtc(from)) / DAY_MS);
}

export function addDays(day: string, n: number): string {
  const d = new Date(dayToUtc(day) + n * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Lunes de la semana del día (semanas de lunes a domingo). */
export function weekStart(day: string): string {
  const dow = new Date(dayToUtc(day)).getUTCDay(); // 0 = domingo
  return addDays(day, -((dow + 6) % 7));
}

/** Hora local (0–23) de un instante. */
export function localHour(at: number): number {
  return new Date(at).getHours();
}
