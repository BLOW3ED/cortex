import { describe, expect, it } from "vitest";
import { integralFloats, normalizeText, parseYaml } from "./yaml";

describe("parseYaml lee como PyYAML (YAML 1.1)", () => {
  it.each([
    ["[x, y, n, Y, N, z]", ["x", "y", "n", "Y", "N", "z"]],
    ["[yes, no, on, off, true, False]", [true, false, true, false, true, false]],
    ["[010, 0x1f, 0b11, 12, -3, 1_000]", [8, 31, 3, 12, -3, 1000]],
    ["[09, 1e3, 1.0e+3, 0.5, .5, '.']", ["09", "1e3", 1000, 0.5, 0.5, "."]],
    ["[1:30, '1:30']", [90, "1:30"]],
    ["[.inf, -.inf]", [Infinity, -Infinity]],
    ["[-.5, +.5, ._5, -1.5, -.5e+3, 1.5e+3]", ["-.5", "+.5", "._5", -1.5, "-.5e+3", 1500]],
    ["[0:30, 01:30]", ["0:30", "01:30"]],
    ["[2026-1-1, '2026-1-1']", ["2026-1-1", "2026-1-1"]],
  ])("%s", (src, expected) => {
    expect(parseYaml(src)).toEqual(expected);
  });

  it("lee un mapa con LaTeX entre comillas simples sin tocar las barras", () => {
    expect(parseYaml("enunciado: 'Calcula $\\lim_{x\\to 2}$.'")).toEqual({ enunciado: "Calcula $\\lim_{x\\to 2}$." });
  });

  it("lanza con YAML roto", () => {
    expect(() => parseYaml("a: [1, 2")).toThrow();
  });
});

describe("normalizeText", () => {
  it("quita el BOM y convierte CRLF y CR en LF", () => {
    expect(normalizeText("﻿a\r\nb\rc\n")).toBe("a\nb\nc\n");
  });
});

describe("integralFloats", () => {
  it("encuentra enteros escritos con decimales en los campos indicados", () => {
    const src = "dificultad: 4.0\ncorrecta: 0\nx: 1.5\nrecompensa: { xp: 300.0 }\ntolerancia: 0.5\n";
    expect(integralFloats(src, new Set(["dificultad", "correcta", "xp"]))).toEqual([
      { field: "dificultad", source: "4.0" },
      { field: "xp", source: "300.0" },
    ]);
  });

  it("no marca enteros bien escritos ni YAML roto", () => {
    expect(integralFloats("dificultad: 4\n", new Set(["dificultad"]))).toEqual([]);
    expect(integralFloats("a: [1, 2", new Set(["a"]))).toEqual([]);
  });
});
