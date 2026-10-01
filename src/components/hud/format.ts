/** Plural en español para conteos ("1 día", "4 días"). */
export function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

/** Número con separador de miles de México (1,240). */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-MX").format(n);
}

/** Número corto para espacios chicos (1,240 → "1.2 k"). */
export function formatCompact(n: number): string {
  return new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Lleva un progreso a [0, 1]; `NaN`/infinito → 0. */
export function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}
