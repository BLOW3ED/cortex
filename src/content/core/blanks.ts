import { BLANK } from "./lesson-api";

/**
 * Parte un texto con huecos `___` en tramos que se pueden dibujar por separado. Si un hueco cae
 * dentro de código (`` `7 ___ 2` ``) o de una fórmula (`$x = ___$`), se cierra el tramo antes del
 * hueco y se vuelve a abrir después, para que cada tramo sea Markdown válido por sí mismo.
 */
export function splitBlanks(text: string): string[] {
  const out: string[] = [];
  let inCode = false;
  let inMath = false;
  for (const part of text.split(BLANK)) {
    let body = part;
    let prefix = "";
    // Si el tramo anterior quedó abierto: o este lo cierra de inmediato, o se reabre.
    if (inCode) {
      if (body.startsWith("`")) {
        body = body.slice(1);
        inCode = false;
      } else prefix = "`";
    } else if (inMath) {
      if (body.startsWith("$")) {
        body = body.slice(1);
        inMath = false;
      } else prefix = "$";
    }
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      // En código la barra es literal; fuera de él escapa el siguiente carácter (p. ej. `\$`).
      if (c === "\\" && !inCode) {
        i++;
        continue;
      }
      if (c === "`" && !inMath) inCode = !inCode;
      else if (c === "$" && !inCode) inMath = !inMath;
    }
    const seg = `${prefix}${body}${inMath ? "$" : ""}${inCode ? "`" : ""}`;
    out.push(isEmptyWrapper(seg) ? "" : seg);
  }
  return out;
}

/** Un tramo que quedó como `` ` ` `` o `$ $` vacío no se dibuja. */
function isEmptyWrapper(seg: string): boolean {
  const t = seg.trim();
  return /^`\s*`$/.test(t) || /^\$\s*\$$/.test(t);
}
