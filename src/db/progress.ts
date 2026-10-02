import { type AchievementDef, type AchievementStats, ACHIEVEMENTS, bossAchievementId, newAchievements } from "@/engine/achievements";
import { autopsy, beatsGhost, type BossRun, bossScore, ghostSummary, type GhostEvent } from "@/engine/boss";
import { type ChestReward, openChest as rollChest } from "@/engine/chest";
import { CONFIG, type Difficulty } from "@/engine/config";
import { dayKey, localHour, weekStart } from "@/engine/dates";
import { addAnswer } from "@/engine/day";
import { evaluateLeague } from "@/engine/league";
import { levelInfo } from "@/engine/levels";
import { unitMastery } from "@/engine/mastery";
import { generateMissions, type Mission, type MissionContext, type MissionKind, updateMissions } from "@/engine/missions";
import { applyRecords, type RecordCandidate, sessionCandidates, STAT } from "@/engine/records";
import type { Rng } from "@/engine/rng";
import { gradeFrom, newCard, reviewCard, type SrsCard } from "@/engine/srs";
import { onMinimumMet, minimumMet, type StreakEvent, type StreakState, tryRepair } from "@/engine/streak";
import { bossXp, type Confidence, practiceXp, reviewXp, type XpBreakdown } from "@/engine/xp";
import type { CortexDb } from "./db";
import { emptyDayRecord } from "./defaults";
import { SCHEMA_VERSION } from "./schema";
import type {
  AttemptMode,
  CardRecord,
  DayRecord,
  MissionRecord,
  PersonalRecord,
  Preferences,
  ProfileRecord,
  SessionKind,
  UnitProgressRecord,
  UnitStatus,
} from "./types";

/**
 * Capa de progreso: aplica las reglas del motor (`src/engine/`) a los datos de Dexie. Cada
 * operación corre en UNA transacción `rw`: o se guarda todo (intento, tarjeta, día, racha,
 * misiones, récords, logros) o nada.
 */

export interface ExerciseRef {
  readonly id: string;
  readonly unitKey: string;
  readonly subjectId: string;
  readonly difficulty: Difficulty;
  readonly concepts: readonly string[];
  /** Entra al repaso espaciado (`tarjeta` distinto de `false`). */
  readonly card: boolean;
  readonly estimatedSeconds?: number;
  readonly language?: string;
}

export interface UnitRef {
  readonly key: string;
  readonly subjectId: string;
  /** Ejercicios vigentes de la unidad. */
  readonly exerciseIds: readonly string[];
  /** Los que tienen tarjeta. */
  readonly cardIds: readonly string[];
}

export interface DayChange {
  readonly streakEvents: StreakEvent[];
  readonly missionsCompleted: Mission[];
  readonly missionXp: number;
  readonly recordsBroken: RecordCandidate[];
}

export interface Outcome extends DayChange {
  readonly xp: XpBreakdown;
  readonly levelBefore: number;
  readonly levelAfter: number;
  readonly achievements: AchievementDef[];
  readonly restSuggested: boolean;
}

export interface AnswerOutcome extends Outcome {
  readonly card: SrsCard | null;
  readonly unitStatus: UnitStatus;
}

const NO_XP: XpBreakdown = { total: 0, parts: [] };
const DATA = ["profile", "attempts", "cards", "mistakes", "days", "missions", "records", "achievements", "unitProgress", "sessions", "ghosts", "gymResults"] as const;

function tables(db: CortexDb) {
  return DATA.map((t) => db.table(t));
}

const stamp = <T extends object>(row: T): T & { schemaVersion: number } => ({ ...row, schemaVersion: SCHEMA_VERSION });

async function getProfile(db: CortexDb): Promise<ProfileRecord> {
  const p = await db.profile.get(1);
  if (!p) throw new Error("No hay perfil en la base local.");
  return p;
}

async function getDay(db: CortexDb, day: string): Promise<DayRecord> {
  return (await db.days.get(day)) ?? emptyDayRecord(day);
}

async function readValue(db: CortexDb, key: string): Promise<number> {
  return (await db.records.get(key))?.value ?? 0;
}

async function setValue(db: CortexDb, key: string, value: number, at: number): Promise<void> {
  await db.records.put(stamp({ key, value, at }) as PersonalRecord);
}

async function bumpStat(db: CortexDb, key: string, by: number, at: number): Promise<number> {
  const value = (await readValue(db, key)) + by;
  await setValue(db, key, value, at);
  return value;
}

/** Misiones del día; si aún no existen, se generan con la semilla del día. */
export async function ensureMissions(db: CortexDb, day: string, ctx: MissionContext): Promise<Mission[]> {
  const rows = await db.missions.where("day").equals(day).toArray();
  if (rows.length) return rows.map(toMission).sort((a, b) => a.slot - b.slot);
  const fresh = generateMissions(day, ctx);
  await db.missions.bulkPut(fresh.map((m) => stamp({ key: m.key, day: m.day, kind: m.kind, target: m.target, progress: 0, completed: false }) as MissionRecord));
  return fresh;
}

function toMission(r: MissionRecord): Mission {
  return { key: r.key, day: r.day, slot: Number(r.key.split("/")[1] ?? 0), kind: r.kind as MissionKind, target: r.target, progress: r.progress, completed: r.completed };
}

function streakOf(p: ProfileRecord): StreakState {
  return { current: p.currentStreak, max: p.maxStreak, freezes: p.streakFreezes, lastDay: p.lastStudyDay, repair: p.streakRepair };
}

function withStreak(p: ProfileRecord, s: StreakState): ProfileRecord {
  return { ...p, currentStreak: s.current, maxStreak: s.max, streakFreezes: s.freezes, lastStudyDay: s.lastDay, streakRepair: s.repair };
}

/** ¿Hoy ya se pasó el límite del modo sano? */
export function healthyLimitReached(p: ProfileRecord, d: DayRecord): boolean {
  return p.preferences.healthyMode && d.activeMs >= CONFIG.healthy.minutes * 60_000;
}

/**
 * Después de cambiar los contadores del día: racha (misión mínima y reparación), misiones (con su
 * XP) y récords del día y de la semana. Modifica `state` y guarda el día.
 */
async function settleDay(db: CortexDb, state: { profile: ProfileRecord; day: DayRecord }, now: number, ctx: MissionContext): Promise<DayChange> {
  const streakEvents: StreakEvent[] = [];
  const healthyStop = healthyLimitReached(state.profile, state.day);
  if (!healthyStop && !state.day.minimumMet && minimumMet(state.day)) {
    const r = onMinimumMet(streakOf(state.profile), state.day.day);
    state.profile = withStreak(state.profile, r.state);
    state.day = { ...state.day, minimumMet: true };
    streakEvents.push(...r.events);
  }
  if (!healthyStop && state.profile.streakRepair) {
    const r = tryRepair(streakOf(state.profile), state.day.day, state.day);
    state.profile = withStreak(state.profile, r.state);
    streakEvents.push(...r.events);
  }

  const missions = await ensureMissions(db, state.day.day, ctx);
  const { missions: next, justCompleted } = updateMissions(missions, state.day);
  await db.missions.bulkPut(next.map((m) => stamp({ key: m.key, day: m.day, kind: m.kind, target: m.target, progress: m.progress, completed: m.completed }) as MissionRecord));
  const missionXp = healthyStop ? 0 : justCompleted.length * CONFIG.xp.mission;
  if (missionXp) {
    state.day = { ...state.day, xp: state.day.xp + missionXp };
    state.profile = { ...state.profile, xpTotal: state.profile.xpTotal + missionXp };
  }
  state.profile = { ...state.profile, level: levelInfo(state.profile.xpTotal).level };

  const monday = weekStart(state.day.day);
  const week = (await db.days.toArray()).filter((d) => weekStart(d.day) === monday && d.day !== state.day.day).reduce((s, d) => s + d.xp, 0) + state.day.xp;
  const candidates: RecordCandidate[] = [
    { key: "best:combo", value: state.day.bestCombo, direction: "higher", label: "Aciertos seguidos" },
    { key: "best:day-xp", value: state.day.xp, direction: "higher", label: "Mejor día" },
    { key: "best:week-xp", value: week, direction: "higher", label: "Mejor semana" },
  ].filter((c) => c.value > 0) as RecordCandidate[];
  const startOfDay = new Date(now).setHours(0, 0, 0, 0);
  const startOfWeek = new Date(`${monday}T00:00:00`).getTime();
  const recordsBroken = await applyCandidates(db, candidates, now, { "best:combo": startOfDay, "best:day-xp": startOfDay, "best:week-xp": startOfWeek });

  await db.days.put(stamp(state.day));
  return { streakEvents, missionsCompleted: justCompleted, missionXp, recordsBroken };
}

/**
 * Guarda los récords que mejoran. `since` (ms) evita celebrar de más: un récord que crece mientras
 * lo sigues rompiendo (el XP del día, la racha de aciertos) se celebra una vez, cuando superas el
 * de un periodo anterior; las mejoras siguientes del mismo periodo se guardan sin aviso.
 */
async function applyCandidates(db: CortexDb, candidates: readonly RecordCandidate[], now: number, since: Readonly<Record<string, number>> = {}): Promise<RecordCandidate[]> {
  if (!candidates.length) return [];
  const rows = await db.records.bulkGet(candidates.map((c) => c.key));
  const existing = Object.fromEntries(rows.map((r, i) => [candidates[i]?.key ?? "", r]));
  const { updates, broken } = applyRecords(existing, candidates, now);
  if (updates.length) await db.records.bulkPut(updates.map((u) => stamp(u) as PersonalRecord));
  return broken.filter((b) => {
    const start = since[b.key];
    const prev = existing[b.key];
    return start === undefined || !prev || prev.at < start;
  });
}

async function achievementStats(db: CortexDb, p: ProfileRecord, now: number): Promise<AchievementStats> {
  const keys = [STAT.totalCorrect, STAT.reviewRun, STAT.bossesPassed, STAT.hardcorePassed, STAT.ghostsBeaten, STAT.lessons, STAT.zeroLeak, "best:gym-nback", "best:gym-arithmetic-run", "best:gym-sequences"];
  const rows = await db.records.bulkGet(keys);
  const v = (i: number) => rows[i]?.value ?? 0;
  return {
    totalCorrect: v(0),
    reviewRun: v(1),
    bossesPassed: v(2),
    hardcorePassed: v(3),
    ghostsBeaten: v(4),
    lessons: v(5),
    zeroLeak: v(6),
    gymNbackMax: v(7),
    gymArithmeticRun: v(8),
    gymSequencesLevel: v(9),
    level: p.level,
    streak: p.currentStreak,
    hour: localHour(now),
  };
}

async function unlockAchievements(db: CortexDb, p: ProfileRecord, now: number, extra: readonly AchievementDef[] = []): Promise<AchievementDef[]> {
  const unlocked = new Set((await db.achievements.toArray()).map((a) => a.id));
  const fresh = [...newAchievements(await achievementStats(db, p, now), unlocked), ...extra.filter((e) => !unlocked.has(e.id))];
  if (fresh.length) await db.achievements.bulkPut(fresh.map((a) => stamp({ id: a.id, unlockedAt: now })));
  return fresh;
}

/** Recalcula el estado de la unidad con la evidencia guardada. */
async function refreshUnit(db: CortexDb, unit: UnitRef, now: number, patch: Partial<UnitProgressRecord> = {}): Promise<UnitProgressRecord> {
  const prev: UnitProgressRecord =
    (await db.unitProgress.get(unit.key)) ??
    stamp({ unitKey: unit.key, subjectId: unit.subjectId, status: "new" as UnitStatus, bestBoss: null, bossAttempts: 0, lessonDone: false, bossPassed: false, lastActivity: null });
  const merged = { ...prev, ...patch, lastActivity: now };
  const solved = new Set(
    (await db.attempts.where("exerciseId").anyOf([...unit.exerciseIds]).filter((a) => a.correct).toArray()).map((a) => a.exerciseId),
  );
  const cards = unit.cardIds.length ? await db.cards.bulkGet([...unit.cardIds]) : [];
  const longOk = cards.filter((c) => c?.longOk).length;
  const status = unitMastery({
    lessonDone: merged.lessonDone,
    solvedShare: unit.exerciseIds.length ? solved.size / unit.exerciseIds.length : 0,
    bossPassed: merged.bossPassed,
    longReviewShare: unit.cardIds.length ? longOk / unit.cardIds.length : 0,
  });
  const next = stamp({ ...merged, status });
  await db.unitProgress.put(next);
  return next;
}

export interface AnswerInput {
  readonly exercise: ExerciseRef;
  readonly unit: UnitRef;
  readonly correct: boolean;
  readonly answer: string;
  readonly timeMs: number;
  readonly confidence: Confidence | null;
  readonly hintsUsed: number;
  readonly mode: AttemptMode;
  readonly sessionId: number | null;
  readonly now: number;
  readonly ctx: MissionContext;
}

/** Guarda una respuesta y todo lo que provoca. */
export async function recordAnswer(db: CortexDb, input: AnswerInput): Promise<AnswerOutcome> {
  const { exercise: ex, now } = input;
  return db.transaction("rw", tables(db), async () => {
    const today = dayKey(now);
    const profile = await getProfile(db);
    const day = await getDay(db, today);
    const startOfDay = new Date(now).setHours(0, 0, 0, 0);
    const previous = await db.attempts.where("exerciseId").equals(ex.id).toArray();
    const firstEver = previous.length === 0;
    const correctTodayBefore = previous.filter((a) => a.correct && a.at >= startOfDay).length;
    const stored = await db.cards.get(ex.id);
    const restSuggested = healthyLimitReached(profile, day);

    // Tarjeta FSRS.
    let card: SrsCard | null = null;
    let elapsedDays = 0;
    if (ex.card || input.mode === "review") {
      const base: SrsCard = stored ?? newCard(ex.id, now);
      const grade = gradeFrom({ correct: input.correct, hintsUsed: input.hintsUsed, timeMs: input.timeMs, difficulty: ex.difficulty, estimatedSeconds: ex.estimatedSeconds, confidence: input.confidence });
      const r = reviewCard(base, grade, now);
      card = r.card;
      elapsedDays = r.elapsedDays;
      const longOk = (stored?.longOk ?? false) || (input.mode === "review" && input.correct && elapsedDays > CONFIG.boss.expertIntervalDays);
      await db.cards.put(stamp({ ...card, longOk }) as CardRecord);
    }

    // XP: repaso, práctica o nada (las preguntas del jefe se pagan con la recompensa del jefe).
    let xp: XpBreakdown = NO_XP;
    if (!restSuggested) {
      if (input.mode === "review") xp = reviewXp({ correct: input.correct, elapsedDays, confidence: input.confidence });
      else if (input.mode !== "boss") {
        xp = practiceXp({ difficulty: ex.difficulty, correct: input.correct, firstEver, correctTodayBefore, hintsUsed: input.hintsUsed, confidence: input.confidence });
      }
    }

    await db.attempts.add(
      stamp({ exerciseId: ex.id, at: now, correct: input.correct, timeMs: Math.max(0, Math.round(input.timeMs)), confidence: input.confidence, answer: input.answer.slice(0, 4000), sessionId: input.sessionId, mode: input.mode, hintsUsed: input.hintsUsed, xp: xp.total }),
    );

    // Cuaderno de errores (automático) e "ilusión de saber".
    const mistake = await db.mistakes.get(ex.id);
    if (!input.correct) {
      await db.mistakes.put(
        stamp({
          exerciseId: ex.id,
          misses: (mistake?.misses ?? 0) + 1,
          lastAnswer: input.answer.slice(0, 2000),
          note: mistake?.note ?? "",
          lastAt: now,
          illusion: (mistake?.illusion ?? false) || input.confidence === 3,
          fixedAt: null,
        }),
      );
    } else if (mistake && mistake.fixedAt === null) {
      await db.mistakes.put({ ...mistake, fixedAt: now });
    }

    // Sesión en curso.
    if (input.sessionId !== null) {
      const s = await db.sessions.get(input.sessionId);
      if (s) {
        await db.sessions.put({
          ...s,
          xpEarned: s.xpEarned + xp.total,
          answered: (s.answered ?? 0) + 1,
          correct: (s.correct ?? 0) + (input.correct ? 1 : 0),
          correctTimeMs: (s.correctTimeMs ?? 0) + (input.correct ? Math.min(input.timeMs, 300_000) : 0),
        });
      }
    }

    // Contadores y estadísticas.
    const state = {
      profile: { ...profile, xpTotal: profile.xpTotal + xp.total },
      day: { ...day, ...addAnswer(day, { correct: input.correct, review: input.mode === "review", difficulty: ex.difficulty, confidence: input.confidence, timeMs: input.timeMs, xp: xp.total }) },
    };
    if (input.correct) await bumpStat(db, STAT.totalCorrect, 1, now);
    const reviewCandidates: RecordCandidate[] = [];
    if (input.mode === "review") {
      const run = input.correct ? (await readValue(db, STAT.reviewRun)) + 1 : 0;
      await setValue(db, STAT.reviewRun, run, now);
      if (run > 0) reviewCandidates.push({ key: "best:review-run", value: run, direction: "higher", label: "Repasos seguidos sin fallar" });
    }
    if (input.correct && firstEver && ex.language === "c" && ex.concepts.includes("memoria-dinamica")) await bumpStat(db, STAT.zeroLeak, 1, now);

    const change = await settleDay(db, state, now, input.ctx);
    const broken = [...change.recordsBroken, ...(await applyCandidates(db, reviewCandidates, now, { "best:review-run": startOfDay }))];
    await db.profile.put(state.profile);
    const achievements = await unlockAchievements(db, state.profile, now);
    const unit = await refreshUnit(db, input.unit, now);
    return {
      ...change,
      recordsBroken: broken,
      xp,
      levelBefore: profile.level,
      levelAfter: state.profile.level,
      achievements,
      restSuggested,
      card,
      unitStatus: unit.status,
    };
  });
}

/** Se terminó la cola del calentamiento: cuenta como "repaso completo" para la racha. */
export async function completeReviewBlock(db: CortexDb, now: number, ctx: MissionContext): Promise<DayChange> {
  return db.transaction("rw", tables(db), async () => {
    const state = { profile: await getProfile(db), day: await getDay(db, dayKey(now)) };
    if (state.day.reviews >= CONFIG.streak.minReviewsForBlock) state.day = { ...state.day, reviewBlockDone: true };
    const change = await settleDay(db, state, now, ctx);
    await db.profile.put(state.profile);
    return change;
  });
}

/** Mini quiz de una lección: con ≥ 80 % la lección queda completa (+20 XP la primera vez). */
export async function completeLesson(db: CortexDb, unit: UnitRef, score: number, now: number, ctx: MissionContext): Promise<Outcome & { passed: boolean }> {
  return db.transaction("rw", tables(db), async () => {
    const profile = await getProfile(db);
    const state = { profile, day: await getDay(db, dayKey(now)) };
    const passed = score >= CONFIG.xp.lessonQuizPass - 1e-9;
    const already = (await db.unitProgress.get(unit.key))?.lessonDone ?? false;
    let xp = NO_XP;
    if (passed && !already) {
      xp = healthyLimitReached(profile, state.day) ? NO_XP : { total: CONFIG.xp.lesson, parts: [{ label: "Lección completada", xp: CONFIG.xp.lesson }] };
      state.profile = { ...state.profile, xpTotal: state.profile.xpTotal + xp.total };
      state.day = { ...state.day, xp: state.day.xp + xp.total, lessons: state.day.lessons + 1 };
      await bumpStat(db, STAT.lessons, 1, now);
    }
    const change = await settleDay(db, state, now, ctx);
    await db.profile.put(state.profile);
    await refreshUnit(db, unit, now, passed ? { lessonDone: true } : {});
    const achievements = await unlockAchievements(db, state.profile, now);
    return { ...change, xp, levelBefore: profile.level, levelAfter: state.profile.level, achievements, restSuggested: false, passed };
  });
}

export interface BossFinishInput {
  readonly unit: UnitRef;
  readonly run: BossRun;
  readonly reward: number;
  readonly insignia: string;
  readonly bossName: string;
  readonly now: number;
  readonly ctx: MissionContext;
}

export interface BossOutcome extends Outcome {
  readonly passed: boolean;
  readonly score: number;
  readonly firstPass: boolean;
  readonly beatGhost: boolean;
  readonly failed: string[];
  readonly unanswered: string[];
}

/** Cierra un jefe: recompensa, insignia, fantasma, récord y estado de la unidad. */
export async function finishBoss(db: CortexDb, input: BossFinishInput): Promise<BossOutcome> {
  const { run, now, unit } = input;
  return db.transaction("rw", tables(db), async () => {
    const profile = await getProfile(db);
    const state = { profile, day: await getDay(db, dayKey(now)) };
    const prev = await db.unitProgress.get(unit.key);
    const passed = run.status === "won";
    const score = bossScore(run);
    const context = `jefe:${unit.key}${run.plan.hardcore ? ":hardcore" : ""}`;
    const ghostRow = await db.ghosts.get(context);
    const ghost = ghostRow ? ghostSummary(ghostRow.events as GhostEvent[]) : null;
    const mine = ghostSummary(run.events);
    const beatGhost = passed && beatsGhost(mine, ghost);
    if (passed && (!ghost || beatGhost)) await db.ghosts.put(stamp({ context, events: [...run.events] }));

    const firstPass = passed && !(prev?.bossPassed ?? false);
    let xp = NO_XP;
    const extra: AchievementDef[] = [];
    if (passed) {
      xp = healthyLimitReached(profile, state.day) ? NO_XP : bossXp(input.reward, !firstPass, beatGhost);
      state.profile = { ...state.profile, xpTotal: state.profile.xpTotal + xp.total };
      state.day = { ...state.day, xp: state.day.xp + xp.total, bossesWon: state.day.bossesWon + 1 };
      await bumpStat(db, STAT.bossesPassed, 1, now);
      if (run.plan.hardcore) await bumpStat(db, STAT.hardcorePassed, 1, now);
      if (beatGhost) await bumpStat(db, STAT.ghostsBeaten, 1, now);
      extra.push({ id: bossAchievementId(input.insignia), name: input.bossName, description: `Derrotaste a «${input.bossName}».`, check: () => true });
    }
    const change = await settleDay(db, state, now, input.ctx);
    const broken = [...change.recordsBroken, ...(await applyCandidates(db, [{ key: `best:boss:${unit.key}`, value: Math.round(score * 100), direction: "higher", label: "Mejor puntaje del jefe" }], now))];
    await db.profile.put(state.profile);
    await refreshUnit(db, unit, now, {
      bossAttempts: (prev?.bossAttempts ?? 0) + 1,
      bestBoss: Math.max(prev?.bestBoss ?? 0, score),
      bossPassed: (prev?.bossPassed ?? false) || passed,
    });
    const achievements = await unlockAchievements(db, state.profile, now, extra);
    const { failed, unanswered } = autopsy(run);
    return { ...change, recordsBroken: broken, xp, levelBefore: profile.level, levelAfter: state.profile.level, achievements, restSuggested: false, passed, score, firstPass, beatGhost, failed, unanswered };
  });
}

export interface GymInput {
  readonly game: string;
  readonly domain: string;
  readonly level: number;
  readonly score: number;
  /** Récords del juego (n máximo, racha de cálculos, nivel de secuencias). */
  readonly bests: readonly RecordCandidate[];
  readonly now: number;
  readonly ctx: MissionContext;
}

export async function recordGym(db: CortexDb, input: GymInput): Promise<Outcome> {
  return db.transaction("rw", tables(db), async () => {
    const profile = await getProfile(db);
    const state = { profile, day: await getDay(db, dayKey(input.now)) };
    await db.gymResults.add(stamp({ game: input.game, domain: input.domain, level: input.level, score: input.score, at: input.now }));
    state.day = { ...state.day, gymGames: state.day.gymGames + 1 };
    const change = await settleDay(db, state, input.now, input.ctx);
    const broken = [...change.recordsBroken, ...(await applyCandidates(db, input.bests, input.now))];
    await db.profile.put(state.profile);
    const achievements = await unlockAchievements(db, state.profile, input.now);
    return { ...change, recordsBroken: broken, xp: NO_XP, levelBefore: profile.level, levelAfter: state.profile.level, achievements, restSuggested: false };
  });
}

/** Último nivel jugado de un minijuego (para retomar la escalera). */
export async function lastGymLevel(db: CortexDb, game: string): Promise<number | null> {
  const last = await db.gymResults.where("game").equals(game).reverse().sortBy("at");
  return last[0]?.level ?? null;
}

export async function startSession(db: CortexDb, kind: SessionKind, now: number, unitKey?: string): Promise<number> {
  const id = await db.sessions.add(stamp({ startedAt: now, endedAt: null, xpEarned: 0, kind, answered: 0, correct: 0, correctTimeMs: 0, ...(unitKey ? { unitKey } : {}) }));
  if (typeof id !== "number") throw new Error("No se pudo crear la sesión.");
  return id;
}

/** Cierra una sesión y revisa sus récords de precisión y velocidad. */
export async function endSession(db: CortexDb, id: number, now: number): Promise<RecordCandidate[]> {
  return db.transaction("rw", db.sessions, db.records, async () => {
    const s = await db.sessions.get(id);
    if (!s || s.endedAt !== null) return [];
    await db.sessions.put({ ...s, endedAt: now });
    return applyCandidates(db, sessionCandidates(s.answered ?? 0, s.correct ?? 0, s.correctTimeMs ?? 0), now);
  });
}

/** La sesión del día terminó: se habilita el cofre. */
export async function finishDailySession(db: CortexDb, now: number): Promise<void> {
  await db.transaction("rw", db.days, async () => {
    const day = await getDay(db, dayKey(now));
    await db.days.put(stamp({ ...day, sessionDone: true }));
  });
}

export type ChestResult = { readonly opened: true; readonly reward: ChestReward; readonly levelAfter: number } | { readonly opened: false; readonly reason: string };

/** Abre el cofre del día (una vez, al terminar la sesión). */
export async function openDailyChest(db: CortexDb, now: number, rng: Rng, facts: readonly string[]): Promise<ChestResult> {
  return db.transaction("rw", tables(db), async () => {
    const today = dayKey(now);
    const day = await getDay(db, today);
    if (!day.sessionDone) return { opened: false, reason: "El cofre se abre al terminar la sesión de hoy." };
    if (day.chestOpened) return { opened: false, reason: "Ya abriste el cofre de hoy. Mañana hay otro." };
    let profile = await getProfile(db);
    const reward = rollChest(rng, {
      freezes: profile.streakFreezes,
      ownedFrames: profile.cosmetics.frames,
      ownedBadges: profile.cosmetics.badges,
      facts,
    });
    let dayXp = 0;
    switch (reward.kind) {
      case "xp":
        profile = { ...profile, xpTotal: profile.xpTotal + reward.amount };
        dayXp = reward.amount;
        break;
      case "freeze":
        profile = { ...profile, streakFreezes: Math.min(CONFIG.streak.maxFreezes, profile.streakFreezes + 1) };
        break;
      case "frame":
        profile = { ...profile, cosmetics: { ...profile.cosmetics, frames: [...profile.cosmetics.frames, reward.frame] } };
        break;
      case "rare-badge":
        profile = { ...profile, cosmetics: { ...profile.cosmetics, badges: [...profile.cosmetics.badges, reward.badge] } };
        break;
      case "fact":
        break;
    }
    profile = { ...profile, level: levelInfo(profile.xpTotal).level };
    await db.profile.put(profile);
    await db.days.put(stamp({ ...day, chestOpened: true, xp: day.xp + dayXp }));
    return { opened: true, reward, levelAfter: profile.level };
  });
}

/** Al abrir la app: misiones del día y evaluación de la liga de las semanas que ya terminaron. */
export async function ensureToday(db: CortexDb, now: number, ctx: MissionContext): Promise<{ missions: Mission[]; leagueMoves: { week: string; delta: -1 | 0 | 1 }[] }> {
  return db.transaction("rw", tables(db), async () => {
    const today = dayKey(now);
    const missions = await ensureMissions(db, today, ctx);
    const profile = await getProfile(db);
    const days = (await db.days.toArray()).map((d) => ({ day: d.day, xp: d.xp }));
    const { state, moves } = evaluateLeague(profile.league, days, today);
    if (state.division !== profile.league.division || state.weekKey !== profile.league.weekKey) {
      await db.profile.put({ ...profile, league: state });
    }
    return { missions, leagueMoves: moves };
  });
}

/** Botón de la autopsia: los errores vuelven a la cola de repaso hoy mismo. */
export async function scheduleNow(db: CortexDb, exerciseIds: readonly string[], now: number): Promise<number> {
  return db.transaction("rw", db.cards, async () => {
    let n = 0;
    for (const id of exerciseIds) {
      const c = await db.cards.get(id);
      if (c && c.due > now) {
        await db.cards.put({ ...c, due: now });
        n++;
      }
    }
    return n;
  });
}

export async function saveMistakeNote(db: CortexDb, exerciseId: string, note: string): Promise<void> {
  await db.mistakes.update(exerciseId, { note: note.slice(0, 2000) });
}

export async function addReport(db: CortexDb, exerciseId: string, comment: string, now: number): Promise<number> {
  const id = await db.reports.add(stamp({ exerciseId, comment: comment.slice(0, 4000), createdAt: now }));
  if (typeof id !== "number") throw new Error("No se pudo guardar el reporte.");
  return id;
}

export async function setPreferences(db: CortexDb, patch: Partial<Preferences>): Promise<void> {
  await db.transaction("rw", db.profile, async () => {
    const p = await getProfile(db);
    await db.profile.put({ ...p, preferences: { ...p.preferences, ...patch } });
  });
}

export async function setFrame(db: CortexDb, frame: string | null): Promise<void> {
  await db.transaction("rw", db.profile, async () => {
    const p = await getProfile(db);
    if (frame !== null && !p.cosmetics.frames.includes(frame)) return;
    await db.profile.put({ ...p, cosmetics: { ...p.cosmetics, frame } });
  });
}

/** Ids marcados como "ilusión de saber" sin corregir: van primero en el calentamiento. */
export async function illusionIds(db: CortexDb): Promise<Set<string>> {
  return new Set((await db.mistakes.filter((m) => m.illusion && m.fixedAt === null).toArray()).map((m) => m.exerciseId));
}

export { ACHIEVEMENTS };
