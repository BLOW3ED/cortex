import type { Element, ElementContent, Root as HastRoot } from "hast";
import { toHtml } from "hast-util-to-html";
import type { Root as MdastRoot, RootContent } from "mdast";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { type Processor, unified } from "unified";
import type { VFile } from "vfile";

/**
 * Texto de los ejercicios (enunciado, opciones, pistas, explicación...) a HTML, con el mismo
 * `remark-math` + `rehype-katex` estricto de las lecciones (ADR-012, ADR-017). Corre igual en el
 * navegador (al mostrar) y en Node (`content:check` lo valida antes de que llegue a la app).
 *
 * Es Markdown puro, no MDX: sin componentes ni HTML. Se rechaza lo que se perdería o pediría a
 * la red: HTML crudo, imágenes y `$` sin cerrar (el dinero va como `\$`).
 */

export class RichTextError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "RichTextError";
  }
}

const KATEX_OPTIONS = {
  strict: "error",
  trust: (ctx: { command: string }): boolean => {
    throw new Error(`comando no permitido en Cortex: ${ctx.command}`);
  },
} as const;

/** Enlaces permitidos (defensa extra: el HTML se inyecta en la página). */
const SAFE_URL = /^(https?:\/\/|mailto:|\/|#)/i;

/** `$` sin barra antes en el texto fuente: es una fórmula sin cerrar. */
const BARE_DOLLAR = /(?<!\\)(?:\\\\)*\$/;

interface MdNode {
  type: string;
  children?: MdNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
}

/** Guardia sobre el árbol de Markdown. */
function remarkGuard() {
  return (tree: MdastRoot, file: VFile) => {
    const source = String(file.value);
    const visit = (node: MdNode) => {
      if (node.type === "html") file.message("HTML no permitido en el texto de un ejercicio: escríbelo entre backticks", { source: "cortex" });
      if (node.type === "image" || node.type === "imageReference") file.message("imágenes no permitidas (pedirían a la red)", { source: "cortex" });
      if (node.type === "link" && !SAFE_URL.test(String((node as { url?: unknown }).url ?? ""))) {
        file.message("enlace no permitido: solo http(s), mailto o rutas internas", { source: "cortex" });
      }
      if (node.type === "text") {
        const start = node.position?.start.offset;
        const end = node.position?.end.offset;
        const raw = start !== undefined && end !== undefined ? source.slice(start, end) : "";
        if (BARE_DOLLAR.test(raw)) file.message("`$` sin cerrar: una fórmula va entre $...$ y el dinero se escribe \\$", { source: "cortex" });
      }
      node.children?.forEach(visit);
    };
    (tree.children as RootContent[]).forEach((c) => visit(c as unknown as MdNode));
  };
}

/** Compilador a HTML; en modo `inline`, un único párrafo se dibuja sin la etiqueta `<p>`. */
function htmlCompiler(this: Processor, options: { inline: boolean }) {
  this.compiler = ((tree: HastRoot) => {
    const only = tree.children.filter((c) => !(c.type === "text" && !c.value.trim()));
    if (options.inline && only.length === 1 && only[0]?.type === "element" && (only[0] as Element).tagName === "p") {
      return toHtml({ type: "root", children: (only[0] as Element).children as ElementContent[] });
    }
    return toHtml(tree);
  }) as never;
}

function makeProcessor(inline: boolean) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkGuard)
    .use(remarkRehype)
    .use(rehypeKatex, KATEX_OPTIONS)
    .use(htmlCompiler, { inline });
}

const processors = { block: makeProcessor(false), inline: makeProcessor(true) };
const cache = new Map<string, string>();

/** Dibuja `text` a HTML. Lanza `RichTextError` si la fórmula no se puede dibujar o algo no se permite. */
export function renderRichText(text: string, options: { inline?: boolean } = {}): string {
  const key = `${options.inline ? "i" : "b"}\u0000${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const file = processors[options.inline ? "inline" : "block"].processSync(text);
  const fatal = file.messages.find((m) => m.source === "rehype-katex" || m.source === "cortex");
  if (fatal) {
    throw new RichTextError(
      fatal.source === "rehype-katex"
        ? `KaTeX no puede dibujar la fórmula: ${fatal.cause instanceof Error ? fatal.cause.message : fatal.reason}`
        : fatal.reason,
    );
  }
  const html = String(file.value);
  if (cache.size > 2000) cache.clear();
  cache.set(key, html);
  return html;
}

/** Igual, pero sin lanzar: si algo falla devuelve el texto escapado (la validación ya corrió en `content:check`). */
export function renderRichTextSafe(text: string, options: { inline?: boolean } = {}): string {
  try {
    return renderRichText(text, options);
  } catch {
    return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
  }
}
