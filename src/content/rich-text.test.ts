import { describe, expect, it } from "vitest";
import { renderRichText, renderRichTextSafe, RichTextError } from "./rich-text";

describe("texto enriquecido de ejercicios", () => {
  it("dibuja Markdown y fórmulas con KaTeX", () => {
    const html = renderRichText("Calcula $\\lim_{x\\to 2}(3x^2)$ con **cuidado** y `print(1)`.");
    expect(html).toContain('class="katex"');
    expect(html).toContain("<strong>cuidado</strong>");
    expect(html).toContain("<code>print(1)</code>");
    expect(html.startsWith("<p>")).toBe(true);
  });

  it("en modo inline no envuelve en <p>", () => {
    const html = renderRichText("$x+1$", { inline: true });
    expect(html.startsWith("<p>")).toBe(false);
    expect(html).toContain("katex");
  });

  it("acepta \\$ como signo de pesos", () => {
    expect(renderRichText("Cuesta \\$150")).toContain("$150");
  });

  it.each([
    ["fórmula rota", "Calcula $\\frac{1}{$", /KaTeX/],
    ["comando no confiable", "$\\href{https://x.y}{z}$", /KaTeX/],
    ["$ sin cerrar", "Cuesta $150", /sin cerrar/],
    ["HTML crudo", "Hola <b>mundo</b>", /HTML no permitido/],
    ["imagen", "![gato](https://x.y/g.png)", /imágenes/],
    ["enlace con javascript:", "[clic](javascript:alert(1))", /enlace no permitido/],
  ])("rechaza %s", (_name, text, reason) => {
    expect(() => renderRichText(text)).toThrow(RichTextError);
    expect(() => renderRichText(text)).toThrow(reason);
  });

  it("permite enlaces http(s) e internos", () => {
    expect(renderRichText("[docs](https://docs.python.org) y [inicio](/)")).toContain('href="https://docs.python.org"');
  });

  it("la versión segura escapa en vez de lanzar", () => {
    expect(renderRichTextSafe("a <b> $")).toBe("a &lt;b&gt; $");
  });
});
