import { describe, expect, it } from "vitest";
import { findPython } from "../../scripts/lib/find-python";
import { compareWithPyYaml } from "../../scripts/lib/yaml-parity";

describe("paridad YAML con PyYAML real", () => {
  const py = findPython();
  if (!py.ok) throw new Error("se necesita Python 3.11+ con sympy y PyYAML");

  it("no hay diferencias en los casos que el lector ya ajusta", () => {
    const sources = [
      "variables: [x, y, n, Y, N]",
      "a: [yes, no, on, off]",
      "b: [010, 09, 1e3, 1.0e+3, '.', 1:30, .inf]",
      "c: [-.5, +.5, ._5, -1.5, -.5e+3, 1.5e+3, .5]",
      "d: [0:30, 01:30, 2026-1-1, '2026-1-1 1:02:03']",
      "fecha: 2026-10-01",
      "texto: 'Calcula $\\lim_{x\\to 2}$'",
    ].map((text, i) => ({ path: `caso-${i}.yaml`, text }));
    expect(compareWithPyYaml(sources, py.python)).toEqual([]);
  });

  it("detecta un valor que se lee distinto", () => {
    const diffs = compareWithPyYaml([{ path: "x.yaml", text: "a: !!binary aGVsbG8=" }], py.python);
    expect(diffs.map((d) => d.path)).toEqual(["x.yaml"]);
  });

  it("un YAML roto es error en ambos lados (sin diferencia)", () => {
    expect(compareWithPyYaml([{ path: "roto.yaml", text: "a: [1, 2" }], py.python)).toEqual([]);
  });
});
