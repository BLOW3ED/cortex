import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { addDays, dayKey, daysBetween, weekStart } from "./dates";
import { levelInfo, titleForLevel, xpForLevel, xpToNext } from "./levels";
import { createRng, pick, seedFrom, shuffle, weightedPick } from "./rng";
import { bossXp, practiceXp, reviewXp } from "./xp";

describe("niveles", () => {
  it("sigue la curva 100 · n^1.5", () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(2)).toBe(283);
    expect(xpToNext(4)).toBe(800);
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(3)).toBe(383);
  });

  it("calcula nivel y avance desde el XP total", () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, into: 0, span: 100, progress: 0 });
    expect(levelInfo(99).level).toBe(1);
    expect(levelInfo(100)).toMatchObject({ level: 2, into: 0, span: 283 });
    expect(levelInfo(383).level).toBe(3);
    const mid = levelInfo(150);
    expect(mid.progress).toBeGreaterThan(0.17);
    expect(mid.progress).toBeLessThan(0.18);
  });

  it("no se rompe con valores raros", () => {
    expect(levelInfo(-5).level).toBe(1);
    expect(levelInfo(Number.NaN).level).toBe(1);
    expect(levelInfo(Number.POSITIVE_INFINITY).level).toBe(1);
    expect(levelInfo(1e12).level).toBeLessThanOrEqual(CONFIG.levels.max);
  });

  it("da títulos cosméticos por nivel", () => {
    expect(titleForLevel(1)).toBe("Novato curioso");
    expect(titleForLevel(4)).toBe("Aprendiz de laboratorio");
    expect(titleForLevel(100)).toBe("Leyenda del cortex");
  });
});

describe("XP", () => {
  const base = { difficulty: 3 as const, correct: true, firstEver: false, correctTodayBefore: 0, hintsUsed: 0, confidence: null };

  it("sigue la tabla de docs/03", () => {
    for (const d of [1, 2, 3, 4, 5] as const) {
      expect(practiceXp({ ...base, difficulty: d }).total).toBe([5, 8, 12, 18, 25][d - 1]);
    }
  });

  it("no da XP por fallar", () => {
    expect(practiceXp({ ...base, correct: false }).total).toBe(0);
    expect(reviewXp({ correct: false, elapsedDays: 30, confidence: 3 }).total).toBe(0);
  });

  it("suma +50 % al primer intento y +2 por confianza alta", () => {
    expect(practiceXp({ ...base, firstEver: true }).total).toBe(18);
    expect(practiceXp({ ...base, confidence: 3 }).total).toBe(14);
  });

  it("aplica rendimientos decrecientes al repetir el mismo día", () => {
    expect(practiceXp({ ...base, correctTodayBefore: 1 }).total).toBe(6);
    expect(practiceXp({ ...base, correctTodayBefore: 2 }).total).toBe(3);
    expect(practiceXp({ ...base, correctTodayBefore: 3 }).total).toBe(0);
    expect(practiceXp({ ...base, correctTodayBefore: 50 }).total).toBe(0);
  });

  it("cobra poco por las pistas y nunca baja del piso", () => {
    expect(practiceXp({ ...base, hintsUsed: 1 }).total).toBe(10);
    expect(practiceXp({ ...base, hintsUsed: 10 }).total).toBe(5);
  });

  it("da XP de repaso con bonus por intervalo largo", () => {
    expect(reviewXp({ correct: true, elapsedDays: 1, confidence: null }).total).toBe(6);
    expect(reviewXp({ correct: true, elapsedDays: 7, confidence: null }).total).toBe(8);
    expect(reviewXp({ correct: true, elapsedDays: 7, confidence: 3 }).total).toBe(10);
  });

  it("da la recompensa del jefe completa solo la primera vez", () => {
    expect(bossXp(300, false, false).total).toBe(300);
    expect(bossXp(300, true, false).total).toBe(30);
    expect(bossXp(300, false, true).total).toBe(325);
  });
});

describe("fechas", () => {
  it("cuenta días sin depender del horario de verano", () => {
    expect(daysBetween("2026-03-01", "2026-04-05")).toBe(35);
    expect(daysBetween("2026-10-02", "2026-10-01")).toBe(-1);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("usa semanas de lunes a domingo", () => {
    expect(weekStart("2026-10-02")).toBe("2026-09-28"); // viernes → lunes
    expect(weekStart("2026-09-28")).toBe("2026-09-28");
    expect(weekStart("2026-10-04")).toBe("2026-09-28"); // domingo
  });

  it("forma el día local", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("azar con semilla", () => {
  it("es reproducible", () => {
    const a = createRng(42);
    const b = createRng(42);
    const xs = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(seedFrom("2026-10-02")).toBe(seedFrom("2026-10-02"));
    expect(seedFrom("2026-10-02")).not.toBe(seedFrom("2026-10-03"));
  });

  it("baraja sin perder elementos y elige por peso", () => {
    const rng = createRng(7);
    expect(shuffle(rng, [1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(pick(rng, ["a"])).toBe("a");
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 2000; i++) counts[weightedPick(rng, [{ id: "a" as const, weight: 9 }, { id: "b" as const, weight: 1 }]).id]++;
    expect(counts.a / 2000).toBeGreaterThan(0.85);
    expect(() => weightedPick(rng, [{ weight: 0 }])).toThrow();
  });
});
