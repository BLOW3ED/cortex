"use client";

import { BookOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CatalogExercise, CatalogUnit, StudyCatalog } from "@/content/core/study-catalog";
import type { CortexDb } from "@/db/db";
import { completeLesson, completeReviewBlock, endSession, illusionIds, recordAnswer, startSession } from "@/db/progress";
import type { AttemptMode, ProfileRecord, SessionKind } from "@/db/types";
import { CONFIG, type Difficulty } from "@/engine/config";
import { type FlowAnswer, type FlowItem, initialLevel, nextFlow, pickExercise, workedExampleFor } from "@/engine/flow";
import { createRng, seedFrom, shuffle } from "@/engine/rng";
import { intervalDays, warmupQueue } from "@/engine/srs";
import { playSound } from "@/lib/sound";
import { exerciseRef, missionContext, unitRef } from "@/lib/study";
import { useCelebrate } from "./celebrations";
import { type AfterAnswer, ExerciseCard, type ExerciseResult } from "./exercise-card";
import { isPlayable } from "./exercise-types";
import { RichText } from "./rich-text";

const QUIZ_EXCLUDED = new Set(["codigo", "depurar", "parsons", "rastreo_memoria"]);

/** Texto de "vuelve en..." a partir de días. */
export function dueText(days: number): string {
  if (days < 1 / 24) return "Vuelve en unos minutos para afianzarlo.";
  if (days < 1) return `Vuelve en ${Math.max(1, Math.round(days * 24))} h.`;
  const d = Math.round(days);
  return `Vuelve a tu repaso en ${d} ${d === 1 ? "día" : "días"}.`;
}

interface Tally {
  answered: number;
  correct: number;
  xp: number;
}

/** Guarda una respuesta y celebra lo que haya provocado. Compartido por todos los modos. */
function useRecorder(db: CortexDb, catalog: StudyCatalog, profile: ProfileRecord, mode: AttemptMode, sessionId: number | null) {
  const { fromOutcome } = useCelebrate();
  return useCallback(
    async (ex: CatalogExercise, unit: CatalogUnit, r: ExerciseResult): Promise<AfterAnswer> => {
      const now = Date.now();
      const out = await recordAnswer(db, {
        exercise: exerciseRef(ex),
        unit: unitRef(unit),
        correct: r.correct,
        answer: r.answer,
        timeMs: r.timeMs,
        confidence: r.confidence,
        hintsUsed: r.hintsUsed,
        mode,
        sessionId,
        now,
        ctx: await missionContext(db, catalog, now),
      });
      playSound(r.correct ? "right" : "wrong", profile.preferences.sound);
      if (out.levelAfter > out.levelBefore) playSound("level", profile.preferences.sound);
      fromOutcome(out);
      const notes: string[] = [];
      if (out.card) notes.push(dueText(intervalDays(out.card, now)));
      if (out.restSuggested) notes.push("Llevas más de 90 minutos hoy: buen momento para descansar. Lo que sigas haciendo ya no suma XP.");
      return { xp: out.xp, note: notes.join(" ") };
    },
    [catalog, db, fromOutcome, mode, profile.preferences.sound, sessionId],
  );
}

function unitOf(catalog: StudyCatalog, ex: CatalogExercise): CatalogUnit {
  for (const s of catalog.subjects) for (const u of s.units) if (u.key === ex.unitKey) return u;
  throw new Error(`unidad ${ex.unitKey} no encontrada`);
}

/** Abre una sesión en la tabla `sessions` mientras el componente vive. */
function useSession(db: CortexDb, kind: SessionKind, unitKey?: string): number | null {
  const [id, setId] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    let opened: number | null = null;
    void startSession(db, kind, Date.now(), unitKey).then((sid) => {
      opened = sid;
      if (alive) setId(sid);
      else void endSession(db, sid, Date.now());
    });
    return () => {
      alive = false;
      if (opened !== null) void endSession(db, opened, Date.now());
    };
  }, [db, kind, unitKey]);
  return id;
}

function Summary({ tally, title, children }: { tally: Tally; title: string; children?: React.ReactNode }) {
  const pct = tally.answered ? Math.round((100 * tally.correct) / tally.answered) : 0;
  return (
    <section aria-live="polite" className="rounded-xl border-2 border-brand bg-surface p-6">
      <h2 className="text-2xl font-bold">{title}</h2>
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 font-mono">
        <div>
          <dt className="console-label">Aciertos</dt>
          <dd className="text-3xl font-semibold tabular-nums">
            {tally.correct}/{tally.answered}
          </dd>
        </div>
        <div>
          <dt className="console-label">Precisión</dt>
          <dd className="text-3xl font-semibold tabular-nums">{pct}%</dd>
        </div>
        <div>
          <dt className="console-label">XP</dt>
          <dd className="text-3xl font-semibold text-xp-text tabular-nums">+{tally.xp}</dd>
        </div>
      </dl>
      {children ? <div className="mt-5 flex flex-wrap gap-3">{children}</div> : null}
    </section>
  );
}

// ---------------------------------------------------------------- práctica adaptativa
export function PracticeRunner({
  db,
  catalog,
  profile,
  unit,
  blockSize = CONFIG.flow.practiceBlockSize,
  sessionKind = "free",
  onDone,
  doneActions,
}: {
  db: CortexDb;
  catalog: StudyCatalog;
  profile: ProfileRecord;
  unit: CatalogUnit;
  blockSize?: number;
  sessionKind?: SessionKind;
  onDone?: (t: Tally) => void;
  doneActions?: React.ReactNode;
}) {
  const sessionId = useSession(db, sessionKind, unit.key);
  const record = useRecorder(db, catalog, profile, "practice", sessionId);
  const pool = useMemo<FlowItem[]>(
    () =>
      unit.exerciseIds.flatMap((id) => {
        const ex = catalog.exercises[id];
        return ex && isPlayable(ex) ? [{ exerciseId: id, difficulty: ex.dificultad as Difficulty, concepts: ex.conceptos, ...(ex.tiempo_estimado_s ? { estimatedSeconds: ex.tiempo_estimado_s } : {}) }] : [];
      }),
    [catalog, unit],
  );
  const rng = useRef(createRng(seedFrom(unit.key)));
  const [state, setState] = useState<{
    level: Difficulty;
    history: FlowAnswer[];
    seen: Set<string>;
    solved: Set<string>;
    current: FlowItem | null;
    worked: FlowItem | null;
    tally: Tally;
    /** Avanza solo con "Siguiente": es la `key` de la tarjeta (responder no la remonta). */
    turn: number;
    done: boolean;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    void db.attempts
      .where("exerciseId")
      .anyOf([...unit.exerciseIds])
      .filter((a) => a.correct)
      .toArray()
      .then((rows) => {
        if (!alive) return;
        // Semilla distinta en cada práctica para variar el orden.
        rng.current = createRng(seedFrom(`${unit.key}/${Date.now()}`));
        const solved = new Set(rows.map((r) => r.exerciseId));
        const level = initialLevel(pool, solved);
        const current = pickExercise(pool, { level, solved, seenNow: new Set(), lastId: null, rng: rng.current });
        setState({ level, history: [], seen: new Set(), solved, current, worked: null, tally: { answered: 0, correct: 0, xp: 0 }, turn: 0, done: !current });
      });
    return () => {
      alive = false;
    };
  }, [db, pool, unit.exerciseIds, unit.key]);

  const onAnswered = useCallback(
    async (r: ExerciseResult) => {
      if (!state?.current) return;
      const ex = catalog.exercises[state.current.exerciseId];
      if (!ex) return;
      const after = await record(ex, unit, r);
      const item = state.current;
      setState((s) =>
        s && {
          ...s,
          history: [...s.history, { exerciseId: item.exerciseId, correct: r.correct, timeMs: r.timeMs, difficulty: item.difficulty, concepts: item.concepts, ...(item.estimatedSeconds ? { estimatedSeconds: item.estimatedSeconds } : {}) }],
          seen: new Set([...s.seen, item.exerciseId]),
          solved: r.correct ? new Set([...s.solved, item.exerciseId]) : s.solved,
          tally: { answered: s.tally.answered + 1, correct: s.tally.correct + (r.correct ? 1 : 0), xp: s.tally.xp + (after.xp?.total ?? 0) },
        },
      );
      return after;
    },
    [catalog.exercises, record, state, unit],
  );

  const onNext = useCallback(() => {
    setState((s) => {
      if (!s) return s;
      if (s.tally.answered >= blockSize) {
        onDone?.(s.tally);
        return { ...s, done: true, current: null, worked: null };
      }
      const flow = nextFlow(s.level, s.history);
      const lastId = s.current?.exerciseId ?? null;
      const current = pickExercise(pool, { level: flow.level, solved: s.solved, seenNow: s.seen, lastId, rng: rng.current });
      const worked = flow.showWorked ? workedExampleFor(pool, s.current?.concepts ?? [], flow.level, lastId) : null;
      return { ...s, level: flow.level, current, worked, turn: s.turn + 1 };
    });
  }, [blockSize, onDone, pool]);

  if (!state) return <p className="text-muted-foreground">Preparando tu práctica…</p>;
  if (state.done || !state.current) {
    return (
      <Summary tally={state.tally} title="Bloque de práctica terminado">
        {doneActions}
      </Summary>
    );
  }
  const ex = catalog.exercises[state.current.exerciseId];
  if (!ex) return null;
  return (
    <div className="grid gap-4">
      <p className="font-mono text-sm text-muted-foreground" aria-live="polite">
        Ejercicio {state.turn + 1} de {blockSize} · nivel {state.level}
      </p>
      {state.worked && catalog.exercises[state.worked.exerciseId] ? (
        <WorkedExample exercise={catalog.exercises[state.worked.exerciseId] as CatalogExercise} onClose={() => setState((s) => s && { ...s, worked: null })} />
      ) : (
        <ExerciseCard
          key={`${ex.id}-${state.turn}`}
          exercise={ex}
          onAnswered={onAnswered}
          onNext={onNext}
          seed={state.turn + 1}
          onSkip={() => {
            const id = ex.id;
            setState((s) => s && { ...s, seen: new Set([...s.seen, id]) });
            onNext();
          }}
        />
      )}
    </div>
  );
}

/** Tras 2 errores seguidos (docs/03): un ejemplo resuelto antes de seguir. */
function WorkedExample({ exercise, onClose }: { exercise: CatalogExercise; onClose: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <section className="rounded-xl border-2 border-info bg-surface p-6">
      <p className="console-label flex items-center gap-2">
        <BookOpen aria-hidden className="size-4" /> Ejemplo resuelto · antes de seguir
      </p>
      <p className="mt-2 text-sm text-ink-2">Dos errores seguidos en el mismo tema: bajamos un nivel. Mira cómo se resuelve uno parecido.</p>
      <div className="mt-4">
        <RichText text={exercise.enunciado} className="text-lg" />
      </div>
      <div className="mt-4 rounded-md bg-surface-2 p-4">
        <p className="console-label mb-1">Solución</p>
        <RichText text={exercise.explicacion} />
      </div>
      <Button ref={ref} className="mt-5" onClick={onClose}>
        Entendido, sigo
      </Button>
    </section>
  );
}

// ---------------------------------------------------------------- repaso FSRS
export function ReviewRunner({
  db,
  catalog,
  profile,
  max = CONFIG.srs.warmupMax,
  onDone,
  doneActions,
  sessionKind = "free",
}: {
  db: CortexDb;
  catalog: StudyCatalog;
  profile: ProfileRecord;
  max?: number;
  onDone?: (t: Tally) => void;
  doneActions?: React.ReactNode;
  sessionKind?: SessionKind;
}) {
  const sessionId = useSession(db, sessionKind);
  const record = useRecorder(db, catalog, profile, "review", sessionId);
  const { fromOutcome } = useCelebrate();
  const [queue, setQueue] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [tally, setTally] = useState<Tally>({ answered: 0, correct: 0, xp: 0 });
  const finished = useRef(false);

  useEffect(() => {
    let alive = true;
    const now = Date.now();
    void Promise.all([db.cards.toArray(), illusionIds(db)]).then(([cards, priority]) => {
      if (!alive) return;
      const known = cards.filter((c) => {
        const ex = catalog.exercises[c.exerciseId];
        return ex !== undefined && isPlayable(ex);
      });
      setQueue(warmupQueue(known, now, max, priority).map((c) => c.exerciseId));
    });
    return () => {
      alive = false;
    };
  }, [catalog.exercises, db, max]);

  const done = queue !== null && index >= queue.length;
  useEffect(() => {
    if (!done || finished.current || !queue) return;
    finished.current = true;
    const now = Date.now();
    if (queue.length > 0) {
      void missionContext(db, catalog, now)
        .then((ctx) => completeReviewBlock(db, now, ctx))
        .then((change) => fromOutcome(change));
    }
    onDone?.(tally);
  }, [catalog, db, done, fromOutcome, onDone, queue, tally]);

  if (!queue) return <p className="text-muted-foreground">Buscando tus repasos…</p>;
  if (queue.length === 0) {
    return (
      <Summary tally={tally} title="No tienes repasos pendientes">
        {doneActions}
      </Summary>
    );
  }
  if (done) {
    return (
      <Summary tally={tally} title="Repaso completo">
        {doneActions}
      </Summary>
    );
  }
  const ex = catalog.exercises[queue[index] ?? ""];
  if (!ex) return null;
  return (
    <div className="grid gap-4">
      <p className="font-mono text-sm text-muted-foreground" aria-live="polite">
        Repaso {index + 1} de {queue.length}
      </p>
      <ExerciseCard
        key={`${ex.id}-${index}`}
        exercise={ex}
        seed={index + 7}
        onAnswered={async (r) => {
          const after = await record(ex, unitOf(catalog, ex), r);
          setTally((t) => ({ answered: t.answered + 1, correct: t.correct + (r.correct ? 1 : 0), xp: t.xp + (after.xp?.total ?? 0) }));
          return after;
        }}
        onNext={() => setIndex((i) => i + 1)}
        onSkip={() => setIndex((i) => i + 1)}
      />
    </div>
  );
}

// ---------------------------------------------------------------- mini quiz de lección
export function LessonQuiz({
  db,
  catalog,
  profile,
  unit,
  doneActions,
}: {
  db: CortexDb;
  catalog: StudyCatalog;
  profile: ProfileRecord;
  unit: CatalogUnit;
  doneActions?: React.ReactNode;
}) {
  const sessionId = useSession(db, "free", unit.key);
  const record = useRecorder(db, catalog, profile, "lesson-quiz", sessionId);
  const { fromOutcome } = useCelebrate();
  const items = useMemo(() => {
    const eligible = unit.exerciseIds
      .map((id) => catalog.exercises[id])
      // Chequeo rápido: sin autoevaluación ni ejercicios de código (esos van en la práctica).
      .filter((e): e is CatalogExercise => !!e && e.tipo !== "autoevaluacion" && isPlayable(e) && !QUIZ_EXCLUDED.has(e.tipo))
      .sort((a, b) => a.dificultad - b.dificultad);
    const easy = eligible.filter((e) => e.dificultad <= 2);
    const base = easy.length >= CONFIG.xp.lessonQuizSize ? easy : eligible;
    return shuffle(createRng(seedFrom(`${unit.key}/quiz/${new Date().toDateString()}`)), base).slice(0, CONFIG.xp.lessonQuizSize);
  }, [catalog.exercises, unit]);
  const [index, setIndex] = useState(0);
  const [tally, setTally] = useState<Tally>({ answered: 0, correct: 0, xp: 0 });
  const [result, setResult] = useState<{ passed: boolean; score: number } | null>(null);

  useEffect(() => {
    if (index < items.length || result || items.length === 0) return;
    const now = Date.now();
    const score = tally.correct / items.length;
    void missionContext(db, catalog, now)
      .then((ctx) => completeLesson(db, unitRef(unit), score, now, ctx))
      .then((out) => {
        fromOutcome(out);
        setTally((t) => ({ ...t, xp: t.xp + out.xp.total }));
        setResult({ passed: out.passed, score });
      });
  }, [catalog, db, fromOutcome, index, items.length, result, tally.correct, unit]);

  if (items.length === 0) return <p>Esta unidad todavía no tiene ejercicios para el mini quiz.</p>;
  if (index >= items.length) {
    if (!result) return <p className="text-muted-foreground">Calificando…</p>;
    return (
      <Summary tally={tally} title={result.passed ? "Lección completada" : "Casi: necesitas 80 % para completarla"}>
        {!result.passed ? (
          <Button
            onClick={() => {
              setIndex(0);
              setTally({ answered: 0, correct: 0, xp: 0 });
              setResult(null);
            }}
          >
            Intentar de nuevo
          </Button>
        ) : null}
        {doneActions}
      </Summary>
    );
  }
  const ex = items[index] as CatalogExercise;
  return (
    <div className="grid gap-4">
      <p className="flex items-center gap-2 font-mono text-sm text-muted-foreground" aria-live="polite">
        <Sparkles aria-hidden className="size-4" /> Mini quiz · {index + 1} de {items.length} · necesitas {Math.ceil(CONFIG.xp.lessonQuizPass * items.length)} bien
      </p>
      <ExerciseCard
        key={`${ex.id}-${index}-${result ? 1 : 0}`}
        exercise={ex}
        seed={index + 3}
        onAnswered={async (r) => {
          const after = await record(ex, unit, r);
          setTally((t) => ({ answered: t.answered + 1, correct: t.correct + (r.correct ? 1 : 0), xp: t.xp + (after.xp?.total ?? 0) }));
          return after;
        }}
        onNext={() => setIndex((i) => i + 1)}
        nextLabel={index + 1 === items.length ? "Ver resultado" : "Siguiente"}
      />
    </div>
  );
}

/** Un solo ejercicio, como práctica libre (desde el cuaderno o la autopsia). */
export function SingleExercise({
  db,
  catalog,
  profile,
  exercise,
  unit,
}: {
  db: CortexDb;
  catalog: StudyCatalog;
  profile: ProfileRecord;
  exercise: CatalogExercise;
  unit: CatalogUnit;
}) {
  const sessionId = useSession(db, "free", unit.key);
  const record = useRecorder(db, catalog, profile, "practice", sessionId);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => {
            setDone(false);
            setRound((r) => r + 1);
          }}
        >
          Intentarlo otra vez
        </Button>
        <BackLink href={`/materias/${unit.subjectId}/${unit.slug}/practica`}>Practicar la unidad</BackLink>
        <BackLink href="/cuaderno">Cuaderno de errores</BackLink>
      </div>
    );
  }
  return <ExerciseCard key={`${exercise.id}-${round}`} exercise={exercise} seed={round + 5} onAnswered={(r) => record(exercise, unit, r)} onNext={() => setDone(true)} nextLabel="Listo" />;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild variant="secondary">
      <Link href={href}>{children}</Link>
    </Button>
  );
}
