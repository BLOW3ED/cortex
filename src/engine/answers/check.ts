import type { Exercise } from "@/content/schema";
import { closeEnough, evaluateNumber, ExpressionError } from "./math";
import { symbolicMatch } from "./symbolic";
import { blankMatches, normalizeOutput } from "./text";

/** Lo que el usuario respondió, según el tipo de ejercicio. */
export type Answer =
  | { readonly kind: "choice"; readonly index: number }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "blanks"; readonly values: readonly string[] }
  | { readonly kind: "order"; readonly items: readonly string[] }
  | { readonly kind: "self"; readonly text: string; readonly met: readonly boolean[] }
  /** Código: el runner ya corrió los tests; aquí solo llega el veredicto. */
  | { readonly kind: "code"; readonly code: string; readonly passed: boolean; readonly summary: string }
  /** Mecánicas con varias partes (Debug Dojo, Parsons, rastreo): el componente arma el veredicto. */
  | { readonly kind: "steps"; readonly passed: boolean; readonly summary: string };

export type CheckResult =
  | { readonly status: "correct" }
  | { readonly status: "wrong"; readonly expected: string }
  /** No se pudo interpretar la respuesta: no cuenta como intento. */
  | { readonly status: "invalid"; readonly message: string };

/** Fracción de la rúbrica que hay que cumplir en una autoevaluación. */
export const SELF_ASSESSMENT_SHARE = 0.8;

const wrong = (expected: string): CheckResult => ({ status: "wrong", expected });
const invalid = (message: string): CheckResult => ({ status: "invalid", message });

function mismatch(answer: Answer, expected: Answer["kind"]): CheckResult {
  return invalid(`Respuesta de tipo «${answer.kind}» para un ejercicio que espera «${expected}».`);
}

/** Califica una respuesta. Puro y síncrono (< 1 ms en los casos normales). */
export function checkAnswer(ex: Exercise, answer: Answer): CheckResult {
  switch (ex.tipo) {
    case "opcion_multiple": {
      if (answer.kind !== "choice") return mismatch(answer, "choice");
      return answer.index === ex.correcta ? { status: "correct" } : wrong(ex.opciones[ex.correcta] ?? "");
    }
    case "numerico": {
      if (answer.kind !== "text") return mismatch(answer, "text");
      let got: number;
      try {
        got = evaluateNumber(answer.value);
      } catch (e) {
        return invalid(e instanceof ExpressionError ? e.message : "Escribe un número.");
      }
      if (Number.isNaN(got)) return invalid("Escribe un número.");
      const expected = evaluateNumber(ex.respuesta);
      return closeEnough(got, expected, ex.tolerancia ?? 0) ? { status: "correct" } : wrong(String(ex.respuesta));
    }
    case "simbolico": {
      if (answer.kind !== "text") return mismatch(answer, "text");
      try {
        const r = symbolicMatch(answer.value, ex.respuesta, ex.variables);
        if (r === "equivalent") return { status: "correct" };
        if (r === "undetermined") return invalid("No pude evaluar tu expresión en suficientes puntos. ¿Está bien escrita?");
        return wrong(String(ex.respuesta));
      } catch (e) {
        return invalid(e instanceof ExpressionError ? e.message : "No entendí la expresión.");
      }
    }
    case "completar": {
      if (answer.kind !== "blanks") return mismatch(answer, "blanks");
      if (answer.values.length !== ex.respuestas.length) return invalid("Llena todos los huecos.");
      if (answer.values.some((v) => !v.trim())) return invalid("Llena todos los huecos.");
      const ok = ex.respuestas.every((r, i) => blankMatches(answer.values[i] ?? "", r));
      return ok ? { status: "correct" } : wrong(ex.respuestas.join(" · "));
    }
    case "ordenar": {
      if (answer.kind !== "order") return mismatch(answer, "order");
      const ok = answer.items.length === ex.elementos.length && ex.elementos.every((e, i) => answer.items[i] === e);
      return ok ? { status: "correct" } : wrong(ex.elementos.join(" → "));
    }
    case "predecir_salida": {
      if (answer.kind !== "text") return mismatch(answer, "text");
      return normalizeOutput(answer.value) === normalizeOutput(ex.respuesta) ? { status: "correct" } : wrong(ex.respuesta);
    }
    case "autoevaluacion": {
      if (answer.kind !== "self") return mismatch(answer, "self");
      if (!answer.text.trim()) return invalid("Escribe tu explicación antes de compararla.");
      const met = answer.met.filter(Boolean).length;
      return met >= Math.ceil(SELF_ASSESSMENT_SHARE * ex.rubrica.length) ? { status: "correct" } : wrong(ex.respuesta_modelo);
    }
    case "codigo": {
      if (answer.kind !== "code") return mismatch(answer, "code");
      return answer.passed ? { status: "correct" } : wrong(answer.summary);
    }
    default: {
      if (answer.kind !== "steps") return invalid("Tipo de ejercicio sin verificador.");
      return answer.passed ? { status: "correct" } : wrong(answer.summary);
    }
  }
}
