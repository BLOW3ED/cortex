import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonBody } from "@/components/lessons/lesson-body";
import { LESSON_API } from "@/content/core/lesson-api";
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
    compileMdx({ file: name, source: read(`tests/fixtures/mdx/${name}`), components: LESSON_API });

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

describe("guardia de lecciones · casos de la revisión adversarial", () => {
  // 8 líneas de front matter + 1 vacía: el cuerpo empieza en la línea 10.
  const FM = '---\ntitulo: "x"\nmateria: calculo\nunidad: 01-limites\nduracion_min: 5\nconceptos: [a]\nprograma_ref: "x"\n---\n\n';
  const fail = (body: string) => {
    try {
      compileMdx({ file: "f.mdx", source: FM + body, components: LESSON_API });
    } catch (e) {
      if (e instanceof LessonCompileError) return { line: e.line, message: e.message };
      throw e;
    }
    return null;
  };

  it("en un <Desvanecido> de varias líneas, el error apunta a la línea del paso", () => {
    const r = fail('<Desvanecido titulo="x" pasos={[\n  "Paso uno.",\n  "Paso dos.",\n  "Paso tres $\\\\dfrac{1}$."\n]} />\n');
    expect(r?.line).toBe(13);
    expect(r?.message).toMatch(/KaTeX/);
  });

  it("en un <Predice> de varias líneas, el error apunta a la línea del atributo", () => {
    const r = fail('<Predice\n  pregunta="Bien."\n  revela="Mal: $\\dfrac{1}$"\n/>\n');
    expect(r?.line).toBe(12);
  });

  it.each([
    ["\\href", "Ver $\\href{https://x.com}{x}$."],
    ["\\url", "Ver $\\url{https://x.com}$."],
    ["\\includegraphics", "Ver $\\includegraphics{/x.png}$."],
  ])("%s es error (KaTeX lo dibujaría en rojo sin avisar)", (_cmd, body) => {
    expect(fail(`${body}\n`)?.message).toMatch(/comando no permitido/);
  });

  it.each([
    ["\\{", '<Desvanecido pasos={["El conjunto $\\{1, 2\\}$."]} />'],
    ["\\,", '<Desvanecido pasos={["Espacio $a\\,b$."]} />'],
    ["\\n", '<Desvanecido pasos={["Salto\\nraro."]} />'],
  ])("barra simple antes de %s dentro de {[...]} es error", (_c, body) => {
    expect(fail(`${body}\n`)?.message).toMatch(/barra simple/);
  });

  it("las expresiones de atributo solo pueden ser literales", () => {
    expect(fail('<Predice pregunta={fetch("x")} />\n')?.message).toMatch(/solo se permiten valores literales/);
    expect(fail("<Predice pregunta={<b>hola</b>} />\n")?.message).toMatch(/solo se permiten valores literales/);
    expect(fail('<Predice pregunta={`a ${"b"}`} />\n')?.message).toMatch(/solo se permiten valores literales/);
  });

  it("las etiquetas HTML permitidas no llevan atributos", () => {
    expect(fail('Texto <sup dangerouslySetInnerHTML={{__html: "x"}} /> fin.\n')?.message).toMatch(/no llevan atributos/);
    expect(fail('Texto <abbr title="Inteligencia artificial">IA</abbr> fin.\n')).toBeNull();
  });

  it("un $ sin cerrar es error (en el texto y en un atributo)", () => {
    expect(fail("Calcula $x^2 y sigue.\n")?.message).toMatch(/\$` sin cerrar/);
    expect(fail('<Predice pregunta="Calcula $x^2 y sigue." />\n')?.message).toMatch(/\$` sin cerrar/);
    expect(fail("Cuesta \\$150 y $x$ es fórmula.\n")).toBeNull();
  });

  it("HTML dentro de un atributo es error (se perdería)", () => {
    expect(fail('<Predice pregunta="Declara vector<int> v." />\n')?.message).toMatch(/backticks/);
    expect(fail('<Predice pregunta="Declara `vector<int>` v." />\n')).toBeNull();
  });

  it("valida las props de cada componente", () => {
    expect(fail('<Predice pregunat="x" />\n')?.message).toMatch(/no tiene la prop 'pregunat'/);
    expect(fail('<Predice revela="x" />\n')?.message).toMatch(/necesita la prop 'pregunta'/);
    expect(fail('<Desvanecido pasos="un texto" />\n')?.message).toMatch(/debe ser una lista de textos/);
    expect(fail('<Predice pregunta="x">\nTexto adentro.\n</Predice>\n')?.message).toMatch(/no lleva contenido adentro/);
    expect(fail('<Visual />\n')?.message).toMatch(/necesita la prop 'id'/);
  });

  it("<Desvanecido>: los huecos ___ deben coincidir con las respuestas", () => {
    expect(fail('<Desvanecido pasos={["a ___ b ___"]} respuestas={["x"]} />\n')?.message).toMatch(/2 hueco\(s\) ___ en pasos y 1 respuesta/);
    expect(fail('<Desvanecido pasos={["a ___ b ___"]} respuestas={["x", "y"]} />\n')).toBeNull();
  });

  it("una etiqueta en minúsculas desconocida sugiere backticks", () => {
    expect(fail("El tipo <vector> no existe.\n")?.message).toMatch(/backticks/);
  });

  it("los huecos ___ se dibujan como espacios visibles", () => {
    const html = renderToStaticMarkup(
      <LessonBody file="f.mdx" source={`${FM}<Desvanecido pasos={["El resultado es ___ ."]} respuestas={["3"]} />\n`} />,
    );
    expect(html).toContain('class="lesson-blank"');
    expect(html).not.toContain("<hr");
  });
});
