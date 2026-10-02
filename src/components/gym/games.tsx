"use client";

import { Brain, Calculator, Sigma } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CONFIG } from "@/engine/config";
import { generateArithmetic } from "@/engine/gym/arithmetic";
import { generateNback, nextN, scoreNback } from "@/engine/gym/nback";
import { generateSequence, SEQUENCE_MAX_LEVEL } from "@/engine/gym/sequences";
import { createStaircase, stepStaircase } from "@/engine/gym/staircase";
import type { RecordCandidate } from "@/engine/records";
import { createRng, type Rng, seedFrom } from "@/engine/rng";
import type { GymGame } from "@/engine/session";
import { cn } from "@/lib/utils";

/**
 * Gimnasio mínimo de la Fase 1 (docs/06): n-back, cálculo mental y secuencias. La lógica vive en
 * `src/engine/gym/`; aquí solo se juega. Teclado primero.
 */

export interface GymRoundResult {
  readonly game: GymGame;
  readonly domain: string;
  readonly level: number;
  readonly nextLevel: number;
  readonly score: number;
  readonly summary: string;
  readonly bests: readonly RecordCandidate[];
}

export const GAME_INFO: Record<GymGame, { name: string; domain: string; blurb: string; icon: typeof Brain; start: number }> = {
  nback: { name: "N-back", domain: "Memoria de trabajo", blurb: "Una casilla se ilumina. ¿Es la misma de hace N pasos?", icon: Brain, start: 1 },
  arithmetic: { name: "Cálculo relámpago", domain: "Cálculo mental", blurb: "Operaciones contra el reloj; la dificultad se ajusta sola.", icon: Calculator, start: 1 },
  sequences: { name: "Patrón oculto", domain: "Razonamiento lógico", blurb: "Descubre la regla y da el siguiente término.", icon: Sigma, start: 1 },
};

function useSeededRng(game: string): Rng {
  // Semilla con la hora de inicio: cada ronda es distinta pero reproducible en pruebas.
  const [rng] = useState(() => createRng(seedFrom(`${game}/${Math.floor(performance.now())}`)));
  return rng;
}

// ---------------------------------------------------------------- n-back
const STIMULUS_MS = 700;
const TRIAL_MS = 2500;

export function NbackGame({ level, onDone }: { level: number; onDone: (r: GymRoundResult) => void }) {
  const n = Math.max(1, Math.round(level));
  const rng = useSeededRng("nback");
  const round = useMemo(() => generateNback(rng, n), [rng, n]);
  const [trial, setTrial] = useState(-1);
  const [lit, setLit] = useState(false);
  const responses = useRef<boolean[]>([]);
  const [pressed, setPressed] = useState(false);
  const finished = useRef(false);

  const respond = useCallback(() => {
    if (trial < 0 || trial >= round.positions.length || responses.current[trial]) return;
    responses.current[trial] = true;
    setPressed(true);
  }, [round.positions.length, trial]);

  useEffect(() => {
    if (trial < 0) return;
    if (trial >= round.positions.length) {
      if (finished.current) return;
      finished.current = true;
      const s = scoreNback(round, responses.current);
      const next = nextN(n, s.accuracy);
      onDone({
        game: "nback",
        domain: "memoria",
        level: n,
        nextLevel: next,
        score: Math.round(s.accuracy * 100) / 100,
        summary: `${Math.round(s.accuracy * 100)}% de precisión en ${n}-back (${s.hits} coincidencias detectadas, ${s.falseAlarms} falsas alarmas).`,
        bests: s.accuracy >= 0.8 ? [{ key: "best:gym-nback", value: n, direction: "higher", label: "N-back más alto (≥ 80 %)" }] : [],
      });
      return;
    }
    const on = window.setTimeout(() => setLit(true), 0);
    const off = window.setTimeout(() => setLit(false), STIMULUS_MS);
    const next = window.setTimeout(() => {
      setPressed(false);
      setTrial((t) => t + 1);
    }, TRIAL_MS);
    return () => [on, off, next].forEach((t) => window.clearTimeout(t));
  }, [n, onDone, round, trial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "j" || e.key === "J") {
        e.preventDefault();
        if (trial < 0) setTrial(0);
        else respond();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [respond, trial]);

  const pos = trial >= 0 ? round.positions[trial] : -1;
  return (
    <div className="grid justify-items-center gap-5">
      <p className="text-center text-ink-2">
        Pulsa <span className="kbd">Espacio</span> cuando la casilla sea la misma que hace <strong>{n}</strong> {n === 1 ? "paso" : "pasos"}.
      </p>
      <div className="grid grid-cols-3 gap-2" aria-hidden>
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className={cn("size-16 rounded-md border-2 border-border-strong sm:size-20", lit && pos === i ? "bg-brand" : "bg-surface-2")} />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {trial >= 0 && trial < round.positions.length && lit ? `Casilla ${(pos ?? 0) + 1}` : ""}
      </p>
      {trial < 0 ? (
        <Button size="lg" onClick={() => setTrial(0)}>
          Empezar ({round.positions.length} pasos)
        </Button>
      ) : (
        <div className="flex items-center gap-4">
          <Button size="lg" variant={pressed ? "secondary" : "default"} onClick={respond}>
            ¡Coincide!
          </Button>
          <span className="font-mono text-sm text-muted-foreground tabular-nums">
            {Math.min(trial + 1, round.positions.length)}/{round.positions.length}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- cálculo mental
export function ArithmeticGame({ level, onDone, seconds = 60 }: { level: number; onDone: (r: GymRoundResult) => void; seconds?: number }) {
  const rng = useSeededRng("arithmetic");
  const [stair, setStair] = useState(() => createStaircase(level, 1, 10));
  const [item, setItem] = useState(() => generateArithmetic(rng, level));
  const [value, setValue] = useState("");
  const [started, setStarted] = useState<number | null>(null);
  const [left, setLeft] = useState(seconds);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const [shown, setShown] = useState({ correct: 0, answered: 0 });
  const stats = useRef({ correct: 0, answered: 0, run: 0, bestRun: 0, maxLevel: level });
  const finished = useRef(false);

  useEffect(() => {
    if (started === null) return;
    const t = window.setInterval(() => {
      const rest = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(rest);
      if (rest === 0 && !finished.current) {
        finished.current = true;
        window.clearInterval(t);
        const s = stats.current;
        onDone({
          game: "arithmetic",
          domain: "calculo",
          level: stair.level,
          nextLevel: stair.level,
          score: s.correct,
          summary: `${s.correct} de ${s.answered} bien en ${seconds} s; llegaste al nivel ${s.maxLevel}.`,
          bests: [
            { key: "best:gym-arithmetic-run", value: s.bestRun, direction: "higher", label: "Cálculos seguidos sin error" },
            { key: "best:gym-arithmetic", value: s.correct, direction: "higher", label: `Cálculos correctos en ${seconds} s` },
          ].filter((b) => b.value > 0) as RecordCandidate[],
        });
      }
    }, 200);
    return () => window.clearInterval(t);
  }, [onDone, seconds, stair.level, started]);

  const submit = () => {
    if (started === null || finished.current || !value.trim()) return;
    const ok = Number(value.replace(",", ".")) === item.answer;
    const s = stats.current;
    s.answered++;
    if (ok) {
      s.correct++;
      s.run++;
      s.bestRun = Math.max(s.bestRun, s.run);
    } else s.run = 0;
    const next = stepStaircase(stair, ok);
    s.maxLevel = Math.max(s.maxLevel, next.level);
    setStair(next);
    setItem(generateArithmetic(rng, next.level));
    setValue("");
    setFlash(ok ? "ok" : "bad");
    setShown({ correct: s.correct, answered: s.answered });
  };

  if (started === null) {
    return (
      <div className="grid justify-items-center gap-4">
        <p className="text-ink-2">{seconds} segundos. Escribe el resultado y pulsa Enter. Nivel inicial {level}.</p>
        <Button size="lg" onClick={() => setStarted(Date.now())} autoFocus>
          Empezar
        </Button>
      </div>
    );
  }
  return (
    <div className="grid justify-items-center gap-4">
      <p className="font-mono text-sm text-muted-foreground tabular-nums">
        {left} s · nivel {stair.level} · {shown.correct} bien
      </p>
      <p key={shown.answered} className={cn("font-mono text-5xl font-semibold tabular-nums", flash === "bad" && "fx-wrong", flash === "ok" && "fx-right")}>
        {item.prompt}
      </p>
      <input
        aria-label="Resultado"
        autoFocus
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        className="h-14 w-48 rounded-md border border-input bg-surface px-3 text-center font-mono text-3xl"
      />
    </div>
  );
}

// ---------------------------------------------------------------- secuencias
export function SequencesGame({ level, onDone, items = 6 }: { level: number; onDone: (r: GymRoundResult) => void; items?: number }) {
  const rng = useSeededRng("sequences");
  const [stair, setStair] = useState(() => createStaircase(level, 1, SEQUENCE_MAX_LEVEL));
  const [item, setItem] = useState(() => generateSequence(rng, level));
  const [value, setValue] = useState("");
  const [count, setCount] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean; rule: string; answer: number } | null>(null);
  const stats = useRef({ correct: 0, bestLevel: 0 });
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (feedback) nextRef.current?.focus();
  }, [feedback]);

  const submit = () => {
    if (feedback || !value.trim()) return;
    const ok = Number(value) === item.answer;
    if (ok) {
      stats.current.correct++;
      stats.current.bestLevel = Math.max(stats.current.bestLevel, item.level);
    }
    setStair((s) => stepStaircase(s, ok));
    setFeedback({ ok, rule: item.rule, answer: item.answer });
  };

  const next = () => {
    const c = count + 1;
    if (c >= items) {
      const s = stats.current;
      onDone({
        game: "sequences",
        domain: "logica",
        level: stair.level,
        nextLevel: stair.level,
        score: s.correct / items,
        summary: `${s.correct} de ${items} secuencias resueltas; nivel máximo resuelto ${s.bestLevel || "—"}.`,
        bests: s.bestLevel ? [{ key: "best:gym-sequences", value: s.bestLevel, direction: "higher", label: "Nivel de secuencias resuelto" }] : [],
      });
      return;
    }
    setCount(c);
    setItem(generateSequence(rng, stair.level));
    setValue("");
    setFeedback(null);
  };

  return (
    <div className="grid justify-items-center gap-4">
      <p className="font-mono text-sm text-muted-foreground">
        {count + 1}/{items} · nivel {item.level}
      </p>
      <p className="font-mono text-3xl font-semibold tabular-nums sm:text-4xl">{item.terms.join(", ")}, ?</p>
      <input
        aria-label="Siguiente término"
        autoFocus
        inputMode="numeric"
        autoComplete="off"
        disabled={!!feedback}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        className="h-14 w-48 rounded-md border border-input bg-surface px-3 text-center font-mono text-3xl"
      />
      {feedback ? (
        <div aria-live="polite" className="grid justify-items-center gap-3">
          <p className={feedback.ok ? "text-brand" : "text-danger"}>
            {feedback.ok ? "¡Bien!" : `Era ${feedback.answer}.`} Regla: {feedback.rule}.
          </p>
          <Button ref={nextRef} onClick={next}>
            {count + 1 >= items ? "Terminar" : "Siguiente"}
          </Button>
        </div>
      ) : (
        <Button onClick={submit}>Comprobar</Button>
      )}
    </div>
  );
}

export function GymGameView({ game, level, onDone }: { game: GymGame; level: number; onDone: (r: GymRoundResult) => void }) {
  if (game === "nback") return <NbackGame level={level} onDone={onDone} />;
  if (game === "arithmetic") return <ArithmeticGame level={level} onDone={onDone} seconds={CONFIG.gym.roundSeconds > 60 ? 60 : CONFIG.gym.roundSeconds} />;
  return <SequencesGame level={level} onDone={onDone} />;
}
