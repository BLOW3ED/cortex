import { describe, expect, it } from "vitest";
import { splitBlanks } from "./blanks";

describe("splitBlanks", () => {
  it("parte por huecos sin tocar el texto normal", () => {
    expect(splitBlanks("Se ___ y luego se ___ el factor.")).toEqual(["Se ", " y luego se ", " el factor."]);
  });

  it("cierra y reabre el código alrededor de un hueco", () => {
    expect(splitBlanks("En Python, `7 ___ 2` da 3 y `7 ___ 2` da 1.")).toEqual(["En Python, `7 `", "` 2` da 3 y `7 `", "` 2` da 1."]);
  });

  it("cierra y reabre una fórmula, y omite envolturas vacías", () => {
    expect(splitBlanks("$x = ___$ listo")).toEqual(["$x = $", " listo"]);
    expect(splitBlanks("$a + ___ + b$")).toEqual(["$a + $", "$ + b$"]);
    expect(splitBlanks("`___`")).toEqual(["", ""]);
  });

  it("respeta el signo de pesos escapado", () => {
    expect(splitBlanks("Cuesta \\$5 y ___ más")).toEqual(["Cuesta \\$5 y ", " más"]);
  });
});
