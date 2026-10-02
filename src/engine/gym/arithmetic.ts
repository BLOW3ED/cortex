import { pick, randInt, type Rng } from "../rng";

/**
 * Cálculo mental adaptativo (docs/06): sumas, restas, productos, divisiones exactas y
 * porcentajes. El nivel (1–10) controla el tamaño de los números y las operaciones.
 */

export interface ArithmeticItem {
  readonly prompt: string;
  readonly answer: number;
  readonly level: number;
}

const OPS_BY_LEVEL: readonly (readonly string[])[] = [
  ["+", "-"],
  ["+", "-"],
  ["+", "-", "×"],
  ["+", "-", "×"],
  ["+", "-", "×", "÷"],
  ["+", "-", "×", "÷"],
  ["×", "÷", "%"],
  ["×", "÷", "%"],
  ["+", "-", "×", "÷", "%"],
  ["×", "÷", "%"],
];

export function generateArithmetic(rng: Rng, levelIn: number): ArithmeticItem {
  const level = Math.min(10, Math.max(1, Math.round(levelIn)));
  const op = pick(rng, OPS_BY_LEVEL[level - 1] ?? ["+"]);
  const big = level <= 2 ? 20 : level <= 4 ? 99 : level <= 7 ? 199 : 999;
  const small = level <= 4 ? 9 : level <= 7 ? 15 : 25;
  switch (op) {
    case "+": {
      const a = randInt(rng, 2, big);
      const b = randInt(rng, 2, big);
      return { prompt: `${a} + ${b}`, answer: a + b, level };
    }
    case "-": {
      const a = randInt(rng, 2, big);
      const b = randInt(rng, 2, big);
      const [x, y] = level <= 3 ? [Math.max(a, b), Math.min(a, b)] : [a, b];
      return { prompt: `${x} − ${y}`, answer: x - y, level };
    }
    case "×": {
      const a = randInt(rng, 2, small);
      const b = randInt(rng, 2, level <= 4 ? 9 : small + 4);
      return { prompt: `${a} × ${b}`, answer: a * b, level };
    }
    case "÷": {
      const b = randInt(rng, 2, small);
      const q = randInt(rng, 2, small + 3);
      return { prompt: `${b * q} ÷ ${b}`, answer: q, level };
    }
    default: {
      // Porcentaje con resultado entero: p % de n.
      const p = pick(rng, [10, 20, 25, 50, 75, 5, 15, 30, 40, 60]);
      const unit = 100 / gcd(p, 100);
      const n = unit * randInt(rng, 1, Math.max(2, Math.floor(big / unit)));
      return { prompt: `${p} % de ${n}`, answer: (p * n) / 100, level };
    }
  }
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
