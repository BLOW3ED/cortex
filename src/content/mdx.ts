import { compileSync, type CompileOptions, runSync } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { BLANK, type ComponentSpec } from "./core/lesson-api";

/**
 * Pipeline único de lecciones (ADR-012): MDX → remark-gfm (tablas) → remark-math → guardia de
 * Cortex → rehype-katex en modo estricto. Todo es síncrono para poder dibujar también los
 * atributos de los componentes (`InlineMarkdown`) dentro de un render de servidor.
 *
 * La guardia trata la lección como DATOS: solo componentes registrados con sus props, valores
 * literales, sin código, y toda fórmula (también la de los atributos) tiene que dibujarse.
 */

export class LessonCompileError extends Error {
  constructor(
    readonly file: string,
    readonly line: number | null,
    readonly reason: string,
  ) {
    super(`${file}${line ? `:${line}` : ""}: ${reason}`);
    this.name = "LessonCompileError";
  }
}

/** Etiquetas HTML en minúsculas que se permiten dentro de una lección (sin atributos, salvo `title` en `abbr`). */
const SAFE_HTML = new Set(["br", "sub", "sup", "kbd", "mark", "small", "abbr", "u", "s"]);

// Tipos mínimos del árbol de MDX (mdast + mdx + estree) que usa la guardia.
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
  loc?: { start: { line: number; column: number }; end: { line: number; column: number } } | null;
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
  position?: Place;
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
  value: unknown;
  message(reason: string, options?: { place?: Place; source?: string; ruleId?: string }): unknown;
}

/**
 * Barra simple dentro de un string de JS (`{[...]}`): `\to` se vuelve tabulador + "o", `\{` se
 * vuelve `{`, `\,` se vuelve `,`... sin error. Solo se aceptan `\\`, `\"`, `\'` y `` \` ``.
 */
const SINGLE_BACKSLASH = /(?<!\\)(?:\\\\)*\\[^\\"'`]/;
/** `$` sin barra antes: si quedó como texto, es una fórmula sin cerrar (el dinero va como `\$`). */
const BARE_DOLLAR = /(?<!\\)(?:\\\\)*\$/;

const KATEX_OPTIONS = {
  strict: "error",
  // KaTeX dibuja en rojo, sin lanzar, los comandos no confiables (\href, \url, \includegraphics...).
  trust: (ctx: { command: string }): boolean => {
    throw new Error(`comando no permitido en Cortex: ${ctx.command}`);
  },
} as const;

/** Componente de una lección compilada (lo que exporta el MDX). */
export type MDXContent = ReturnType<typeof runSync>["default"];

const placeOf = (loc: EsNode["loc"]): Place | undefined =>
  loc
    ? { start: { line: loc.start.line, column: loc.start.column + 1 }, end: { line: loc.end.line, column: loc.end.column + 1 } }
    : undefined;

/** Valor literal de una expresión de atributo, o `undefined` si es código (llamadas, variables, JSX...). */
type Literal = string | number | boolean | null | Literal[];
function literalOf(node: EsNode): { ok: true; value: Literal } | { ok: false } {
  switch (node.type) {
    case "Literal":
      return { ok: true, value: (node.value ?? null) as string | number | boolean | null };
    case "TemplateLiteral":
      return node.expressions?.length ? { ok: false } : { ok: true, value: (node.quasis ?? []).map((q) => q.value.cooked ?? "").join("") };
    case "ArrayExpression": {
      const out: Literal[] = [];
      for (const e of node.elements ?? []) {
        const v = e ? literalOf(e) : { ok: false as const };
        if (!v.ok) return { ok: false };
        out.push(v.value);
      }
      return { ok: true, value: out };
    }
    default:
      return { ok: false };
  }
}

/** Revisa los nodos de texto de un árbol: `$` sin cerrar y HTML que se perdería. */
function textProblems(tree: MdNode, source: string, onProblem: (node: MdNode, reason: string) => void, allowHtml: boolean) {
  const walk = (node: MdNode) => {
    if (node.type === "text" && node.position?.start.offset !== undefined && node.position.end.offset !== undefined) {
      const raw = source.slice(node.position.start.offset, node.position.end.offset);
      if (BARE_DOLLAR.test(raw)) {
        onProblem(node, `un \`$\` sin cerrar deja la fórmula como texto crudo (si es dinero, escríbelo \\$): «${raw.trim().slice(0, 60)}»`);
      }
    }
    if (!allowHtml && node.type === "html") {
      onProblem(node, `«${(node.value ?? "").slice(0, 40)}» se perdería: escríbelo entre backticks (\`vector<int>\`) o con &lt;`);
    }
    node.children?.forEach(walk);
  };
  walk(tree);
}

/** Compila el texto de un atributo como Markdown con KaTeX estricto; devuelve el primer problema o `null`. */
function attributeTextProblem(text: string): string | null {
  const problems: string[] = [];
  const collect = () => (tree: MdNode) => textProblems(tree, text, (_n, r) => problems.push(r), false);
  const file = compileSync(text, {
    format: "md",
    outputFormat: "function-body",
    remarkPlugins: [remarkGfm, remarkMath, collect],
    rehypePlugins: [[rehypeKatex, KATEX_OPTIONS]],
  });
  const m = file.messages.find((x) => x.source === "rehype-katex");
  if (m) return `KaTeX no puede dibujar la fórmula: ${m.cause instanceof Error ? m.cause.message : m.reason}`;
  return problems[0] ?? null;
}

function remarkCortexGuard(options: { components: Readonly<Record<string, ComponentSpec>> }) {
  const api = options.components;
  return (tree: MdNode, file: FileLike) => {
    const source = typeof file.value === "string" ? file.value : String(file.value ?? "");
    const fail = (place: Place | undefined, reason: string) => file.message(reason, { place, source: "cortex", ruleId: "guard" });

    const checkComponent = (node: MdNode, name: string) => {
      const spec = Object.hasOwn(api, name) ? api[name] : undefined;
      const lower = /^[a-z]/.test(name);
      if (lower ? !SAFE_HTML.has(name) : !spec) {
        const hint = lower ? " (si es código, escríbelo entre backticks)" : "";
        fail(node.position, `componente MDX no registrado <${name || "fragmento"}>${hint}`);
        return;
      }
      const values = new Map<string, Literal>();
      for (const attr of node.attributes ?? []) {
        const place = attr.position ?? node.position;
        if (attr.type !== "mdxJsxAttribute" || !attr.name) {
          fail(place, `<${name}> usa atributos con {...spread}; no se permiten`);
          continue;
        }
        const label = `<${name} ${attr.name}>`;
        if (lower) {
          if (!(name === "abbr" && attr.name === "title")) fail(place, `${label}: las etiquetas HTML no llevan atributos aquí`);
          continue;
        }
        const propSpec = spec?.props[attr.name];
        if (!propSpec) {
          const valid = Object.keys(spec?.props ?? {});
          fail(place, `<${name}> no tiene la prop '${attr.name}'${valid.length ? ` (usa: ${valid.join(", ")})` : ""}`);
          continue;
        }
        const v = attr.value;
        if (typeof v === "string") {
          values.set(attr.name, v);
        } else if (v?.type === "mdxJsxAttributeValueExpression") {
          if (SINGLE_BACKSLASH.test(v.value)) {
            fail(place, `${label} tiene una barra simple (p. ej. \\to o \\{): dentro de {…} cada barra va doble (\\\\to)`);
            continue;
          }
          const expr = v.data?.estree?.body?.[0]?.expression;
          const lit = expr ? literalOf(expr) : { ok: false as const };
          if (!lit.ok) {
            fail(place, `${label}: solo se permiten valores literales (textos o listas de textos), no código`);
            continue;
          }
          values.set(attr.name, lit.value);
          // Cada elemento de una lista se valida con su propia línea.
          if (expr?.type === "ArrayExpression") {
            for (const el of expr.elements ?? []) {
              if (el?.type === "Literal" && typeof el.value === "string") {
                const problem = attributeTextProblem(el.value);
                if (problem) fail(placeOf(el.loc) ?? place, `${label}: ${problem}`);
              }
            }
          }
        } else {
          values.set(attr.name, true);
        }
        const value = values.get(attr.name);
        const okType =
          propSpec.type === "string"
            ? typeof value === "string"
            : Array.isArray(value) && value.every((x) => typeof x === "string");
        if (!okType) {
          fail(place, `${label} debe ser ${propSpec.type === "string" ? 'un texto ("...")' : 'una lista de textos ({["...", "..."]})'}`);
          continue;
        }
        if (typeof value === "string") {
          const problem = attributeTextProblem(value);
          if (problem) fail(place, `${label}: ${problem}`);
        }
      }
      if (!spec) return;
      for (const [prop, ps] of Object.entries(spec.props)) {
        if (ps.required && !values.has(prop)) fail(node.position, `<${name}> necesita la prop '${prop}'`);
      }
      const hasChildren = (node.children ?? []).some((c) => !(c.type === "text" && !(c.value ?? "").trim()));
      if (!spec.children && hasChildren) fail(node.position, `<${name}> no lleva contenido adentro; ciérralo con />`);
      if (name === "Desvanecido") {
        const pasos = values.get("pasos");
        const respuestas = values.get("respuestas");
        if (Array.isArray(pasos) && Array.isArray(respuestas)) {
          const blanks = pasos.reduce<number>((n, p) => n + (typeof p === "string" ? p.split(BLANK).length - 1 : 0), 0);
          if (blanks !== respuestas.length) {
            fail(node.position, `<Desvanecido>: hay ${blanks} hueco(s) ${BLANK} en pasos y ${respuestas.length} respuesta(s)`);
          }
        }
      }
    };

    const walk = (node: MdNode) => {
      switch (node.type) {
        case "mdxjsEsm":
          fail(node.position, "las lecciones no pueden usar import/export");
          break;
        case "mdxFlowExpression":
        case "mdxTextExpression": {
          const code = (node.value ?? "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
          if (code) fail(node.position, "expresión {…} en el texto: escribe la llave como \\{");
          break;
        }
        case "mdxJsxFlowElement":
        case "mdxJsxTextElement":
          checkComponent(node, node.name ?? "");
          break;
      }
      node.children?.forEach(walk);
    };
    walk(tree);
    textProblems(tree, source, (node, reason) => fail(node.position, reason), true);
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
  /** Componentes permitidos y sus props (`LESSON_API`). */
  readonly components: Readonly<Record<string, ComponentSpec>>;
  /** `md`: texto de un atributo (sin JSX); `mdx`: lección completa. */
  readonly format?: "md" | "mdx";
}

function compileOptions(input: CompileInput): CompileOptions {
  return {
    format: input.format ?? "mdx",
    outputFormat: "function-body",
    development: false,
    remarkPlugins: [remarkGfm, remarkMath, [remarkCortexGuard, { components: input.components }]],
    rehypePlugins: [[rehypeKatex, KATEX_OPTIONS]],
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
    const reason = err.reason ?? err.message ?? String(e);
    // Errores típicos de escribir `<` o `{` como texto: el parser de MDX los toma como JSX o código.
    const hint = /closing tag|Unexpected character|Could not parse expression|Unexpected end of file/.test(reason)
      ? " · si es código o texto con < o {, escríbelo entre backticks o escápalo (\\< \\{), ver docs/05"
      : "";
    throw new LessonCompileError(input.file, err.line ?? null, reason + hint);
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
