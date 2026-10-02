import { evaluateNumber } from "./math";

/**
 * Normalización de respuestas de texto (`completar`). Sin acentos, mayúsculas ni espacios de más,
 * y sin comillas o backticks alrededor: se califica la idea, no la tipografía.
 */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .trim()
    .replace(/^[`"'«“]+|[`"'»”]+$/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function asNumber(s: string): number | null {
  if (!/^[-+]?[\d.,/ ]+$/.test(s.trim())) return null;
  try {
    const v = evaluateNumber(s);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** ¿Un hueco coincide? Igual como texto normalizado, o como número si ambos lo son ("2" = "2.0"). */
export function blankMatches(user: string, expected: string): boolean {
  if (normalizeText(user) === normalizeText(expected)) return true;
  const a = asNumber(user);
  const b = asNumber(expected);
  return a !== null && b !== null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
}

/**
 * Salida de un programa para `predecir_salida`: se ignoran los espacios al final de cada línea y
 * los espacios y líneas vacías del principio y del final (como verify_content.py, que usa `strip`).
 */
export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n")
    .trim();
}
