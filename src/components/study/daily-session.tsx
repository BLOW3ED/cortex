"use client";

import { BookOpen, Check, Gift, Home, Swords, Target } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GymSession } from "@/components/gym/gym-session";
import { Button } from "@/components/ui/button";
import { findUnit, type StudyCatalog } from "@/content/core/study-catalog";
import { factsFor } from "@/content/facts";
import type { CortexDb } from "@/db/db";
import { type ChestResult, ensureToday, finishDailySession, openDailyChest } from "@/db/progress";
import type { ProfileRecord } from "@/db/types";
import { CONFIG } from "@/engine/config";
import { createRng, seedFrom } from "@/engine/rng";
import { chooseMission, gymGameFor, type MissionStep } from "@/engine/session";
import { playSound } from "@/lib/sound";
import { missionContext, unitHref } from "@/lib/study";
import { markMissionDone, readToday, type TodayStatus, unitStates } from "@/lib/today";
import { cn } from "@/lib/utils";
import { BossRunner } from "./boss-runner";
import { useCelebrate } from "./celebrations";
import { RichText } from "./rich-text";
import { LessonQuiz, PracticeRunner, ReviewRunner } from "./runners";

type Step = "warmup" | "mission" | "gym" | "close";
const STEPS: readonly { id: Step; label: string }[] = [
  { id: "warmup", label: "Calentamiento" },
  { id: "mission", label: "Misión" },
  { id: "gym", label: "Reto cognitivo" },
  { id: "close", label: "Cierre" },
];

export function missionTitle(m: MissionStep, catalog: StudyCatalog): string {
  const u = findUnit(catalog, m.unitKey);
  const name = u ? `«${u.title}»` : m.unitKey;
  if (m.kind === "lesson") return `Lección nueva: ${name}`;
  if (m.kind === "practice") return `Práctica: ${name}`;
  return `Jefe: «${u?.boss.nombre ?? m.unitKey}»`;
}

/**
 * Sesión del día (docs/03): calentamiento con repasos vencidos → misión nueva → reto cognitivo →
 * cierre con resumen, cofre y gancho para mañana. Se reanuda desde la base si sales y vuelves.
 */
export function DailySession({ db, catalog, profile }: { db: CortexDb; catalog: StudyCatalog; profile: ProfileRecord }) {
  const [status, setStatus] = useState<TodayStatus | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [round, setRound] = useState(0);

  const refresh = useCallback(async () => {
    const now = Date.now();
    await ensureToday(db, now, await missionContext(db, catalog, now));
    const s = await readToday(db, catalog, now);
    setStatus(s);
    setStep(!s.warmupDone ? "warmup" : !s.missionDone ? "mission" : !s.gymDone ? "gym" : "close");
    setRound((r) => r + 1);
  }, [catalog, db]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (alive) await refresh();
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  if (!status || !step) return <p className="text-muted-foreground">Armando tu sesión de hoy…</p>;
  const missionUnit = status.mission ? findUnit(catalog, status.mission.unitKey) : undefined;
  const cont = (
    <Button onClick={() => void refresh()} autoFocus>
      Continuar
    </Button>
  );

  return (
    <div className="grid gap-6">
      <ol className="grid grid-cols-4 gap-1.5" aria-label="Pasos de la sesión">
        {STEPS.map((s, i) => {
          const done = (s.id === "warmup" && status.warmupDone) || (s.id === "mission" && status.missionDone) || (s.id === "gym" && status.gymDone) || (s.id === "close" && status.dayRecord.sessionDone);
          const current = s.id === step;
          return (
            <li key={s.id} aria-current={current ? "step" : undefined} className={cn("rounded-md border-2 px-2 py-1.5 text-xs sm:text-sm", current ? "border-brand bg-surface-2" : done ? "border-border text-muted-foreground" : "border-border")}>
              <span className="font-mono text-muted-foreground">{i + 1}</span> {done ? <Check aria-label="hecho" className="inline size-3.5 text-brand" /> : null} <span className="font-semibold">{s.label}</span>
            </li>
          );
        })}
      </ol>

      {step === "warmup" ? (
        <section className="grid gap-3">
          <p className="text-ink-2">
            {status.dueCards} {status.dueCards === 1 ? "repaso vencido" : "repasos vencidos"}: recuperar de memoria justo antes de olvidar es lo que más fija. Vamos de fácil a difícil.
          </p>
          <ReviewRunner key={round} db={db} catalog={catalog} profile={profile} sessionKind="daily" doneActions={cont} />
        </section>
      ) : null}

      {step === "mission" && status.mission && missionUnit ? (
        <section className="grid gap-3">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Target aria-hidden className="size-5 text-brand" /> {missionTitle(status.mission, catalog)}
          </h2>
          {status.mission.kind === "lesson" ? (
            <LessonMission db={db} catalog={catalog} profile={profile} unitKey={status.mission.unitKey} onDone={() => void refresh()} />
          ) : status.mission.kind === "practice" ? (
            <PracticeRunner
              key={round}
              db={db}
              catalog={catalog}
              profile={profile}
              unit={missionUnit}
              sessionKind="daily"
              onDone={() => markMissionDone(status.day)}
              doneActions={cont}
            />
          ) : (
            <BossRunner key={round} db={db} catalog={catalog} profile={profile} unit={missionUnit} onFinished={() => markMissionDone(status.day)} doneActions={cont} />
          )}
          <p className="text-sm text-muted-foreground">
            ¿Hoy no?{" "}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-ink"
              onClick={() => {
                markMissionDone(status.day);
                void refresh();
              }}
            >
              Saltar la misión
            </button>
          </p>
        </section>
      ) : null}

      {step === "gym" ? <GymSession key={round} db={db} catalog={catalog} game={gymGameFor(status.day)} doneActions={cont} /> : null}

      {step === "close" ? <CloseScreen db={db} catalog={catalog} profile={profile} status={status} /> : null}

      <p className="text-sm text-muted-foreground">
        <Link href="/" className="inline-flex items-center gap-1.5 underline underline-offset-2 hover:text-ink">
          <Home aria-hidden className="size-3.5" /> Terminar por hoy
        </Link>{" "}
        · Parar nunca tiene castigo.
      </p>
    </div>
  );
}

function LessonMission({ db, catalog, profile, unitKey, onDone }: { db: CortexDb; catalog: StudyCatalog; profile: ProfileRecord; unitKey: string; onDone: () => void }) {
  const unit = findUnit(catalog, unitKey);
  const [quiz, setQuiz] = useState(false);
  if (!unit) return null;
  if (quiz) {
    return <LessonQuiz db={db} catalog={catalog} profile={profile} unit={unit} doneActions={<Button onClick={onDone}>Continuar</Button>} />;
  }
  return (
    <div className="rounded-xl border-2 border-border-strong bg-surface p-6">
      <p className="text-ink-2">
        Lee la lección (~{unit.minutes} min): abre con una pregunta para que intentes predecir antes de la teoría. Al terminar, un mini quiz de {CONFIG.xp.lessonQuizSize} preguntas la completa (+{CONFIG.xp.lesson} XP con 80 %).
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href={`${unitHref(unit)}?desde=sesion`}>
            <BookOpen aria-hidden /> Leer la lección
          </Link>
        </Button>
        <Button variant="secondary" size="lg" onClick={() => setQuiz(true)}>
          Ya la leí: mini quiz
        </Button>
      </div>
    </div>
  );
}

function CloseScreen({ db, catalog, profile, status }: { db: CortexDb; catalog: StudyCatalog; profile: ProfileRecord; status: TodayStatus }) {
  const { celebrate, fromOutcome } = useCelebrate();
  const [chest, setChest] = useState<ChestResult | null>(null);
  const [opened, setOpened] = useState(status.dayRecord.chestOpened);
  useEffect(() => {
    void finishDailySession(db, Date.now());
  }, [db]);
  const d = status.dayRecord;
  const tomorrow = useMemo(() => {
    const m = chooseMission(unitStates(catalog, status.progress), catalog.subjects.map((x) => x.id));
    if (!m) return null;
    const u = findUnit(catalog, m.unitKey);
    const open = u?.exerciseIds.map((id) => catalog.exercises[id]).find((e) => e && e.tipo !== "autoevaluacion" && e.dificultad >= 2);
    return { m, open };
  }, [catalog, status.progress]);

  return (
    <section className="grid gap-6">
      <div className="rounded-xl border-2 border-brand bg-surface p-6">
        <p className="console-label">Cierre del día</p>
        <h2 className="mt-2 text-3xl font-extrabold">Buen trabajo hoy.</h2>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 font-mono">
          <div>
            <dt className="console-label">XP de hoy</dt>
            <dd className="text-3xl font-semibold text-xp-text tabular-nums">{d.xp}</dd>
          </div>
          <div>
            <dt className="console-label">Aciertos</dt>
            <dd className="text-3xl font-semibold tabular-nums">
              {d.correct}/{d.answered}
            </dd>
          </div>
          <div>
            <dt className="console-label">Mejor racha de aciertos</dt>
            <dd className="text-3xl font-semibold tabular-nums">{d.bestCombo}</dd>
          </div>
        </dl>
        <p className="mt-4 text-ink-2">
          {d.minimumMet ? "Tu misión mínima de hoy ya cuenta para la racha. Puedes parar aquí, sin culpa." : "Para que hoy cuente en tu racha bastan 3 ejercicios bien o un repaso completo."}
        </p>
      </div>

      <div className="rounded-xl border-2 border-xp bg-surface p-6">
        <p className="console-label flex items-center gap-2">
          <Gift aria-hidden className="size-4" /> Cofre del día
        </p>
        {chest?.opened ? (
          <div aria-live="polite" className="fx-right mt-3">
            <ChestReveal result={chest} />
          </div>
        ) : opened ? (
          <p className="mt-3 text-ink-2">Ya abriste el cofre de hoy. Mañana hay otro.</p>
        ) : (
          <div className="mt-3 grid justify-items-start gap-3">
            <p className="text-ink-2">
              Puede traer XP, un congelamiento de racha, un marco para tu HUD, una insignia rara o un dato curioso.{" "}
              <Link href="/ajustes#cofre" className="underline underline-offset-2">
                Ver probabilidades
              </Link>
            </p>
            <Button
              size="lg"
              onClick={async () => {
                const r = await openDailyChest(db, Date.now(), createRng(seedFrom(`${status.day}/${crypto.getRandomValues(new Uint32Array(1))[0]}`)), factsFor(catalog.subjects.map((s) => s.id)));
                setChest(r);
                setOpened(true);
                if (r.opened) {
                  playSound("chest", profile.preferences.sound);
                  if (r.levelAfter > profile.level) fromOutcome({ levelBefore: profile.level, levelAfter: r.levelAfter });
                } else celebrate({ tone: "mission", title: r.reason });
              }}
            >
              <Gift aria-hidden /> Abrir el cofre
            </Button>
          </div>
        )}
      </div>

      {tomorrow ? (
        <div className="rounded-xl border bg-surface p-6">
          <p className="console-label">Mañana te espera</p>
          <p className="mt-2 flex items-center gap-2 font-semibold">
            <Swords aria-hidden className="size-4" /> {missionTitle(tomorrow.m, catalog)}
          </p>
          {tomorrow.open ? (
            <div className="mt-3 text-sm text-ink-2">
              <p className="mb-1">Te dejamos una pregunta abierta para que la pienses:</p>
              <RichText text={tomorrow.open.enunciado} />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function ChestReveal({ result }: { result: Extract<ChestResult, { opened: true }> }) {
  const r = result.reward;
  if (r.kind === "xp") return <p className="text-2xl font-bold text-xp-text">+{r.amount} XP de bonus</p>;
  if (r.kind === "freeze") return <p className="text-2xl font-bold">Un congelamiento de racha (cubre un día sin estudiar)</p>;
  if (r.kind === "frame") return <p className="text-2xl font-bold">Marco nuevo para tu HUD: «{r.frame}» (actívalo en Progreso)</p>;
  if (r.kind === "rare-badge") return <p className="text-2xl font-bold">Insignia rara: «{r.badge}»</p>;
  return (
    <div>
      <p className="text-lg font-semibold">Dato curioso</p>
      <p className="mt-1 text-ink-2">{r.fact}</p>
    </div>
  );
}
