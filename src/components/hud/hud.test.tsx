import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HudBar } from "./hud-bar";
import { LevelBadge } from "./level-badge";
import { Lives } from "./lives";
import { StreakChip } from "./streak-chip";
import { XpBar } from "./xp-bar";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const filled = (markup: string) => (markup.match(/data-filled="true"/g) ?? []).length;

describe("XpBar", () => {
  it("expone el progreso con role=progressbar y aria", () => {
    const m = html(<XpBar progress={0.42} segments={20} />);
    expect(m).toContain('role="progressbar"');
    expect(m).toContain('aria-valuenow="42"');
    expect(m).toContain('aria-valuemin="0"');
    expect(m).toContain('aria-valuemax="100"');
    expect(filled(m)).toBe(8);
  });

  it.each([
    [1.5, "100", 20],
    [-1, "0", 0],
    [Number.NaN, "0", 0],
    [Number.POSITIVE_INFINITY, "0", 0],
  ])("acota %s a [0, 1]", (progress, now, ticks) => {
    const m = html(<XpBar progress={progress} />);
    expect(m).toContain(`aria-valuenow="${now}"`);
    expect(m).not.toContain("NaN");
    expect(filled(m)).toBe(ticks);
  });

  it("sin datos queda en carga, sin valor inventado", () => {
    const m = html(<XpBar progress={null} />);
    expect(m).toContain('aria-busy="true"');
    expect(m).not.toContain("aria-valuenow");
    expect(filled(m)).toBe(0);
  });
});

describe("StreakChip", () => {
  it.each([
    [0, "Empieza hoy", "Racha: empieza hoy", null],
    [1, "1 día", "Racha: 1 día", "1"],
    [4, "4 días", "Racha: 4 días", "4"],
    [1240, "1,240 días", "Racha: 1,240 días", "1.2\u00a0k"], // Intl usa espacio sin corte
  ])("%s días", (days, text, label, short) => {
    const m = html(<StreakChip days={days} />);
    expect(m).toContain(text);
    // role="img": un aria-label en un span sin rol no lo anuncian los lectores de pantalla.
    expect(m).toContain(`role="img" aria-label="${label}"`);
    // En pantallas chicas solo el número (en 0, solo la llama), sin partirse en dos renglones.
    expect(m).toContain("whitespace-nowrap");
    if (short === null) expect(m).not.toContain("md:hidden");
    else expect(m).toContain(`md:hidden">${short}</span>`);
  });
});

describe("Lives", () => {
  it.each([
    [3, 3, "3 de 3 vidas", 3],
    [2, 3, "2 de 3 vidas", 2],
    [0, 3, "0 de 3 vidas", 0],
    [1, 1, "1 de 1 vida", 1],
    [5, 3, "3 de 3 vidas", 3],
  ])("%s de %s", (current, max, label, full) => {
    const m = html(<Lives current={current} max={max} />);
    expect(m).toContain(`aria-label="${label}"`);
    expect((m.match(/data-full="true"/g) ?? []).length).toBe(full);
    expect((m.match(/<svg/g) ?? []).length).toBe(max);
  });
});

describe("LevelBadge y HudBar", () => {
  it("muestra el nivel y la XP con separador de miles", () => {
    const m = html(<HudBar data={{ xpTotal: 1240, level: 5, currentStreak: 3, levelProgress: 0.5 }} />);
    expect(m).toContain('role="img" aria-label="Nivel 5"');
    expect(m).toContain("1,240 XP");
    expect(m).toContain("3 días");
  });

  it("en carga no inventa números y es igual en servidor y cliente", () => {
    const m = html(<HudBar data={null} />);
    expect(m).toContain('aria-label="Nivel: cargando"');
    expect(m).toContain("– XP");
    expect(m).not.toMatch(/\d+ XP/);
    expect(html(<LevelBadge level={null} />)).toContain("–");
  });
});

describe("guardarraíles de docs/03", () => {
  const states = [
    html(<HudBar data={null} />),
    html(<HudBar data={{ xpTotal: 0, level: 1, currentStreak: 0, levelProgress: 0 }} />),
    html(<HudBar data={{ xpTotal: 99_999, level: 40, currentStreak: 365, levelProgress: 1 }} />),
    html(<Lives current={0} max={3} />),
  ].join("\n");

  it("ningún estado usa lenguaje de culpa", () => {
    for (const word of ["pierdes", "perder", "perdiste", "fallaste", "última oportunidad", "no te rindas", "se acaba", "vergüenza"]) {
      expect(states.toLowerCase()).not.toContain(word);
    }
  });

  it("toda animación queda detrás de motion-safe", () => {
    const classes = [...states.matchAll(/class="([^"]*)"/g)].flatMap((m) => (m[1] ?? "").split(/\s+/));
    const animated = classes.filter((c) => /(^|:)(transition|animate-|duration-)/.test(c) && c !== "arcade");
    expect(animated.filter((c) => !c.startsWith("motion-safe:"))).toEqual([]);
  });
});
