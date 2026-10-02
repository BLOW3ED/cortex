/**
 * Azar con semilla (mulberry32): mismo `seed` → misma secuencia. Los generadores del gimnasio, las
 * misiones del día y el cofre lo usan para que las pruebas sean reproducibles (docs/06).
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semilla estable a partir de un texto (p. ej. el día `AAAA-MM-DD`). FNV-1a de 32 bits. */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Entero en [min, max] (ambos incluidos). */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick: lista vacía");
  return items[Math.floor(rng() * items.length)] as T;
}

/** Copia barajada (Fisher–Yates). */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** Elige por peso. Los pesos deben ser ≥ 0 y sumar más de 0. */
export function weightedPick<T extends { weight: number }>(rng: Rng, items: readonly T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  if (!(total > 0)) throw new Error("weightedPick: pesos inválidos");
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r < 0) return item;
  }
  return items[items.length - 1] as T;
}
