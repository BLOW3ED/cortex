"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Brain, NotebookPen, Play, Repeat, Skull, Target } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { missionTitle } from "@/components/study/daily-session";
import { StudyGate, type StudyContext } from "@/components/study/study-gate";
import { Button } from "@/components/ui/button";
import { findUnit } from "@/content/core/study-catalog";
import { ensureToday } from "@/db/progress";
import { missionLabel, type MissionKind } from "@/engine/missions";
import { chooseMission } from "@/engine/session";
import { visibleStreak } from "@/engine/streak";
import { missionContext, unitHref } from "@/lib/study";
import { unitStates } from "@/lib/today";
import { useToday } from "@/lib/use-clock";
import { cn } from "@/lib/utils";

/**
 * "Hoy" en el inicio (docs/00, fricción cero): un botón grande arma la sesión del día. Muestra
 * racha, XP de hoy, misiones y el jefe más cercano.
 */
function Today({ db, catalog, profile, today }: StudyContext & { today: string }) {
  useEffect(() => {
    const now = Date.now();
    void missionContext(db, catalog, now).then((ctx) => ensureToday(db, now, ctx));
  }, [catalog, db, today]);
  const data = useLiveQuery(
    () => Promise.all([db.days.get(today), db.missions.where("day").equals(today).toArray(), db.unitProgress.toArray(), db.cards.where("due").belowOrEqual(Date.now()).count()]),
    // `today` cambia a medianoche y vuelve a leer todo.
    [db, today],
  );
  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-surface-2" />;
  const [day, missions, progress, due] = data;
  const streak = visibleStreak({ current: profile.currentStreak, max: profile.maxStreak, freezes: profile.streakFreezes, lastDay: profile.lastStudyDay, repair: profile.streakRepair }, today);
  const next = chooseMission(unitStates(catalog, progress), catalog.subjects.map((s) => s.id));
  const nextUnit = next ? findUnit(catalog, next.unitKey) : undefined;
  const done = day?.sessionDone ?? false;

  return (
    <section aria-labelledby="hoy" className="rounded-2xl border-2 border-border-strong bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <h2 id="hoy" className="console-label">
            Hoy · {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 font-mono">
            <div>
              <dt className="text-xs text-muted-foreground">Racha</dt>
              <dd className="text-2xl font-semibold text-streak tabular-nums">{streak.current === 0 ? "empieza hoy" : `${streak.current} ${streak.current === 1 ? "día" : "días"}`}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">XP de hoy</dt>
              <dd className="text-2xl font-semibold text-xp-text tabular-nums">{day?.xp ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Repasos pendientes</dt>
              <dd className="text-2xl font-semibold tabular-nums">{due}</dd>
            </div>
          </dl>
          {streak.atRisk ? <p className="mt-2 text-sm text-ink-2">Te guardamos el lugar: un congelamiento cubre el día que faltó.</p> : null}
          {day?.minimumMet ? <p className="mt-2 text-sm text-brand">Tu misión mínima de hoy ya cuenta. Lo que sigas haciendo es extra.</p> : null}
        </div>
        <Button asChild size="lg" className="h-14 px-7 text-lg">
          <Link href="/sesion">
            <Play aria-hidden className="size-5" /> {done ? "Seguir estudiando" : day?.answered ? "Continuar sesión de hoy" : "Empezar sesión de hoy"}
          </Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <p className="console-label mb-2">Misiones del día · 30 XP cada una</p>
          <ul className="grid gap-1.5">
            {missions
              .sort((a, b) => a.key.localeCompare(b.key))
              .map((m) => (
                <li key={m.key} className="flex items-center gap-3 text-sm">
                  <Target aria-hidden className={cn("size-4 shrink-0", m.completed ? "text-brand" : "text-muted-foreground")} />
                  <span className={cn("flex-1", m.completed && "text-muted-foreground line-through")}>{missionLabel({ kind: m.kind as MissionKind, target: m.target })}</span>
                  <span className="font-mono text-xs tabular-nums">
                    {m.progress}/{m.target}
                  </span>
                </li>
              ))}
          </ul>
        </div>
        {next && nextUnit ? (
          <div>
            <p className="console-label mb-2">Lo que sigue</p>
            <Link href={unitHref(nextUnit, next.kind === "boss" ? "/jefe" : next.kind === "practice" ? "/practica" : "")} className="flex items-center gap-3 rounded-md border bg-surface-2 p-3 hover:border-brand">
              <Skull aria-hidden className="size-5 shrink-0 text-life" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{missionTitle(next, catalog)}</span>
                <span className="block text-xs text-muted-foreground">Jefe de la unidad: «{nextUnit.boss.nombre}»</span>
              </span>
            </Link>
          </div>
        ) : null}
      </div>

      <nav aria-label="Atajos de estudio" className="mt-5 flex flex-wrap gap-2 text-sm">
        <Link href="/repaso" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 hover:bg-surface-2">
          <Repeat aria-hidden className="size-4" /> Repaso libre
        </Link>
        <Link href="/gimnasio" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 hover:bg-surface-2">
          <Brain aria-hidden className="size-4" /> Gimnasio
        </Link>
        <Link href="/cuaderno" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 hover:bg-surface-2">
          <NotebookPen aria-hidden className="size-4" /> Cuaderno de errores
        </Link>
      </nav>
    </section>
  );
}

export function HomeToday() {
  const today = useToday();
  return <StudyGate>{(ctx) => (today ? <Today {...ctx} today={today} /> : null)}</StudyGate>;
}
