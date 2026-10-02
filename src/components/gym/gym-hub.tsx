"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { StudyCatalog } from "@/content/core/study-catalog";
import type { CortexDb } from "@/db/db";
import { GYM_GAMES, type GymGame } from "@/engine/session";
import { GAME_INFO } from "./games";
import { GymSession } from "./gym-session";

/** Gimnasio libre: elige un minijuego y juega cuantas rondas quieras. */
export function GymHub({ db, catalog }: { db: CortexDb; catalog: StudyCatalog }) {
  const [game, setGame] = useState<GymGame | null>(null);
  const [round, setRound] = useState(0);
  if (game) {
    return (
      <GymSession
        key={`${game}-${round}`}
        db={db}
        catalog={catalog}
        game={game}
        doneActions={
          <>
            <Button onClick={() => setRound((r) => r + 1)} autoFocus>
              Otra ronda
            </Button>
            <Button variant="secondary" onClick={() => setGame(null)}>
              Elegir otro juego
            </Button>
          </>
        }
      />
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {GYM_GAMES.map((g) => {
        const info = GAME_INFO[g];
        const Icon = info.icon;
        return (
          <li key={g}>
            <button
              type="button"
              onClick={() => setGame(g)}
              className="arcade flex h-full w-full flex-col items-start gap-2 rounded-lg border-2 border-border-strong bg-surface p-5 text-left hover:border-brand"
            >
              <Icon aria-hidden className="size-6 text-brand" />
              <span className="console-label">{info.domain}</span>
              <span className="text-lg font-semibold">{info.name}</span>
              <span className="text-sm text-ink-2">{info.blurb}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
