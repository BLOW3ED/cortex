"use client";

import { useCallback, useEffect, useState } from "react";
import { useCelebrate } from "@/components/study/celebrations";
import type { StudyCatalog } from "@/content/core/study-catalog";
import type { CortexDb } from "@/db/db";
import { lastGymLevel, recordGym } from "@/db/progress";
import type { GymGame } from "@/engine/session";
import { missionContext } from "@/lib/study";
import { GAME_INFO, GymGameView, type GymRoundResult } from "./games";

/** Una ronda de un minijuego: retoma el último nivel, juega y guarda el resultado. */
export function GymSession({
  db,
  catalog,
  game,
  onDone,
  doneActions,
}: {
  db: CortexDb;
  catalog: StudyCatalog;
  game: GymGame;
  onDone?: (r: GymRoundResult) => void;
  doneActions?: React.ReactNode;
}) {
  const { fromOutcome } = useCelebrate();
  const [level, setLevel] = useState<number | null>(null);
  const [result, setResult] = useState<GymRoundResult | null>(null);
  const info = GAME_INFO[game];

  useEffect(() => {
    let alive = true;
    void lastGymLevel(db, game).then((l) => alive && setLevel(l ?? info.start));
    return () => {
      alive = false;
    };
  }, [db, game, info.start]);

  const finish = useCallback(
    async (r: GymRoundResult) => {
      setResult(r);
      const now = Date.now();
      const out = await recordGym(db, { game: r.game, domain: r.domain, level: r.nextLevel, score: r.score, bests: r.bests, now, ctx: await missionContext(db, catalog, now) });
      fromOutcome(out);
      onDone?.(r);
    },
    [catalog, db, fromOutcome, onDone],
  );

  const Icon = info.icon;
  return (
    <section className="rounded-xl border-2 border-border-strong bg-surface p-6">
      <p className="console-label flex items-center gap-2">
        <Icon aria-hidden className="size-4" /> Gimnasio · {info.domain}
      </p>
      <h2 className="mt-2 text-2xl font-bold">{info.name}</h2>
      <p className="mt-1 text-ink-2">{info.blurb}</p>
      <div className="mt-6">
        {level === null ? (
          <p className="text-muted-foreground">Cargando tu nivel…</p>
        ) : result ? (
          <div aria-live="polite" className="grid gap-3">
            <p className="text-lg">{result.summary}</p>
            <p className="text-sm text-muted-foreground">
              Próxima vez empiezas en el nivel {result.nextLevel}. Solo compites contra ti: el gimnasio entrena estas habilidades, no promete «subir el IQ».
            </p>
            {doneActions ? <div className="flex flex-wrap gap-3">{doneActions}</div> : null}
          </div>
        ) : (
          <GymGameView game={game} level={level} onDone={(r) => void finish(r)} />
        )}
      </div>
    </section>
  );
}
