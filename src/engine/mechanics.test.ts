import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, type AchievementStats, bossAchievementId, newAchievements } from "./achievements";
import { answerBoss, autopsy, waveSizes, beatsGhost, bossScore, currentQuestion, currentWave, ghostCorrectAt, ghostSummary, planBoss, startBoss, timeoutBoss } from "./boss";
import { chestOdds, openChest } from "./chest";
import { CONFIG } from "./config";
import { DAY_MS } from "./dates";
import { addAnswer, emptyDay } from "./day";
import { initialLevel, nextFlow, pickExercise, workedExampleFor } from "./flow";
import { baseline, divisionDelta, evaluateLeague, ratioFor, START_LEAGUE, weekXp } from "./league";
import { conceptMastery, missingPrerequisites, unitMastery } from "./mastery";
import { generateMissions, missionLabel, updateMissions } from "./missions";
import { applyRecords, sessionCandidates } from "./records";
import { createRng } from "./rng";
import { chooseMission, currentUnits, gymGameFor, phasesOf, stepFor, type UnitState } from "./session";
import { gradeFrom, intervalDays, isDue, newCard, Rating, reviewCard, warmupQueue } from "./srs";
import { EMPTY_STREAK, minimumMet, onMinimumMet, tryRepair, visibleStreak } from "./streak";

const NOW = Date.UTC(2026, 9, 2, 15, 0, 0);

describe("FSRS", () => {
  it("crea tarjetas nuevas vencidas y las programa al responder", () => {
    const c = newCard("calc-01-001", NOW);
    expect(c.state).toBe(0);
    expect(isDue(c, NOW)).toBe(true);
    const good = reviewCard(c, Rating.Good, NOW);
    expect(good.elapsedDays).toBe(0);
    expect(good.card.reps).toBe(1);
    expect(good.card.due).toBeGreaterThan(NOW);
    expect(good.card.lastReview).toBe(NOW);
  });

  it("alarga el intervalo con aciertos y lo acorta con un fallo", () => {
    let c = newCard("x", NOW);
    let t = NOW;
    for (let i = 0; i < 4; i++) {
      c = reviewCard(c, Rating.Good, t).card;
      t = c.due;
    }
    expect(intervalDays(c, t - 1)).toBeGreaterThanOrEqual(0);
    const before = c.stability;
    const again = reviewCard(c, Rating.Again, t).card;
    expect(again.lapses).toBe(1);
    expect(again.stability).toBeLessThan(before);
    expect(again.due - t).toBeLessThan(DAY_MS);
  });

  it("traduce intentos a calificaciones", () => {
    const base = { correct: true, hintsUsed: 0, timeMs: 60_000, difficulty: 3 as const, confidence: 2 as const };
    expect(gradeFrom({ ...base, correct: false })).toBe(Rating.Again);
    expect(gradeFrom({ ...base, hintsUsed: 1 })).toBe(Rating.Hard);
    expect(gradeFrom({ ...base, confidence: 1 })).toBe(Rating.Hard);
    expect(gradeFrom(base)).toBe(Rating.Good);
    expect(gradeFrom({ ...base, timeMs: 5_000, confidence: 3 })).toBe(Rating.Easy);
    expect(gradeFrom({ ...base, timeMs: 5_000, confidence: 2 })).toBe(Rating.Good);
  });

  it("arma el calentamiento con las vencidas, prioridades primero y de fácil a difícil", () => {
    const mk = (id: string, due: number, difficulty: number) => ({ ...newCard(id, NOW), due, difficulty });
    const cards = [mk("a", NOW - 1000, 7), mk("b", NOW - 5000, 2), mk("c", NOW + DAY_MS, 1), mk("d", NOW - 10, 5)];
    expect(warmupQueue(cards, NOW).map((c) => c.exerciseId)).toEqual(["b", "d", "a"]);
    expect(warmupQueue(cards, NOW, 1).map((c) => c.exerciseId)).toEqual(["b"]);
    expect(warmupQueue(cards, NOW, 1, new Set(["a"])).map((c) => c.exerciseId)).toEqual(["a"]);
  });
});

describe("racha con perdón", () => {
  it("empieza, se extiende y gana congelamientos cada 7 días", () => {
    let s = onMinimumMet(EMPTY_STREAK, "2026-10-01").state;
    expect(s.current).toBe(1);
    expect(onMinimumMet(s, "2026-10-01").events).toEqual([]);
    for (let d = 2; d <= 7; d++) s = onMinimumMet(s, `2026-10-0${d}`).state;
    expect(s.current).toBe(7);
    expect(s.freezes).toBe(1);
    expect(s.max).toBe(7);
  });

  it("gasta congelamientos por los días faltantes y conserva la racha", () => {
    const s = { ...EMPTY_STREAK, current: 10, max: 10, freezes: 2, lastDay: "2026-10-01" };
    const r = onMinimumMet(s, "2026-10-04");
    expect(r.state.current).toBe(11);
    expect(r.state.freezes).toBe(0);
    expect(r.events[0]).toEqual({ kind: "freeze-used", count: 2 });
  });

  it("si se rompe, ofrece reparación con doble misión en 48 h", () => {
    const s = { ...EMPTY_STREAK, current: 12, max: 12, freezes: 0, lastDay: "2026-10-01" };
    const broken = onMinimumMet(s, "2026-10-05");
    expect(broken.state.current).toBe(1);
    expect(broken.state.repair).toEqual({ previous: 12, deadline: "2026-10-06" });
    expect(tryRepair(broken.state, "2026-10-05", { correct: 3, reviewBlockDone: false }).events).toEqual([]);
    const fixed = tryRepair(broken.state, "2026-10-06", { correct: 6, reviewBlockDone: false });
    expect(fixed.state.current).toBe(13);
    expect(fixed.state.repair).toBeNull();
    const late = tryRepair(broken.state, "2026-10-07", { correct: 50, reviewBlockDone: true });
    expect(late.state.repair).toBeNull();
    expect(late.state.current).toBe(1);
  });

  it("muestra la racha guardada sin culpa y la misión mínima", () => {
    const s = { ...EMPTY_STREAK, current: 5, max: 5, freezes: 1, lastDay: "2026-10-01" };
    expect(visibleStreak(s, "2026-10-02")).toEqual({ current: 5, atRisk: false });
    expect(visibleStreak(s, "2026-10-03")).toEqual({ current: 5, atRisk: true });
    expect(visibleStreak(s, "2026-10-04")).toEqual({ current: 0, atRisk: false });
    expect(minimumMet({ correct: 3, reviewBlockDone: false })).toBe(true);
    expect(minimumMet({ correct: 0, reviewBlockDone: true })).toBe(true);
    expect(minimumMet({ correct: 2, reviewBlockDone: false })).toBe(false);
  });
});

describe("día, misiones y cofre", () => {
  it("acumula contadores del día y limita el tiempo activo por respuesta", () => {
    let d = emptyDay("2026-10-02");
    d = addAnswer(d, { correct: true, review: false, difficulty: 4, confidence: 3, timeMs: 10_000, xp: 20 });
    d = addAnswer(d, { correct: true, review: true, difficulty: 1, confidence: 2, timeMs: 3_600_000, xp: 6 });
    d = addAnswer(d, { correct: false, review: false, difficulty: 2, confidence: 3, timeMs: 1000, xp: 0 });
    expect(d).toMatchObject({ xp: 26, answered: 3, correct: 2, reviews: 1, reviewsCorrect: 1, highConfCorrect: 1, hardCorrect: 1, combo: 0, bestCombo: 2 });
    expect(d.activeMs).toBe(10_000 + 300_000 + 1000);
  });

  it("genera 3 misiones reproducibles según el contexto", () => {
    const a = generateMissions("2026-10-02", { dueReviews: 10, lessonAvailable: true });
    expect(a).toHaveLength(CONFIG.missions.perDay);
    expect(generateMissions("2026-10-02", { dueReviews: 10, lessonAvailable: true })).toEqual(a);
    expect(new Set(a.map((m) => m.kind)).size).toBe(3);
    for (let i = 0; i < 30; i++) {
      const m = generateMissions(`2026-11-${String(i + 1).padStart(2, "0")}`, { dueReviews: 0, lessonAvailable: false });
      expect(m.some((x) => x.kind === "reviews" || x.kind === "lesson")).toBe(false);
    }
    expect(missionLabel({ kind: "correct", target: 10 })).toBe("Resuelve 10 ejercicios bien");
  });

  it("marca misiones completadas una sola vez", () => {
    const ms = generateMissions("2026-10-02", { dueReviews: 10, lessonAvailable: true });
    const full = { ...emptyDay("2026-10-02"), correct: 99, reviews: 99, highConfCorrect: 99, hardCorrect: 99, gymGames: 9, lessons: 9, bestCombo: 99 };
    const first = updateMissions(ms, full);
    expect(first.justCompleted).toHaveLength(3);
    expect(updateMissions(first.missions, full).justCompleted).toHaveLength(0);
  });

  it("publica probabilidades que suman 1 y nunca da un cofre vacío", () => {
    const odds = chestOdds();
    expect(odds.reduce((s, o) => s + o.probability, 0)).toBeCloseTo(1);
    const rng = createRng(3);
    const kinds = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const r = openChest(rng, { freezes: 2, ownedFrames: [...CONFIG.frames], ownedBadges: ["cofre-dorado", "trebol-de-cuatro", "estrella-fugaz"], facts: [] });
      kinds.add(r.kind);
    }
    expect([...kinds]).toEqual(["xp"]);
    const varied = new Set<string>();
    for (let i = 0; i < 400; i++) varied.add(openChest(rng, { freezes: 0, ownedFrames: [], ownedBadges: [], facts: ["dato"] }).kind);
    expect(varied.size).toBe(5);
  });
});

describe("liga personal", () => {
  const days = [
    { day: "2026-08-31", xp: 100 }, // semana del 31 ago
    { day: "2026-09-08", xp: 100 }, // semana del 7 sep
    { day: "2026-09-15", xp: 100 }, // semana del 14 sep
    { day: "2026-09-22", xp: 100 }, // semana del 21 sep
    { day: "2026-09-29", xp: 150 }, // semana del 28 sep
  ];

  it("compara tu semana con el promedio de las 4 anteriores", () => {
    expect(weekXp(days, "2026-09-28")).toBe(150);
    expect(baseline(days, "2026-09-28")).toBe(100);
    expect(ratioFor(days, "2026-09-28")).toBe(1.5);
    expect(baseline(days, "2026-08-31")).toBeNull();
    expect(divisionDelta(1.3)).toBe(1);
    expect(divisionDelta(0.5)).toBe(-1);
    expect(divisionDelta(1)).toBe(0);
    expect(divisionDelta(null)).toBe(0);
  });

  it("evalúa semanas terminadas y no baja de Bronce", () => {
    const first = evaluateLeague(START_LEAGUE, days, "2026-09-29");
    expect(first.state).toEqual({ division: 0, weekKey: "2026-09-28" });
    const next = evaluateLeague(first.state, days, "2026-10-06");
    expect(next.moves).toEqual([{ week: "2026-09-28", delta: 1 }]);
    expect(next.state.division).toBe(1);
    const idle = evaluateLeague({ division: 0, weekKey: "2026-10-05" }, days, "2026-10-20");
    expect(idle.state.division).toBe(0);
  });
});

describe("récords y logros", () => {
  it("solo celebra récords que superan uno anterior", () => {
    const r = applyRecords({ "best:combo": { value: 5 } }, [
      { key: "best:combo", value: 6, direction: "higher", label: "c" },
      { key: "best:session-speed", value: 9, direction: "lower", label: "s" },
      { key: "best:day-xp", value: Number.NaN, direction: "higher", label: "d" },
    ], NOW);
    expect(r.updates.map((u) => u.key)).toEqual(["best:combo", "best:session-speed"]);
    expect(r.broken.map((b) => b.key)).toEqual(["best:combo"]);
    expect(applyRecords({ "best:session-speed": { value: 5 } }, [{ key: "best:session-speed", value: 9, direction: "lower", label: "s" }], NOW).updates).toEqual([]);
    expect(sessionCandidates(9, 9, 9000)).toEqual([]);
    expect(sessionCandidates(10, 10, 25_000).map((c) => c.value)).toEqual([100, 2.5]);
  });

  it("desbloquea logros por hitos reales y no los repite", () => {
    const zero: AchievementStats = { totalCorrect: 0, level: 1, streak: 0, reviewRun: 0, bossesPassed: 0, hardcorePassed: 0, ghostsBeaten: 0, lessons: 0, hour: 12, gymNbackMax: 1, gymArithmeticRun: 0, gymSequencesLevel: 1, zeroLeak: 0 };
    expect(newAchievements(zero, new Set())).toEqual([]);
    const got = newAchievements({ ...zero, totalCorrect: 1, reviewRun: 30, hour: 23 }, new Set()).map((a) => a.id);
    expect(got).toEqual(["primer-acierto", "memoria-de-elefante", "nocturno"]);
    expect(newAchievements({ ...zero, totalCorrect: 1 }, new Set(["primer-acierto"]))).toEqual([]);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(bossAchievementId("domador-de-limites")).toBe("jefe:domador-de-limites");
  });
});

describe("jefes", () => {
  const spec = {
    vidas: 3,
    tiempo_segundos: 600,
    aprobado_minimo: 0.8,
    preguntas: { propias: ["a", "b", "c", "d", "e", "f", "s"], repaso_de: ["r1", "r2", "a"] },
  };
  const info = (id: string) =>
    ({ a: 1, b: 1, c: 2, d: 3, e: 4, f: 5, s: 2, r1: 2, r2: 3 } as Record<string, number>)[id] !== undefined
      ? { difficulty: ({ a: 1, b: 1, c: 2, d: 3, e: 4, f: 5, s: 2, r1: 2, r2: 3 } as Record<string, number>)[id] ?? 1, selfAssessed: id === "s" }
      : undefined;

  it("arma 3 oleadas de dificultad creciente sin autoevaluaciones ni repetidos", () => {
    const plan = planBoss(spec, info, createRng(1));
    const ids = plan.waves.flat().map((q) => q.exerciseId);
    expect(ids).toHaveLength(8);
    expect(ids).not.toContain("s");
    expect(new Set(ids).size).toBe(8);
    expect(plan.waves.map((w) => w.length)).toEqual([2, 3, 3]);
    const maxW1 = Math.max(...(plan.waves[0] ?? []).map((q) => q.difficulty));
    const minW3 = Math.min(...(plan.waves[2] ?? []).map((q) => q.difficulty));
    expect(maxW1).toBeLessThanOrEqual(minW3);
    expect(plan.waves.flat().filter((q) => q.review).map((q) => q.exerciseId).sort()).toEqual(["r1", "r2"]);
    expect(planBoss(spec, info, createRng(1), true).lives).toBe(1);
    expect(waveSizes(8)).toEqual([2, 3, 3]);
    expect(waveSizes(6)).toEqual([2, 2, 2]);
    expect(waveSizes(10)).toEqual([3, 4, 3]);
    expect(waveSizes(1)).toEqual([0, 1, 0]);
  });

  it("gana con ≥ 80 %, pierde sin vidas o sin tiempo", () => {
    const plan = planBoss(spec, info, createRng(2));
    let run = startBoss(plan, NOW);
    expect(currentWave(run)).toBe(1);
    const answers = [true, true, true, false, true, true, true, true];
    answers.forEach((ok, i) => (run = answerBoss(run, ok, NOW + 1000 * (i + 1))));
    expect(run.status).toBe("won");
    expect(bossScore(run)).toBe(7 / 8);
    expect(autopsy(run).failed).toHaveLength(1);

    let lost = startBoss(plan, NOW);
    for (let i = 0; i < 3; i++) lost = answerBoss(lost, false, NOW + i);
    expect(lost.status).toBe("lost");
    expect(lost.endReason).toBe("lives");
    expect(currentQuestion(lost)).toBeNull();
    expect(autopsy(lost).unanswered).toHaveLength(5);

    const slow = timeoutBoss(startBoss(plan, NOW), NOW + 700_000);
    expect(slow.endReason).toBe("time");
    const late = answerBoss(startBoss(plan, NOW), true, NOW + 700_000);
    expect(late.status).toBe("lost");
  });

  it("compara contra el fantasma", () => {
    const events = [{ t: 1000, correct: true }, { t: 2000, correct: false }, { t: 3000, correct: true }];
    expect(ghostCorrectAt(events, 2500)).toBe(1);
    expect(ghostSummary(events)).toEqual({ correct: 2, timeMs: 3000 });
    expect(beatsGhost({ correct: 3, timeMs: 9000 }, { correct: 2, timeMs: 3000 })).toBe(true);
    expect(beatsGhost({ correct: 2, timeMs: 2000 }, { correct: 2, timeMs: 3000 })).toBe(true);
    expect(beatsGhost({ correct: 2, timeMs: 4000 }, { correct: 2, timeMs: 3000 })).toBe(false);
    expect(beatsGhost({ correct: 9, timeMs: 1 }, null)).toBe(false);
  });
});

describe("flujo y dificultad adaptativa", () => {
  const ans = (correct: boolean, timeMs = 100_000, concepts = ["a"]) => ({ exerciseId: "x", correct, timeMs, difficulty: 3 as const, concepts });

  it("baja y muestra ejemplo tras 2 errores del mismo concepto", () => {
    expect(nextFlow(3, [ans(false), ans(false)])).toEqual({ level: 2, showWorked: true, change: "down" });
    expect(nextFlow(3, [ans(false, 1, ["a"]), ans(false, 1, ["b"])]).change).toBeNull();
    expect(nextFlow(1, [ans(false), ans(false)])).toEqual({ level: 1, showWorked: true, change: null });
  });

  it("sube tras 4 aciertos rápidos", () => {
    const fast = ans(true, 10_000);
    expect(nextFlow(3, [fast, fast, fast, fast]).level).toBe(4);
    expect(nextFlow(3, [fast, fast, fast, ans(true)]).level).toBe(3);
  });

  it("elige cerca del nivel y evita repetir", () => {
    const pool = [1, 2, 3, 4, 5].map((d) => ({ exerciseId: `e${d}`, difficulty: d as 1 | 2 | 3 | 4 | 5, concepts: ["a"] }));
    const rng = createRng(5);
    expect(initialLevel(pool, new Set(["e1"]))).toBe(2);
    expect(pickExercise(pool, { level: 3, solved: new Set(), seenNow: new Set(), lastId: null, rng })?.exerciseId).toBe("e3");
    expect(pickExercise(pool, { level: 3, solved: new Set(), seenNow: new Set(), lastId: "e3", rng })?.exerciseId).not.toBe("e3");
    expect(workedExampleFor(pool, ["a"], 2, "e2")?.exerciseId).toBe("e1");
  });
});

describe("maestría y sesión del día", () => {
  it("calcula estados de concepto y de unidad", () => {
    const none = { lessonDone: false, attempts: 0, correct: 0, bossPassed: false, longReviewOk: false };
    expect(conceptMastery(none)).toBe("new");
    expect(conceptMastery({ ...none, lessonDone: true })).toBe("seen");
    expect(conceptMastery({ ...none, correct: 3, attempts: 3 })).toBe("practiced");
    expect(conceptMastery({ ...none, correct: 3, attempts: 3, bossPassed: true })).toBe("mastered");
    expect(conceptMastery({ ...none, correct: 3, attempts: 3, bossPassed: true, longReviewOk: true })).toBe("expert");
    expect(unitMastery({ lessonDone: true, solvedShare: 0.2, bossPassed: false, longReviewShare: 0 })).toBe("seen");
    expect(unitMastery({ lessonDone: true, solvedShare: 0.6, bossPassed: false, longReviewShare: 0 })).toBe("practiced");
    expect(unitMastery({ lessonDone: true, solvedShare: 0.6, bossPassed: true, longReviewShare: 0.6 })).toBe("expert");
    expect(missingPrerequisites(["a", "b", "otra:c"], { a: "seen" })).toEqual(["b"]);
  });

  it("arma la misión alternando materias", () => {
    const u = (key: string, subjectId: string, number: number, extra: Partial<UnitState> = {}): UnitState => ({
      key, subjectId, number, lessonDone: false, status: "new", subjectLastActivity: null, ...extra,
    });
    const units = [
      u("calc/01", "calc", 1, { status: "mastered", lessonDone: true, subjectLastActivity: 10 }),
      u("calc/02", "calc", 2, { lessonDone: true, status: "practiced", subjectLastActivity: 10 }),
      u("prog/01", "prog", 1, { subjectLastActivity: 5 }),
      u("prog/02", "prog", 2, { subjectLastActivity: 5 }),
    ];
    expect(currentUnits(units).map((x) => x.key).sort()).toEqual(["calc/02", "prog/01"]);
    expect(chooseMission(units, ["calc", "prog"])).toEqual({ kind: "lesson", unitKey: "prog/01" });
    expect(stepFor(units[1] as UnitState)).toEqual({ kind: "boss", unitKey: "calc/02" });
    expect(stepFor(u("x", "x", 1, { lessonDone: true, status: "seen" })).kind).toBe("practice");
    expect(chooseMission([], [])).toBeNull();
    expect(["nback", "arithmetic", "sequences"]).toContain(gymGameFor("2026-10-02"));
    expect(phasesOf({ warmup: [], mission: null, gym: "nback" })).toEqual(["gym", "close"]);
  });
});
