"use client";

import { Ghost, Skull, Swords, Timer } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lives } from "@/components/hud/lives";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { CatalogExercise, CatalogUnit, StudyCatalog } from "@/content/core/study-catalog";
import type { CortexDb } from "@/db/db";
import { type BossOutcome, finishBoss, recordAnswer, scheduleNow } from "@/db/progress";
import type { ProfileRecord } from "@/db/types";
import {
  answerBoss,
  type BossRun,
  currentWave,
  ghostCorrectAt,
  type GhostEvent,
  planBoss,
  startBoss,
  timeLeftMs,
  timeoutBoss,
} from "@/engine/boss";
import { createRng, seedFrom } from "@/engine/rng";
import { playSound } from "@/lib/sound";
import { exerciseRef, missionContext, unitRef } from "@/lib/study";
import { cn } from "@/lib/utils";
import { useCelebrate } from "./celebrations";
import { ExerciseCard } from "./exercise-card";
import { isPlayable } from "./exercise-types";
import { RichText } from "./rich-text";

const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Jefe (docs/03): 3 oleadas, vidas, tiempo global, entrelazado, fantasma y autopsia. Las
 * preguntas no dan XP sueltas: la recompensa llega al aprobar.
 */
export function BossRunner({
  db,
  catalog,
  profile,
  unit,
  onFinished,
  doneActions,
}: {
  db: CortexDb;
  catalog: StudyCatalog;
  profile: ProfileRecord;
  unit: CatalogUnit;
  onFinished?: (o: BossOutcome) => void;
  doneActions?: React.ReactNode;
}) {
  const { fromOutcome } = useCelebrate();
  const [hardcore, setHardcore] = useState(false);
  const [run, setRun] = useState<BossRun | null>(null);
  const [outcome, setOutcome] = useState<BossOutcome | null>(null);
  const [ghost, setGhost] = useState<GhostEvent[] | null>(null);
  const [now, setNow] = useState(0);
  // La pregunta que se ve: avanza al pulsar "Siguiente", para no perder la retroalimentación.
  const [shownIndex, setShownIndex] = useState(0);
  const [scheduled, setScheduled] = useState<number | null>(null);
  const finishing = useRef(false);
  const boss = unit.boss;
  const info = useCallback(
    (id: string) => {
      const ex = catalog.exercises[id];
      // Las autoevaluaciones (y los tipos que esta versión aún no juega) no entran al jefe.
      return ex ? { difficulty: ex.dificultad, selfAssessed: ex.tipo === "autoevaluacion" || !isPlayable(ex) } : undefined;
    },
    [catalog.exercises],
  );
  const total = useMemo(() => planBoss(boss, info, createRng(1)).waves.flat().length, [boss, info]);

  useEffect(() => {
    let alive = true;
    void db.ghosts.get(`jefe:${unit.key}${hardcore ? ":hardcore" : ""}`).then((g) => alive && setGhost((g?.events as GhostEvent[] | undefined) ?? null));
    return () => {
      alive = false;
    };
  }, [db, hardcore, unit.key, outcome]);

  const end = useCallback(
    async (finalRun: BossRun) => {
      if (finishing.current) return;
      finishing.current = true;
      const t = Date.now();
      const out = await finishBoss(db, {
        unit: unitRef(unit),
        run: finalRun,
        reward: boss.recompensa.xp,
        insignia: boss.recompensa.insignia,
        bossName: boss.nombre,
        now: t,
        ctx: await missionContext(db, catalog, t),
      });
      playSound(out.passed ? "level" : "wrong", profile.preferences.sound);
      fromOutcome(out);
      setOutcome(out);
      onFinished?.(out);
    },
    [boss, catalog, db, fromOutcome, onFinished, profile.preferences.sound, unit],
  );

  // Reloj: 4 veces por segundo mientras se pelea; si se acaba el tiempo, termina la pelea.
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);
  const playing = run?.status === "playing";
  const startedAt = run?.startedAt;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const r = runRef.current;
      if (r && r.status === "playing" && timeLeftMs(r, t) <= 0) {
        const timed = timeoutBoss(r, t);
        runRef.current = timed;
        setRun(timed);
        void end(timed);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [end, playing, startedAt]);

  if (outcome && run) {
    const missed = [...outcome.failed, ...outcome.unanswered];
    return (
      <section aria-live="polite" className={cn("rounded-xl border-2 bg-surface p-6", outcome.passed ? "border-brand" : "border-danger")}>
        <p className="console-label">Autopsia del jefe</p>
        <h2 className="mt-2 text-3xl font-extrabold">{outcome.passed ? `¡Derrotaste a «${boss.nombre}»!` : `«${boss.nombre}» ganó esta vez`}</h2>
        <p className="mt-2 text-ink-2">
          {Math.round(outcome.score * 100)}% de aciertos (se necesita {Math.round(boss.aprobado_minimo * 100)}%).
          {run.endReason === "time" ? " Se acabó el tiempo." : run.endReason === "lives" ? " Te quedaste sin vidas." : ""}
          {outcome.passed ? ` +${outcome.xp.total} XP${outcome.beatGhost ? " (le ganaste a tu fantasma)" : ""}.` : " No pierdes nada del XP que ya tenías."}
        </p>
        {missed.length ? (
          <div className="mt-6">
            <h3 className="font-semibold">Qué repasar</h3>
            <ul className="mt-3 grid gap-3">
              {missed.map((id) => {
                const ex = catalog.exercises[id];
                if (!ex) return null;
                return (
                  <li key={id} className="rounded-md border border-border-strong bg-surface-2 p-4 text-sm">
                    <p className="font-mono text-xs text-muted-foreground">
                      {id} · {outcome.unanswered.includes(id) ? "sin contestar" : "fallada"} · conceptos: {ex.conceptos.join(", ")}
                    </p>
                    <RichText text={ex.enunciado} className="mt-2" />
                    <details className="mt-2">
                      <summary className="cursor-pointer text-brand">Ver la explicación</summary>
                      <RichText text={ex.explicacion} className="mt-2" />
                    </details>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                disabled={scheduled !== null}
                onClick={() => void scheduleNow(db, missed, Date.now()).then(setScheduled)}
              >
                Mandar estos a mi repaso de hoy
              </Button>
              {scheduled !== null ? <span className="text-sm text-muted-foreground">Listo: ya están en tu cola (y en el cuaderno de errores).</span> : null}
            </div>
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={() => {
              finishing.current = false;
              setOutcome(null);
              setRun(null);
              setScheduled(null);
            }}
          >
            Pelear otra vez
          </Button>
          {doneActions}
        </div>
      </section>
    );
  }

  if (!run) {
    return (
      <section className="rounded-xl border-2 border-border-strong bg-surface p-6">
        <p className="console-label flex items-center gap-2">
          <Skull aria-hidden className="size-4" /> Jefe de la unidad
        </p>
        <h2 className="mt-2 text-3xl font-extrabold text-balance">{boss.nombre}</h2>
        <ul className="mt-4 grid gap-1 text-ink-2">
          <li>
            {total} preguntas en 3 oleadas (fácil → difícil){boss.preguntas.repaso_de?.length ? `, ${boss.preguntas.repaso_de.length} de unidades anteriores` : ""}.
          </li>
          <li>
            {hardcore ? 1 : boss.vidas} {hardcore || boss.vidas === 1 ? "vida" : "vidas"} · {fmt(boss.tiempo_segundos * 1000)} min en total · apruebas con {Math.round(boss.aprobado_minimo * 100)}%.
          </li>
          <li>Recompensa: {boss.recompensa.xp} XP la primera vez e insignia «{boss.recompensa.insignia}».</li>
          {ghost ? <li className="flex items-center gap-1.5"><Ghost aria-hidden className="size-4" /> Tu fantasma (mejor intento) correrá contigo.</li> : null}
        </ul>
        <label className="mt-5 flex items-center gap-3">
          <Switch checked={hardcore} onCheckedChange={setHardcore} aria-describedby="hardcore-desc" />
          <span>
            <span className="font-semibold">Modo hardcore</span>
            <span id="hardcore-desc" className="block text-sm text-muted-foreground">
              1 vida y sin pistas. Da una insignia exclusiva.
            </span>
          </span>
        </label>
        <Button
          size="lg"
          className="mt-6"
          onClick={() => {
            const t = Date.now();
            finishing.current = false;
            setNow(t);
            setShownIndex(0);
            setRun(startBoss(planBoss(boss, info, createRng(seedFrom(`${unit.key}/${t}`)), hardcore), t));
          }}
        >
          <Swords aria-hidden /> Empezar la pelea
        </Button>
      </section>
    );
  }

  const q = run.queue[shownIndex] ?? null;
  const ex = q ? catalog.exercises[q.exerciseId] : null;
  const left = timeLeftMs(run, now || run.startedAt);
  const elapsed = (now || run.startedAt) - run.startedAt;
  const mine = run.results.filter((r) => r.correct).length;
  const ghostNow = ghost ? ghostCorrectAt(ghost, elapsed) : null;

  return (
    <div className="grid gap-4">
      <div className="sticky top-16 z-30 grid gap-2 rounded-lg border border-border-strong bg-surface/95 p-3 backdrop-blur sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-5">
        <Lives current={run.lives} max={run.plan.lives} />
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            Oleada {currentWave({ ...run, index: shownIndex })} de {run.plan.waves.length} · pregunta {Math.min(shownIndex + 1, run.queue.length)} de {run.queue.length}
          </p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label="Tus aciertos" aria-valuemin={0} aria-valuemax={run.queue.length} aria-valuenow={mine}>
            <div className="h-full bg-brand" style={{ width: `${(100 * mine) / run.queue.length}%` }} />
          </div>
          {ghostNow !== null ? (
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label="Tu fantasma" aria-valuemin={0} aria-valuemax={run.queue.length} aria-valuenow={ghostNow}>
              <div className="h-full bg-ink-2/60" style={{ width: `${(100 * ghostNow) / run.queue.length}%` }} />
            </div>
          ) : null}
        </div>
        <p className={cn("flex items-center gap-1.5 font-mono text-lg tabular-nums", left < 60_000 && "text-danger")} aria-label={`Tiempo restante ${fmt(left)}`}>
          <Timer aria-hidden className="size-4" />
          {fmt(left)}
        </p>
      </div>
      {ex && q ? (
        <ExerciseCard
          key={`${q.exerciseId}-${shownIndex}`}
          exercise={ex}
          seed={shownIndex + 11}
          allowHints={!run.plan.hardcore}
          header={q.review ? <span className="font-mono text-xs text-info">repaso de otra unidad</span> : null}
          onAnswered={async (r) => {
            const t = Date.now();
            await recordAnswer(db, {
              exercise: exerciseRef(ex),
              unit: unitRef(unitOfExercise(catalog, ex) ?? unit),
              correct: r.correct,
              answer: r.answer,
              timeMs: r.timeMs,
              confidence: r.confidence,
              hintsUsed: r.hintsUsed,
              mode: "boss",
              sessionId: null,
              now: t,
              ctx: await missionContext(db, catalog, t),
            });
            playSound(r.correct ? "right" : "wrong", profile.preferences.sound);
            const next = answerBoss(run, r.correct, t);
            setRun(next);
            if (next.status === "playing") return {};
            return { note: next.endReason === "lives" ? "Te quedaste sin vidas: fin de la pelea." : next.endReason === "time" ? "Se acabó el tiempo." : "Era la última pregunta." };
          }}
          nextLabel={run.status === "playing" ? "Siguiente" : "Ver la autopsia"}
          onNext={() => {
            if (run.status !== "playing") void end(run);
            else setShownIndex(run.index);
          }}
        />
      ) : (
        <div className="grid justify-items-start gap-3">
          <p>La pelea terminó.</p>
          <Button onClick={() => void end(run)}>Ver la autopsia</Button>
        </div>
      )}
    </div>
  );
}

function unitOfExercise(catalog: StudyCatalog, ex: CatalogExercise): CatalogUnit | undefined {
  for (const s of catalog.subjects) for (const u of s.units) if (u.key === ex.unitKey) return u;
  return undefined;
}
