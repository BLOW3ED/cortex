import { describe, expect, it } from "vitest";
import { normalizeText, parseYaml } from "./yaml";

describe("parseYaml lee como PyYAML (YAML 1.1)", () => {
  it.each([
    ["[x, y, n, Y, N, z]", ["x", "y", "n", "Y", "N", "z"]],
    ["[yes, no, on, off, true, False]", [true, false, true, false, true, false]],
    ["[010, 0x1f, 0b11, 12, -3, 1_000]", [8, 31, 3, 12, -3, 1000]],
    ["[09, 1e3, 1.0e+3, 0.5, .5, '.']", ["09", "1e3", 1000, 0.5, 0.5, "."]],
    ["[1:30, '1:30']", [90, "1:30"]],
    ["[.inf, -.inf]", [Infinity, -Infinity]],
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
