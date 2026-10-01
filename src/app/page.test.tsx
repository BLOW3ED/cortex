import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("inicio", () => {
  it("muestra el nombre de la app", () => {
    expect(renderToStaticMarkup(<HomePage />)).toContain("<h1>Cortex</h1>");
  });
});
