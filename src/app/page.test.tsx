import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("inicio", () => {
  it("muestra el nombre de la app y las materias con contenido", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain("<h1>Cortex</h1>");
    expect(html).toContain("Cálculo · 1 unidad");
    expect(html).toContain("Fundamentos de programación · 1 unidad");
  });
});
