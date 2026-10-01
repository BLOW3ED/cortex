import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonBody } from "@/components/lessons/lesson-body";
import { LESSON_COMPONENT_NAMES } from "@/components/lessons/registry";
import { compileMdx, LessonCompileError } from "./mdx";

const read = (p: string) => readFileSync(p, "utf8");
const render = (file: string) => renderToStaticMarkup(<LessonBody file={file} source={read(file)} />);
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("lecciones reales", () => {
  const LESSONS = ["content/calculo/01-limites/leccion.mdx", "content/programacion/01-variables-y-tipos/leccion.mdx"];

  it.each(LESSONS)("%s compila y se dibuja con KaTeX, tablas y sin errores", (file) => {
    const html = render(file);
    expect(count(html, 'class="katex"')).toBeGreaterThan(0);
    expect(html).not.toContain("katex-error");
    expect(count(html, "<table>")).toBe(1);
    expect(html).toContain('data-kind="predice"');
    expect(html).toContain('data-kind="feynman"');
  });

  it("cálculo: las fórmulas de los atributos también se dibujan y los pasos aparecen", () => {
    const html = render(LESSONS[0] ?? "");
    // `pregunta` de <Predice> y `pasos` de <Desvanecido> traen fórmulas: no deben quedar `$` crudos.
    expect(html).toContain("Multiplica arriba y abajo por el conjugado");
    expect(html).not.toMatch(/\$\\?[a-z]/);
    expect(html).toContain("<summary>Ver respuestas</summary>");
  });

  it("la plantilla de lección compila", () => {
    expect(() => render("content/_plantillas/leccion.mdx")).not.toThrow();
  });

  it("los escapes que documenta docs/05 funcionan", () => {
    const html = render("tests/fixtures/mdx/escapes-validos.mdx");
    expect(html).toContain("{1, 2}");
    expect(html).toContain("$150");
    expect(html).toContain("x &lt; 3");
    expect(html).not.toContain("katex-error");
  });
});

describe("contenido roto falla con la línea exacta del archivo", () => {
  const compile = (name: string) => () =>
    compileMdx({ file: name, source: read(`tests/fixtures/mdx/${name}`), components: LESSON_COMPONENT_NAMES });

  it.each([
    ["latex-roto.mdx", /KaTeX/],
    ["latex-roto-en-atributo.mdx", /<Predice pregunta>: KaTeX/],
    ["etiqueta-desconocida.mdx", /componente MDX no registrado <Predise>/],
    ["barra-simple-en-expresion.mdx", /barra simple/],
    ["expresion-en-texto.mdx", /expresión \{…\} en el texto/],
    ["import.mdx", /import\/export/],
  ])("%s", (name, reason) => {
    let err: unknown;
    try {
      compile(name)();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(LessonCompileError);
    expect((err as LessonCompileError).line).toBe(11);
    expect((err as Error).message).toMatch(reason);
    expect((err as Error).message).toContain(`${name}:11:`);
  });

  it("JSX sin cerrar falla al compilar", () => {
    expect(compile("jsx-sin-cerrar.mdx")).toThrow(LessonCompileError);
  });
});
