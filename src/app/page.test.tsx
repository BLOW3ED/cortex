import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("inicio", () => {
  const html = renderToStaticMarkup(<HomePage />);

  it("lista los 8 semestres y las 45 entradas del mapa", () => {
    expect(html.match(/aria-labelledby="semestre-\d"/g)).toHaveLength(8);
    expect(html.match(/data-has-content="(true|false)"/g)).toHaveLength(45);
  });

  it("solo cálculo y programación están marcadas con contenido y enlazadas", () => {
    expect(html.match(/data-has-content="true"/g)).toHaveLength(2);
    expect(html).toContain('href="/materias/calculo"');
    expect(html).toContain('href="/materias/programacion"');
    expect(html).not.toContain('href="/materias/algebra-lineal"');
  });

  it("ofrece las 2 lecciones disponibles", () => {
    expect(html).toContain('href="/materias/calculo/01-limites"');
    expect(html).toContain('href="/materias/programacion/01-variables-y-tipos"');
  });

  it("muestra la fase de cada materia (Mecánica y EM en Fase 4)", () => {
    expect(html).toMatch(/Mecánica y electromagnetismo<\/h4><span[^>]*>Fase 4</);
  });
});
