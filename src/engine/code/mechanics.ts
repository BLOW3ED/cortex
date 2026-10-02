import type { TraceStep } from "@/content/schema";
import { blankMatches } from "../answers/text";

/** Calificación pura de Parsons y del rastreo de memoria (sin ejecutar código). */

export interface PlacedLine {
  readonly text: string;
  readonly indent: number;
}

/** Sangría (en niveles de 4 espacios) de una línea del YAML. */
export function indentLevel(line: string): number {
  return Math.floor((line.length - line.trimStart().length) / 4);
}

/** ¿El programa armado es exactamente el de `lineas`? En Python también cuenta la sangría. */
export function parsonsExact(lineas: readonly string[], placed: readonly PlacedLine[], python: boolean): boolean {
  return placed.length === lineas.length && lineas.every((l, i) => placed[i]?.text === l.trim() && (!python || placed[i]?.indent === indentLevel(l)));
}

/** Programa armado como texto (en C la sangría no importa). */
export function assemble(placed: readonly PlacedLine[], python: boolean): string {
  return `${placed.map((p) => `${python ? " ".repeat(4 * p.indent) : ""}${p.text}`).join("\n")}\n`;
}

export type TraceVerdict = { readonly status: "missing"; readonly steps: number[] } | { readonly status: "graded"; readonly passed: boolean; readonly lines: string[] };

/** Califica las respuestas del rastreo (una por paso con pregunta). */
export function traceVerdict(pasos: readonly TraceStep[], answers: Readonly<Record<number, string>>): TraceVerdict {
  const questions = pasos.map((p, i) => ({ p, i })).filter(({ p }) => p.pregunta);
  const missing = questions.filter(({ i }) => !(answers[i] ?? "").trim()).map(({ i }) => i + 1);
  if (missing.length) return { status: "missing", steps: missing };
  const rows = questions.map(({ p, i }) => {
    const mine = (answers[i] ?? "").trim();
    const ok = blankMatches(mine, p.respuesta ?? "");
    return { ok, text: `${ok ? "✓" : "✗"} Paso ${i + 1}: ${p.pregunta} → ${mine}${ok ? "" : ` (era ${p.respuesta})`}` };
  });
  return { status: "graded", passed: rows.every((r) => r.ok), lines: rows.map((r) => r.text) };
}
