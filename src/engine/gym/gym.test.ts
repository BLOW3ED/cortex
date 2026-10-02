import { describe, expect, it } from "vitest";
import { createRng } from "../rng";
import { generateArithmetic } from "./arithmetic";
import { generateNback, nextN, scoreNback } from "./nback";
import { generateSequence, SEQUENCE_MAX_LEVEL } from "./sequences";
import { createStaircase, stepStaircase } from "./staircase";

describe("escalera 2 arriba / 1 abajo", () => {
  it("sube tras 2 aciertos y baja tras 1 error, sin salirse de los límites", () => {
    let s = createStaircase(3, 1, 5);
    s = stepStaircase(s, true);
    expect(s.level).toBe(3);
    s = stepStaircase(s, true);
    expect(s.level).toBe(4);
    s = stepStaircase(s, false);
    expect(s.level).toBe(3);
    let low = createStaircase(1, 1, 5);
    low = stepStaircase(low, false);
    expect(low.level).toBe(1);
    let high = createStaircase(5, 1, 5);
    high = stepStaircase(stepStaircase(high, true), true);
    expect(high.level).toBe(5);
  });
});

describe("n-back", () => {
  it("genera rondas reproducibles con coincidencias marcadas correctamente", () => {
    const a = generateNback(createRng(9), 2);
    expect(generateNback(createRng(9), 2)).toEqual(a);
    expect(a.positions).toHaveLength(22);
    a.targets.forEach((t, i) => {
      if (i < 2) expect(t).toBe(false);
      else expect(t).toBe(a.positions[i] === a.positions[i - 2]);
    });
    expect(a.targets.filter(Boolean).length).toBeGreaterThan(2);
  });

  it("puntúa y ajusta N", () => {
    const round = generateNback(createRng(4), 1);
    const perfect = scoreNback(round, round.targets);
    expect(perfect.accuracy).toBe(1);
    expect(perfect.falseAlarms).toBe(0);
    const lazy = scoreNback(round, []);
    expect(lazy.hits).toBe(0);
    expect(nextN(2, 0.9)).toBe(3);
    expect(nextN(2, 0.5)).toBe(1);
    expect(nextN(1, 0.1)).toBe(1);
    expect(nextN(2, 0.7)).toBe(2);
  });
});

describe("cálculo mental", () => {
  it("genera operaciones con respuesta entera correcta en todos los niveles", () => {
    const rng = createRng(11);
    for (let level = 1; level <= 10; level++) {
      for (let i = 0; i < 60; i++) {
        const item = generateArithmetic(rng, level);
        expect(Number.isInteger(item.answer)).toBe(true);
        const [l, op, r] = item.prompt.replace(" % de ", " % ").split(" ");
        const a = Number(l);
        const b = Number(r);
        const expected = op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : op === "÷" ? a / b : (a * b) / 100;
        expect(item.answer).toBe(expected);
      }
    }
  });
});

describe("secuencias", () => {
  it("tiene 5 términos y una respuesta consistente con la regla", () => {
    const rng = createRng(21);
    for (let level = 1; level <= SEQUENCE_MAX_LEVEL; level++) {
      for (let i = 0; i < 30; i++) {
        const s = generateSequence(rng, level);
        expect(s.terms).toHaveLength(5);
        expect(Number.isInteger(s.answer)).toBe(true);
        if (level === 1) expect(s.answer - (s.terms[4] ?? 0)).toBe((s.terms[1] ?? 0) - (s.terms[0] ?? 0));
        if (level === 6) expect(s.answer).toBe((s.terms[4] ?? 0) + (s.terms[3] ?? 0));
      }
    }
  });
});
