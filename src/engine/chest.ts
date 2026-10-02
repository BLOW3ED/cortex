import { CONFIG, type ChestKind } from "./config";
import { pick, type Rng, weightedPick } from "./rng";

/**
 * Cofre del día (docs/03): recompensa variable con probabilidades VISIBLES. La variabilidad
 * engancha; la transparencia lo vuelve honesto.
 */

export type ChestReward =
  | { readonly kind: "xp"; readonly amount: number }
  | { readonly kind: "fact"; readonly fact: string }
  | { readonly kind: "freeze" }
  | { readonly kind: "frame"; readonly frame: string }
  | { readonly kind: "rare-badge"; readonly badge: string };

export interface ChestOdds {
  readonly kind: ChestKind;
  readonly label: string;
  readonly probability: number;
}

const LABELS: Record<ChestKind, string> = {
  xp: "Bonus de XP (25, 50 o 100)",
  fact: "Dato curioso de lo que estudias",
  freeze: "Congelamiento de racha",
  frame: "Marco nuevo para tu HUD",
  "rare-badge": "Insignia rara",
};

/** Probabilidades exactas que se muestran en Ajustes. */
export function chestOdds(): ChestOdds[] {
  const total = CONFIG.chest.reduce((s, c) => s + c.weight, 0);
  return CONFIG.chest.map((c) => ({ kind: c.kind, label: LABELS[c.kind], probability: c.weight / total }));
}

export const RARE_BADGES = ["cofre-dorado", "trebol-de-cuatro", "estrella-fugaz"] as const;

export interface ChestContext {
  readonly freezes: number;
  readonly ownedFrames: readonly string[];
  readonly ownedBadges: readonly string[];
  readonly facts: readonly string[];
}

/**
 * Abre un cofre. Si el premio no aplica (congelamientos al máximo, marcos o insignias ya todos
 * tuyos, sin datos curiosos), se convierte en XP: nunca sale "nada".
 */
export function openChest(rng: Rng, ctx: ChestContext): ChestReward {
  const entry = weightedPick(rng, CONFIG.chest);
  const xpFallback = (): ChestReward => ({ kind: "xp", amount: pick(rng, CONFIG.chest[0].amounts) });
  switch (entry.kind) {
    case "xp":
      return { kind: "xp", amount: pick(rng, entry.amounts) };
    case "fact":
      return ctx.facts.length ? { kind: "fact", fact: pick(rng, ctx.facts) } : xpFallback();
    case "freeze":
      return ctx.freezes < CONFIG.streak.maxFreezes ? { kind: "freeze" } : xpFallback();
    case "frame": {
      const left = CONFIG.frames.filter((f) => !ctx.ownedFrames.includes(f));
      return left.length ? { kind: "frame", frame: pick(rng, left) } : xpFallback();
    }
    case "rare-badge": {
      const left = RARE_BADGES.filter((b) => !ctx.ownedBadges.includes(b));
      return left.length ? { kind: "rare-badge", badge: pick(rng, left) } : xpFallback();
    }
  }
}
