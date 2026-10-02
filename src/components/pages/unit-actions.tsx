"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Dumbbell, Map as MapIcon, Skull, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { useCortexDb } from "@/db/use-profile";
import { MASTERY_LABELS, type Mastery } from "@/engine/mastery";

/** Acciones de una unidad junto a su lección: mini quiz, práctica, jefe y su estado. */
function Actions({ unitKey, exerciseCount, bossName }: { unitKey: string; exerciseCount: number; bossName: string }) {
  const db = useCortexDb();
  const params = useSearchParams();
  const fromSession = params.get("desde") === "sesion";
  const progress = useLiveQuery(async () => (db.status === "ready" ? ((await db.db.unitProgress.get(unitKey)) ?? null) : undefined), [db, unitKey]);
  const [subjectId, slug] = unitKey.split("/");
  const base = `/materias/${subjectId}/${slug}`;
  const suffix = fromSession ? "?desde=sesion" : "";
  const status = (progress?.status ?? "new") as Mastery;
  return (
    <div className="rounded-lg border bg-surface p-5">
      <h2 className="console-label">Práctica y jefe</h2>
      <p className="mt-3 font-mono text-3xl font-semibold tabular-nums">{exerciseCount}</p>
      <p className="text-sm text-ink-2">ejercicios en escalera de dificultad</p>
      <p className="mt-3 text-sm">
        Estado: <span className="font-semibold">{progress === undefined ? "…" : MASTERY_LABELS[status]}</span>
        {progress?.lessonDone ? " · lección completa" : ""}
      </p>
      <div className="mt-4 grid gap-2">
        <Button asChild>
          <Link href={`${base}/quiz${suffix}`}>
            <Sparkles aria-hidden /> {progress?.lessonDone ? "Repetir el mini quiz" : "Mini quiz: completar lección"}
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`${base}/practica${suffix}`}>
            <Dumbbell aria-hidden /> Practicar
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`${base}/jefe${suffix}`}>
            <Skull aria-hidden /> Jefe: «{bossName}»
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/materias/${subjectId}/mapa`}>
            <MapIcon aria-hidden /> Mapa de maestría
          </Link>
        </Button>
      </div>
      {progress?.bestBoss !== null && progress?.bestBoss !== undefined ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">Mejor intento contra el jefe: {Math.round(progress.bestBoss * 100)}%</p>
      ) : null}
    </div>
  );
}

export function UnitActions(props: { unitKey: string; exerciseCount: number; bossName: string }) {
  return (
    <Suspense fallback={null}>
      <Actions {...props} />
    </Suspense>
  );
}
