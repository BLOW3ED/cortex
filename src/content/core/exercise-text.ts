import type { Exercise } from "../schema";
import { splitBlanks } from "./blanks";

/** Un texto de un ejercicio que la app dibuja como Markdown + KaTeX. */
export interface TextField {
  readonly field: string;
  readonly text: string;
  readonly inline: boolean;
}

/**
 * Todos los textos con Markdown de un ejercicio (lo que `content:check` valida y la app dibuja).
 * El código (`codigo`, `plantilla`, `solucion`) y las salidas exactas no son Markdown.
 */
export function exerciseTextFields(ex: Exercise): TextField[] {
  const out: TextField[] = [
    { field: "enunciado", text: ex.enunciado, inline: false },
    { field: "explicacion", text: ex.explicacion, inline: false },
    ...(ex.pistas ?? []).map((text, i) => ({ field: `pistas[${i}]`, text, inline: false })),
  ];
  switch (ex.tipo) {
    case "opcion_multiple":
      out.push(...ex.opciones.map((text, i) => ({ field: `opciones[${i}]`, text, inline: true })));
      break;
    case "completar":
      out.push(...splitBlanks(ex.texto).map((text, i) => ({ field: `texto (tramo ${i + 1})`, text, inline: true })));
      break;
    case "ordenar":
      out.push(...ex.elementos.map((text, i) => ({ field: `elementos[${i}]`, text, inline: true })));
      break;
    case "autoevaluacion":
      out.push(...ex.rubrica.map((text, i) => ({ field: `rubrica[${i}]`, text, inline: true })));
      out.push({ field: "respuesta_modelo", text: ex.respuesta_modelo, inline: false });
      break;
    case "rastreo_memoria":
      ex.pasos.forEach((p, i) => {
        if (p.nota) out.push({ field: `pasos[${i}].nota`, text: p.nota, inline: false });
        if (p.pregunta) out.push({ field: `pasos[${i}].pregunta`, text: p.pregunta, inline: true });
      });
      break;
    default:
      break;
  }
  return out.filter((f) => f.text.trim() !== "");
}
