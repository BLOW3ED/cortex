import { compileSync, type CompileOptions, runSync } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/**
 * Pipeline único de lecciones (ADR-012): MDX → remark-gfm (tablas) → remark-math → guardia de
 * Cortex → rehype-katex en modo estricto. Todo es síncrono para poder dibujar también los
 * atributos de los componentes (`InlineMarkdown`) dentro de un render de servidor.
 */

export class LessonCompileError extends Error {
  constructor(
    readonly file: string,
    readonly line: number | null,
    reason: string,
  ) {
    super(`${file}${line ? `:${line}` : ""}: ${reason}`);
    this.name = "LessonCompileError";
  }
}

/** Etiquetas HTML en minúsculas que se permiten dentro de una lección. */
const SAFE_HTML = new Set(["br", "sub", "sup", "kbd", "mark", "small", "abbr", "u", "s"]);

// Tipos mínimos del árbol de MDX (mdast + mdx) que usa la guardia.
interface Point {
  line: number;
  column: number;
  offset?: number;
}
interface Place {
  start: Point;
  end: Point;
}
interface EsNode {
  type: string;
  value?: unknown;
  expression?: EsNode;
  elements?: (EsNode | null)[];
  quasis?: { value: { cooked?: string | null } }[];
  expressions?: EsNode[];
}
interface AttrValueExpression {
  type: "mdxJsxAttributeValueExpression";
  value: string;
  data?: { estree?: { body?: EsNode[] } | null };
}
interface MdAttr {
  type: string;
  name?: string;
  value?: string | AttrValueExpression | null;
}
interface MdNode {
  type: string;
  name?: string | null;
  value?: string;
  attributes?: MdAttr[];
  children?: MdNode[];
  position?: Place;
}
interface FileLike {
  message(reason: string, options?: { place?: Place; source?: string; ruleId?: string }): unknown;
}

/** `\` seguida de una letra con un número impar de barras: en un string de JS se pierde la barra. */
const SINGLE_BACKSLASH = /(?<!\\)(?:\\\\)*\\[A-Za-z]/;

/** Componente de una lección compilada (lo que exporta el MDX). */
export type MDXContent = ReturnType<typeof runSync>["default"];

/** Strings literales dentro de una expresión de atributo (`["a", "b"]`, `` `c` ``). */
function stringsIn(node: EsNode): string[] {
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string" ? [node.value] : [];
    case "ArrayExpression":
      return (node.elements ?? []).flatMap((e) => (e ? stringsIn(e) : []));
    case "TemplateLiteral":
      return (node.quasis ?? []).map((q) => q.value.cooked ?? "");
    default:
      return [];
  }
}

/** Compila un texto de atributo como Markdown con KaTeX estricto; devuelve el problema o `null`. */
function inlineMathProblem(text: string): string | null {
  const file = compileSync(text, {
    format: "md",
    outputFormat: "function-body",
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [[rehypeKatex, { strict: "error" }]],
  });
  const m = file.messages.find((x) => x.source === "rehype-katex");
  return m ? (m.cause instanceof Error ? m.cause.message : m.reason) : null;
}

/** Rechaza componentes no registrados, código (import/export, `{...}` en el texto) y barras simples. */
function remarkCortexGuard(options: { components: readonly string[] }) {
  const allowed = new Set(options.components);
  return (tree: MdNode, file: FileLike) => {
    const fail = (node: MdNode, reason: string) =>
      file.message(reason, { place: node.position, source: "cortex", ruleId: "guard" });
    const visit = (node: MdNode) => {
      switch (node.type) {
        case "mdxjsEsm":
          fail(node, "las lecciones no pueden usar import/export");
          break;
        case "mdxFlowExpression":
        case "mdxTextExpression": {
          const code = (node.value ?? "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
          if (code) fail(node, "expresión {…} en el texto: escribe la llave como \\{");
          break;
        }
        case "mdxJsxFlowElement":
        case "mdxJsxTextElement": {
          const name = node.name ?? "";
          const ok = /^[a-z]/.test(name) ? SAFE_HTML.has(name) : allowed.has(name);
          if (!ok) fail(node, `componente MDX no registrado <${name || "fragmento"}>`);
          for (const attr of node.attributes ?? []) {
            if (attr.type !== "mdxJsxAttribute") {
              fail(node, `<${name}> usa atributos con {...spread}; no se permiten`);
              continue;
            }
            const v = attr.value;
            const label = `<${name} ${attr.name ?? ""}>`;
            let texts: string[] = [];
            if (typeof v === "string") texts = [v];
            else if (v?.type === "mdxJsxAttributeValueExpression") {
              if (SINGLE_BACKSLASH.test(v.value)) {
                fail(node, `${label} tiene una barra simple (p. ej. \\to): dentro de {…} cada barra va doble (\\\\to)`);
                continue;
              }
              texts = (v.data?.estree?.body ?? []).flatMap((st) => (st.expression ? stringsIn(st.expression) : []));
            }
            for (const text of texts) {
              const problem = text.includes("$") ? inlineMathProblem(text) : null;
              if (problem) fail(node, `${label}: KaTeX no puede dibujar la fórmula: ${problem}`);
            }
          }
          break;
        }
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

/** Reemplaza el front matter por líneas vacías para que los números de línea coincidan con el archivo. */
export function blankFrontmatter(source: string): string {
  const text = source.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const m = /^---\n[\s\S]*?\n---\n/.exec(text);
  return m ? "\n".repeat(m[0].split("\n").length - 1) + text.slice(m[0].length) : text;
}

interface CompileInput {
  /** Ruta para los mensajes de error (`content/calculo/01-limites/leccion.mdx`). */
  readonly file: string;
  readonly source: string;
  /** Nombres de componentes permitidos (el registro de `src/components/lessons`). */
  readonly components: readonly string[];
  /** `md`: texto de un atributo (sin JSX); `mdx`: lección completa. */
  readonly format?: "md" | "mdx";
}

function compileOptions(input: CompileInput): CompileOptions {
  return {
    format: input.format ?? "mdx",
    outputFormat: "function-body",
    development: false,
    remarkPlugins: [remarkGfm, remarkMath, [remarkCortexGuard, { components: input.components }]],
    rehypePlugins: [[rehypeKatex, { strict: "error" }]],
  };
}

/** Compila y evalúa una lección (o un fragmento de Markdown). Lanza `LessonCompileError` con la línea. */
export function compileMdx(input: CompileInput): MDXContent {
  const source = input.format === "md" ? input.source : blankFrontmatter(input.source);
  let file;
  try {
    file = compileSync({ value: source, path: input.file }, compileOptions(input));
  } catch (e) {
    const err = e as { reason?: string; message?: string; line?: number | null };
    throw new LessonCompileError(input.file, err.line ?? null, err.reason ?? err.message ?? String(e));
  }
  const fatal = file.messages.find((m) => m.source === "rehype-katex" || m.source === "cortex");
  if (fatal) {
    const reason =
      fatal.source === "rehype-katex"
        ? `KaTeX no puede dibujar la fórmula: ${fatal.cause instanceof Error ? fatal.cause.message : fatal.reason}`
        : fatal.reason;
    throw new LessonCompileError(input.file, fatal.line ?? null, reason);
  }
  return runSync(String(file), { ...runtime, baseUrl: import.meta.url }).default;
}
