import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * Los tokens de color viven solo en src/app/globals.css. Esta prueba los lee, los convierte de
 * OKLCH a sRGB y exige contraste WCAG AA en ambos temas: 4.5:1 para texto y 3:1 para elementos
 * de interfaz (foco, bordes de campos, ticks de XP, íconos de vida).
 */
const css = readFileSync("src/app/globals.css", "utf8");

function themeBlock(selector: RegExp): Record<string, [number, number, number]> {
  const m = selector.exec(css);
  if (!m?.[1]) throw new Error(`no encontré el bloque ${selector}`);
  const vars: Record<string, [number, number, number]> = {};
  for (const v of m[1].matchAll(/--([a-z0-9-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/g)) {
    vars[v[1] ?? ""] = [Number(v[2]), Number(v[3]), Number(v[4])];
  }
  return vars;
}

/** OKLCH → luminancia relativa (WCAG), con recorte a la gama sRGB. */
function luminance([L, C, H]: [number, number, number]): number {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (x: number) => Math.min(1, Math.max(0, x));
  const r = clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const THEMES = {
  oscuro: themeBlock(/\.dark,\s*\.theme-dark\s*\{([^}]*)\}/),
  claro: themeBlock(/:root,\s*\.theme-light\s*\{([^}]*)\}/),
};

const TEXT = 4.5;
const UI = 3;
const PAIRS: [fg: string, bg: string, min: number][] = [
  ["ink", "bg", TEXT],
  ["ink", "surface", TEXT],
  ["ink", "surface-2", TEXT],
  ["ink-2", "surface", TEXT],
  ["muted", "bg", TEXT],
  ["muted", "surface", TEXT],
  ["muted", "surface-2", TEXT],
  ["brand-ink", "brand", TEXT],
  ["xp-ink", "xp", TEXT],
  ["streak-ink", "streak", TEXT],
  ["danger-ink", "danger", TEXT],
  ["brand", "surface", TEXT],
  ["danger", "surface", TEXT],
  ["warning", "surface", TEXT],
  ["info", "surface", TEXT],
  ["streak", "surface", TEXT],
  ["xp-text", "surface", TEXT],
  ["xp-text", "bg", TEXT],
  ["life", "surface", UI],
  ["xp", "surface", UI],
  ["xp", "bg", UI],
  ["ring", "bg", UI],
  ["ring", "surface", UI],
  ["input", "surface", UI],
];

describe.each(Object.entries(THEMES))("tokens del tema %s", (_name, vars) => {
  it("definen los mismos nombres que el otro tema", () => {
    expect(Object.keys(vars).sort()).toEqual(Object.keys(THEMES.oscuro).sort());
  });

  it.each(PAIRS)("%s sobre %s ≥ %s:1", (fg, bg, min) => {
    const a = vars[fg];
    const b = vars[bg];
    expect(a, `falta --${fg}`).toBeDefined();
    expect(b, `falta --${bg}`).toBeDefined();
    expect(contrast(a ?? [0, 0, 0], b ?? [0, 0, 0])).toBeGreaterThanOrEqual(min);
  });
});

describe("reglas globales", () => {
  it("prefers-reduced-motion anula animaciones y transiciones", () => {
    const block = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    expect(block).toContain("transition-duration: 0.01ms !important");
    expect(block).toContain("animation-duration: 0.01ms !important");
    expect(block).toContain("--dur-fast: 0ms");
  });

  it("hay foco visible para todo lo enfocable", () => {
    expect(css).toMatch(/:focus-visible \{\s*outline: 2px solid var\(--ring\)/);
  });
});
