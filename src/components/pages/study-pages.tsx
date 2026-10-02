"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { GymHub } from "@/components/gym/gym-hub";
import { BossRunner } from "@/components/study/boss-runner";
import { DailySession } from "@/components/study/daily-session";
import { LessonQuiz, PracticeRunner, ReviewRunner, SingleExercise } from "@/components/study/runners";
import { StudyGate } from "@/components/study/study-gate";
import { Button } from "@/components/ui/button";
import { findUnit } from "@/content/core/study-catalog";
import { unitHref } from "@/lib/study";

/**
 * Envoltorios de cliente de cada página de estudio: esperan base + catálogo (StudyGate) y montan
 * el runner que toca. `Esc` regresa a la unidad.
 */

function useEscapeTo(href: string) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // En el editor de código, Esc sirve para salir de él con Tab: no saca de la página.
      const el = e.target as HTMLElement | null;
      if (el?.closest(".cm-editor") || el?.tagName === "INPUT" || el?.tagName === "TEXTAREA") return;
      if (document.querySelector("[role=alertdialog], [role=dialog]")) return;
      window.location.assign(href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [href]);
}

function Crumb({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <nav aria-label="Ruta" className="console-label mb-4">
      <Link href={href} className="inline-flex items-center gap-1 hover:text-ink">
        <ArrowLeft aria-hidden className="size-3.5" /> {children}
      </Link>
    </nav>
  );
}

export function SessionPageClient() {
  return (
    <StudyGate>{(ctx) => <DailySession db={ctx.db} catalog={ctx.catalog} profile={ctx.profile} />}</StudyGate>
  );
}

export function ReviewPageClient() {
  return (
    <StudyGate>
      {(ctx) => (
        <ReviewRunner
          db={ctx.db}
          catalog={ctx.catalog}
          profile={ctx.profile}
          max={30}
          doneActions={
            <Button asChild variant="secondary">
              <Link href="/">Volver al inicio</Link>
            </Button>
          }
        />
      )}
    </StudyGate>
  );
}

function UnitStudy({ unitKey, kind }: { unitKey: string; kind: "practice" | "boss" | "quiz" }) {
  const [subjectId, slug] = unitKey.split("/");
  const back = `/materias/${subjectId}/${slug}`;
  useEscapeTo(back);
  const params = useSearchParams();
  const fromSession = params.get("desde") === "sesion";
  return (
    <StudyGate>
      {(ctx) => {
        const unit = findUnit(ctx.catalog, unitKey);
        if (!unit) return <p>Unidad no encontrada.</p>;
        const actions = (
          <>
            {fromSession ? (
              <Button asChild>
                <Link href="/sesion">Volver a tu sesión</Link>
              </Button>
            ) : null}
            <Button asChild variant="secondary">
              <Link href={unitHref(unit)}>Volver a la unidad</Link>
            </Button>
            {kind !== "boss" ? (
              <Button asChild variant="outline">
                <Link href={unitHref(unit, "/jefe")}>Ir al jefe</Link>
              </Button>
            ) : null}
          </>
        );
        return (
          <div>
            <Crumb href={unitHref(unit)}>{unit.title}</Crumb>
            {kind === "practice" ? (
              <PracticeRunner db={ctx.db} catalog={ctx.catalog} profile={ctx.profile} unit={unit} doneActions={actions} />
            ) : kind === "boss" ? (
              <BossRunner db={ctx.db} catalog={ctx.catalog} profile={ctx.profile} unit={unit} doneActions={actions} />
            ) : (
              <LessonQuiz db={ctx.db} catalog={ctx.catalog} profile={ctx.profile} unit={unit} doneActions={actions} />
            )}
          </div>
        );
      }}
    </StudyGate>
  );
}

export function UnitStudyClient(props: { unitKey: string; kind: "practice" | "boss" | "quiz" }) {
  return (
    <Suspense fallback={null}>
      <UnitStudy {...props} />
    </Suspense>
  );
}

export function GymPageClient() {
  return <StudyGate>{(ctx) => <GymHub db={ctx.db} catalog={ctx.catalog} />}</StudyGate>;
}

export function SingleExerciseClient({ exerciseId }: { exerciseId: string }) {
  return (
    <StudyGate>
      {(ctx) => {
        const ex = ctx.catalog.exercises[exerciseId];
        const unit = ex ? findUnit(ctx.catalog, ex.unitKey) : undefined;
        if (!ex || !unit) return <p>Ejercicio no encontrado.</p>;
        return (
          <div>
            <Crumb href={unitHref(unit)}>{unit.title}</Crumb>
            <SingleExercise db={ctx.db} catalog={ctx.catalog} profile={ctx.profile} exercise={ex} unit={unit} />
          </div>
        );
      }}
    </StudyGate>
  );
}
