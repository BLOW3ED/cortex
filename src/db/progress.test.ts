import { describe, expect, it, vi } from "vitest";
import { planBoss, startBoss, answerBoss } from "@/engine/boss";
import { DAY_MS } from "@/engine/dates";
import { createRng } from "@/engine/rng";
import { type CortexDb, openCortexDb } from "./db";
import {
  completeLesson,
  completeReviewBlock,
  endSession,
  ensureToday,
  type ExerciseRef,
  finishBoss,
  finishDailySession,
  illusionIds,
  openDailyChest,
  recordAnswer,
  recordGym,
  scheduleNow,
  setPreferences,
  startSession,
  type UnitRef,
} from "./progress";
import { freshIdb } from "./test-utils";

// Viernes 2 de octubre de 2026, 15:00 hora local.
const NOW = new Date(2026, 9, 2, 15, 0, 0).getTime();
const CTX = { dueReviews: 0, lessonAvailable: true };

const unit: UnitRef = {
  key: "calculo/01-limites",
  subjectId: "calculo",
  exerciseIds: ["calc-01-001", "calc-01-002", "calc-01-003", "calc-01-004"],
  cardIds: ["calc-01-001", "calc-01-002", "calc-01-003", "calc-01-004"],
};
const ex = (n: number, difficulty: 1 | 2 | 3 | 4 | 5 = 3): ExerciseRef => ({
  id: `calc-01-00${n}`,
  unitKey: unit.key,
  subjectId: "calculo",
  difficulty,
  concepts: ["limite-polinomio"],
  card: true,
});

async function answer(db: CortexDb, n: number, correct: boolean, extra: Partial<Parameters<typeof recordAnswer>[1]> = {}) {
  return recordAnswer(db, {
    exercise: ex(n),
    unit,
    correct,
    answer: correct ? "3" : "4",
    timeMs: 60_000,
    confidence: 2,
    hintsUsed: 0,
    mode: "practice",
    sessionId: null,
    now: NOW,
    ctx: CTX,
    ...extra,
  });
}

describe("recordAnswer", () => {
  it("guarda el intento, crea la tarjeta, da XP con bonus de primer intento y desbloquea el primer logro", async () => {
    const db = await openCortexDb(freshIdb());
    const out = await answer(db, 1, true);
    expect(out.xp.total).toBe(18); // 12 + 50 %
    expect(out.achievements.map((a) => a.id)).toEqual(["primer-acierto"]);
    expect(out.unitStatus).toBe("seen");
    expect(out.card?.due).toBeGreaterThan(NOW);
    expect(await db.attempts.count()).toBe(1);
    expect((await db.attempts.toArray())[0]).toMatchObject({ exerciseId: "calc-01-001", mode: "practice", xp: 18, correct: true });
    expect(await db.cards.get("calc-01-001")).toMatchObject({ reps: 1, longOk: false, schemaVersion: 2 });
    expect((await db.profile.get(1))?.xpTotal).toBe(18);
    expect(await db.days.get("2026-10-02")).toMatchObject({ answered: 1, correct: 1, xp: 18, minimumMet: false });
    expect(await db.missions.where("day").equals("2026-10-02").count()).toBe(3);
    expect((await db.records.get("stat:total-correct"))?.value).toBe(1);
    db.close();
  });

  it("con 3 aciertos cumple la misión mínima y empieza la racha", async () => {
    const db = await openCortexDb(freshIdb());
    await answer(db, 1, true);
    await answer(db, 2, true);
    const third = await answer(db, 3, true);
    expect(third.streakEvents).toEqual([{ kind: "started" }]);
    expect(await db.profile.get(1)).toMatchObject({ currentStreak: 1, maxStreak: 1, lastStudyDay: "2026-10-02" });
    expect((await db.days.get("2026-10-02"))?.minimumMet).toBe(true);
    expect((await answer(db, 4, true)).streakEvents).toEqual([]);
    db.close();
  });

  it("aplica rendimientos decrecientes al repetir el mismo ejercicio el mismo día", async () => {
    const db = await openCortexDb(freshIdb());
    expect((await answer(db, 1, true)).xp.total).toBe(18);
    expect((await answer(db, 1, true)).xp.total).toBe(6);
    expect((await answer(db, 1, true)).xp.total).toBe(3);
    expect((await answer(db, 1, true)).xp.total).toBe(0);
    db.close();
  });

  it("anota errores en el cuaderno y marca la ilusión de saber; un acierto posterior lo marca como corregido", async () => {
    const db = await openCortexDb(freshIdb());
    const wrong = await answer(db, 2, false, { confidence: 3 });
    expect(wrong.xp.total).toBe(0);
    expect(await db.mistakes.get("calc-01-002")).toMatchObject({ misses: 1, lastAnswer: "4", illusion: true, fixedAt: null });
    expect([...(await illusionIds(db))]).toEqual(["calc-01-002"]);
    const card = await db.cards.get("calc-01-002");
    expect((card?.due ?? 0) - NOW).toBeLessThan(DAY_MS);
    await answer(db, 2, true);
    expect((await db.mistakes.get("calc-01-002"))?.fixedAt).toBe(NOW);
    expect(await illusionIds(db)).toEqual(new Set());
    db.close();
  });

  it("los repasos dan XP de repaso y cuentan la racha de repasos", async () => {
    const db = await openCortexDb(freshIdb());
    await answer(db, 1, true);
    const later = NOW + 10 * DAY_MS;
    const r = await answer(db, 1, true, { mode: "review", now: later });
    expect(r.xp.total).toBe(8); // 6 + 2 por intervalo largo
    expect((await db.records.get("stat:review-run"))?.value).toBe(1);
    await answer(db, 1, false, { mode: "review", now: later + 1000 });
    expect((await db.records.get("stat:review-run"))?.value).toBe(0);
    db.close();
  });

  it("las preguntas del jefe no dan XP por separado", async () => {
    const db = await openCortexDb(freshIdb());
    expect((await answer(db, 1, true, { mode: "boss" })).xp.total).toBe(0);
    db.close();
  });

  it("modo sano: tras 90 min en el día ya no da XP y sugiere descanso", async () => {
    const db = await openCortexDb(freshIdb());
    await setPreferences(db, { healthyMode: true });
    for (let i = 0; i < 18; i++) await answer(db, 1 + (i % 4), false, { timeMs: 300_000 });
    const out = await answer(db, 4, true);
    expect(out.restSuggested).toBe(true);
    expect(out.xp.total).toBe(0);
    db.close();
  });

  it("es atómico: si algo falla a la mitad no se guarda nada", async () => {
    const db = await openCortexDb(freshIdb());
    vi.spyOn(db.mistakes, "put").mockRejectedValueOnce(new Error("disco lleno"));
    await expect(answer(db, 1, false)).rejects.toThrow("disco lleno");
    expect(await db.attempts.count()).toBe(0);
    expect(await db.cards.count()).toBe(0);
    expect(await db.days.count()).toBe(0);
    db.close();
  });

  it("completar las 3 misiones da 30 XP cada una", async () => {
    const db = await openCortexDb(freshIdb());
    const ctx = { dueReviews: 0, lessonAvailable: false };
    const missions = await ensureToday(db, NOW, ctx);
    expect(missions.missions).toHaveLength(3);
    for (let i = 0; i < 12; i++) {
      const out = await recordAnswer(db, { exercise: ex(1 + (i % 4), 5), unit, correct: true, answer: "x", timeMs: 1000, confidence: 3, hintsUsed: 0, mode: "practice", sessionId: null, now: NOW + i, ctx });
      if (out.missionsCompleted.length) expect(out.missionXp).toBe(30 * out.missionsCompleted.length);
    }
    await recordGym(db, { game: "nback", domain: "memoria", level: 2, score: 0.9, bests: [], now: NOW + 20, ctx });
    const done = (await db.missions.toArray()).filter((m) => m.completed).length;
    expect(done).toBe(3);
    db.close();
  });
});

describe("lección, repaso completo, sesión y cofre", () => {
  it("la lección se completa con ≥ 80 % y da XP solo la primera vez", async () => {
    const db = await openCortexDb(freshIdb());
    expect((await completeLesson(db, unit, 0.75, NOW, CTX)).passed).toBe(false);
    expect((await db.unitProgress.get(unit.key))?.lessonDone).toBe(false);
    const ok = await completeLesson(db, unit, 1, NOW, CTX);
    expect(ok.xp.total).toBe(20);
    expect(ok.achievements.map((a) => a.id)).toContain("primera-leccion");
    expect((await db.unitProgress.get(unit.key))?.lessonDone).toBe(true);
    expect((await completeLesson(db, unit, 1, NOW, CTX)).xp.total).toBe(0);
    db.close();
  });

  it("vaciar la cola de repaso cuenta como misión mínima", async () => {
    const db = await openCortexDb(freshIdb());
    await answer(db, 1, true, { mode: "review" });
    const change = await completeReviewBlock(db, NOW, CTX);
    expect(change.streakEvents).toEqual([{ kind: "started" }]);
    db.close();
  });

  it("registra sesiones y sus récords de precisión", async () => {
    const db = await openCortexDb(freshIdb());
    const first = await startSession(db, "free", NOW);
    for (let i = 0; i < 10; i++) await answer(db, 1 + (i % 4), i !== 0, { sessionId: first, timeMs: 2000 });
    expect(await endSession(db, first, NOW + 1)).toEqual([]); // primeros valores no se celebran
    expect((await db.records.get("best:session-accuracy"))?.value).toBe(90);
    const second = await startSession(db, "free", NOW + 2);
    for (let i = 0; i < 10; i++) await answer(db, 1 + (i % 4), true, { sessionId: second, timeMs: 1000 });
    expect((await endSession(db, second, NOW + 3)).map((r) => r.key)).toContain("best:session-accuracy");
    expect(await endSession(db, second, NOW + 4)).toEqual([]);
    db.close();
  });

  it("el cofre se abre una vez, al terminar la sesión del día", async () => {
    const db = await openCortexDb(freshIdb());
    expect((await openDailyChest(db, NOW, createRng(1), ["dato"])).opened).toBe(false);
    await finishDailySession(db, NOW);
    const chest = await openDailyChest(db, NOW, createRng(1), ["dato"]);
    expect(chest.opened).toBe(true);
    expect((await openDailyChest(db, NOW, createRng(1), ["dato"])).opened).toBe(false);
    expect((await db.days.get("2026-10-02"))?.chestOpened).toBe(true);
    db.close();
  });
});

describe("jefes", () => {
  const spec = { vidas: 3, tiempo_segundos: 600, aprobado_minimo: 0.8, preguntas: { propias: unit.exerciseIds, repaso_de: [] } };
  const info = () => ({ difficulty: 3, selfAssessed: false });

  async function play(db: CortexDb, results: boolean[], now: number, hardcore = false, step = 1000) {
    let run = startBoss(planBoss(spec, info, createRng(1), hardcore), now);
    results.forEach((ok, i) => (run = answerBoss(run, ok, now + step * (i + 1))));
    return finishBoss(db, { unit, run, reward: 300, insignia: "domador-de-limites", bossName: "El Guardián del Infinito", now: now + 10_000, ctx: CTX });
  }

  it("aprobar da la recompensa, la insignia y domina la unidad; repetir da solo el 10 %", async () => {
    const db = await openCortexDb(freshIdb());
    const lost = await play(db, [false, false, false], NOW);
    expect(lost.passed).toBe(false);
    expect(lost.xp.total).toBe(0);
    expect(lost.failed).toHaveLength(3);
    expect(await db.ghosts.count()).toBe(0);

    const won = await play(db, [true, true, true, true], NOW + 1);
    expect(won.passed).toBe(true);
    expect(won.firstPass).toBe(true);
    expect(won.xp.total).toBe(300);
    expect(won.achievements.map((a) => a.id)).toEqual(expect.arrayContaining(["primer-jefe", "jefe:domador-de-limites"]));
    expect(await db.unitProgress.get(unit.key)).toMatchObject({ bossPassed: true, status: "mastered", bossAttempts: 2, bestBoss: 1 });
    expect(await db.ghosts.get("jefe:calculo/01-limites")).toBeDefined();

    const faster = await play(db, [true, true, true, true], NOW + 2, false, 500);
    expect(faster.beatGhost).toBe(true);
    expect(faster.xp.total).toBe(30 + 25);
    expect(faster.achievements.map((a) => a.id)).toContain("fantasma");

    const hard = await play(db, [true, true, true, true], NOW + 3, true);
    expect(hard.achievements.map((a) => a.id)).toContain("sin-red");
    db.close();
  });

  it("la autopsia puede regresar los errores a la cola de hoy", async () => {
    const db = await openCortexDb(freshIdb());
    await answer(db, 1, true);
    await answer(db, 2, true);
    expect(await scheduleNow(db, ["calc-01-001", "calc-01-002", "no-existe"], NOW + 5)).toBe(2);
    expect((await db.cards.get("calc-01-001"))?.due).toBe(NOW + 5);
    db.close();
  });
});

describe("gimnasio y liga", () => {
  it("guarda el resultado y desbloquea logros del gimnasio", async () => {
    const db = await openCortexDb(freshIdb());
    const out = await recordGym(db, { game: "nback", domain: "memoria", level: 3, score: 0.9, bests: [{ key: "best:gym-nback", value: 3, direction: "higher", label: "N-back" }], now: NOW, ctx: CTX });
    expect(out.achievements.map((a) => a.id)).toContain("n-back-3");
    expect(await db.gymResults.count()).toBe(1);
    expect((await db.days.get("2026-10-02"))?.gymGames).toBe(1);
    db.close();
  });

  it("evalúa la liga al empezar una semana nueva", async () => {
    const db = await openCortexDb(freshIdb());
    for (const [day, xp] of [["2026-08-31", 100], ["2026-09-08", 100], ["2026-09-15", 100], ["2026-09-22", 100], ["2026-09-29", 200]] as const) {
      await db.days.put({ ...(await import("./defaults")).emptyDayRecord(day), xp });
    }
    await ensureToday(db, new Date(2026, 8, 30, 12).getTime(), CTX);
    expect((await db.profile.get(1))?.league).toEqual({ division: 0, weekKey: "2026-09-28" });
    const next = await ensureToday(db, new Date(2026, 9, 6, 12).getTime(), CTX);
    expect(next.leagueMoves).toEqual([{ week: "2026-09-28", delta: 1 }]);
    expect((await db.profile.get(1))?.league.division).toBe(1);
    db.close();
  });
});
