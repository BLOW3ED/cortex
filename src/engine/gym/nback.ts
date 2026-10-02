import { CONFIG } from "../config";
import { randInt, type Rng } from "../rng";

/**
 * N-back visual (docs/06, memoria de trabajo): una casilla se ilumina en una cuadrícula de 3×3;
 * respondes "coincide" si es la misma de hace N pasos. N sube o baja por ronda.
 */

export interface NbackRound {
  readonly n: number;
  /** Posición 0–8 de cada estímulo. */
  readonly positions: readonly number[];
  /** `true` donde el estímulo coincide con el de hace N. */
  readonly targets: readonly boolean[];
}

/** Ronda con ~30 % de coincidencias garantizadas (sin coincidencias accidentales de más). */
export function generateNback(rng: Rng, n: number, trials: number = CONFIG.gym.nbackTrials + n): NbackRound {
  const positions: number[] = [];
  const targets: boolean[] = [];
  for (let i = 0; i < trials; i++) {
    const back = positions[i - n];
    if (back !== undefined && rng() < 0.3) {
      positions.push(back);
      targets.push(true);
    } else {
      let p = randInt(rng, 0, 8);
      if (back !== undefined) while (p === back) p = randInt(rng, 0, 8);
      positions.push(p);
      targets.push(false);
    }
  }
  return { n, positions, targets };
}

export interface NbackScore {
  readonly hits: number;
  readonly misses: number;
  readonly falseAlarms: number;
  readonly correctRejections: number;
  /** (aciertos + rechazos correctos) / ensayos evaluables. */
  readonly accuracy: number;
}

/** `responses[i]` = el usuario dijo "coincide" en el ensayo i. Los primeros N no se evalúan. */
export function scoreNback(round: NbackRound, responses: readonly boolean[]): NbackScore {
  let hits = 0;
  let misses = 0;
  let falseAlarms = 0;
  let correctRejections = 0;
  for (let i = round.n; i < round.targets.length; i++) {
    const said = responses[i] ?? false;
    if (round.targets[i]) {
      if (said) hits++;
      else misses++;
    } else if (said) falseAlarms++;
    else correctRejections++;
  }
  const total = hits + misses + falseAlarms + correctRejections;
  return { hits, misses, falseAlarms, correctRejections, accuracy: total ? (hits + correctRejections) / total : 0 };
}

/** Siguiente N: ≥ 85 % sube, < 65 % baja (entre 1 y 9). */
export function nextN(n: number, accuracy: number): number {
  if (accuracy >= 0.85) return Math.min(9, n + 1);
  if (accuracy < 0.65) return Math.max(1, n - 1);
  return n;
}
