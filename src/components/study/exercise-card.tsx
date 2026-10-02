"use client";

import { CheckCircle2, CircleHelp, Lightbulb, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CatalogExercise } from "@/content/core/study-catalog";
import { type Answer, checkAnswer, type CheckResult } from "@/engine/answers/check";
import type { XpBreakdown, Confidence } from "@/engine/xp";
import { cn } from "@/lib/utils";
import { ConfidencePicker } from "./confidence-picker";
import { TYPE_MODULES, type SelfDraft } from "./exercise-types";
import { ReportButton } from "./report-button";
import { RichText } from "./rich-text";

/**
 * Un ejercicio de punta a punta (teclado primero, docs/02): responder → marcar confianza →
 * ver resultado y explicación → siguiente. `Enter` comprueba, `1/2/3` confianza, `H` pista,
 * `N` siguiente.
 */

export interface ExerciseResult {
  readonly correct: boolean;
  readonly answer: string;
  readonly timeMs: number;
  readonly confidence: Confidence | null;
  readonly hintsUsed: number;
}

export interface AfterAnswer {
  readonly xp?: XpBreakdown;
  /** Texto extra bajo el resultado (p. ej. "vuelve en 3 días"). */
  readonly note?: string;
}

type Phase =
  | { readonly kind: "answering"; readonly error: string | null }
  | { readonly kind: "confidence"; readonly answer: Answer; readonly result: CheckResult; readonly timeMs: number }
  | { readonly kind: "self-grade"; readonly answer: Answer; readonly timeMs: number; readonly confidence: Confidence }
  | { readonly kind: "saving" }
  | { readonly kind: "feedback"; readonly correct: boolean; readonly expected: string | null; readonly confidence: Confidence | null; readonly after: AfterAnswer | null; readonly error: string | null };

const TYPE_LABELS: Record<string, string> = {
  opcion_multiple: "Opción múltiple",
  numerico: "Numérico",
  simbolico: "Expresión",
  completar: "Completa",
  ordenar: "Ordena",
  predecir_salida: "Predice la salida",
  autoevaluacion: "Explica",
  codigo: "Código",
  depurar: "Debug Dojo",
  parsons: "Parsons",
  rastreo_memoria: "Rastreo de memoria",
};

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable || el.tagName === "MATH-FIELD");
}

export function ExerciseCard({
  exercise,
  onAnswered,
  onNext,
  allowHints = true,
  askConfidence = true,
  header,
  nextLabel = "Siguiente",
  seed = 1,
}: {
  exercise: CatalogExercise;
  /** Guarda el resultado; lo que regresa se muestra en la retroalimentación. */
  onAnswered: (r: ExerciseResult) => Promise<AfterAnswer | void> | AfterAnswer | void;
  onNext: () => void;
  allowHints?: boolean;
  askConfidence?: boolean;
  header?: React.ReactNode;
  nextLabel?: string;
  seed?: number;
}) {
  const mod = TYPE_MODULES[exercise.tipo];
  const [draft, setDraft] = useState<unknown>(() => mod?.initial(exercise, seed));
  const [phase, setPhase] = useState<Phase>({ kind: "answering", error: null });
  const [hints, setHints] = useState(0);
  // Se reinicia al montar: cada ejercicio usa su propia tarjeta (`key` = id del ejercicio).
  const started = useRef(0);
  useEffect(() => {
    started.current = performance.now();
  }, []);
  const nextRef = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const pistas = useMemo(() => exercise.pistas ?? [], [exercise.pistas]);

  const finish = useCallback(
    async (answer: Answer, result: CheckResult, timeMs: number, confidence: Confidence | null) => {
      if (!mod) return;
      const correct = result.status === "correct";
      setPhase({ kind: "saving" });
      let after: AfterAnswer | null = null;
      let error: string | null = null;
      try {
        after = (await onAnswered({ correct, answer: mod.describe(exercise, draft as never), timeMs, confidence, hintsUsed: hints })) ?? null;
      } catch (e) {
        error = e instanceof Error ? e.message : "No se pudo guardar tu respuesta.";
      }
      setPhase({
        kind: "feedback",
        correct,
        expected: result.status === "wrong" ? result.expected : null,
        confidence,
        after,
        error,
      });
      void answer;
    },
    [exercise, draft, hints, mod, onAnswered],
  );

  const submit = useCallback(async () => {
    if (!mod || phase.kind !== "answering" || submitting.current) return;
    submitting.current = true;
    try {
      const timeMs = performance.now() - started.current;
      const answer = await mod.toAnswer(exercise, draft as never);
      if (typeof answer === "string") {
        setPhase({ kind: "answering", error: answer });
        return;
      }
      // Autoevaluación: la rúbrica se marca después de ver la respuesta modelo.
      const result = exercise.tipo === "autoevaluacion" ? ({ status: "correct" } as CheckResult) : checkAnswer(exercise, answer);
      if (result.status === "invalid") {
        setPhase({ kind: "answering", error: result.message });
        return;
      }
      if (askConfidence) setPhase({ kind: "confidence", answer, result, timeMs });
      else if (exercise.tipo === "autoevaluacion") setPhase({ kind: "self-grade", answer, timeMs, confidence: 2 });
      else await finish(answer, result, timeMs, null);
    } finally {
      submitting.current = false;
    }
  }, [askConfidence, draft, exercise, finish, mod, phase.kind]);

  const pickConfidence = useCallback(
    (c: Confidence) => {
      if (phase.kind !== "confidence") return;
      if (exercise.tipo === "autoevaluacion") setPhase({ kind: "self-grade", answer: phase.answer, timeMs: phase.timeMs, confidence: c });
      else void finish(phase.answer, phase.result, phase.timeMs, c);
    },
    [exercise.tipo, finish, phase],
  );
  const cancelConfidence = useCallback(() => setPhase({ kind: "answering", error: null }), []);

  // Atajos globales: H pista, N o Enter siguiente.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (phase.kind === "feedback" && (e.key === "n" || e.key === "N" || (e.key === "Enter" && !isTyping(e.target)))) {
        e.preventDefault();
        onNext();
      } else if (phase.kind === "answering" && (e.key === "h" || e.key === "H") && !isTyping(e.target) && allowHints && hints < pistas.length) {
        e.preventDefault();
        setHints((h) => h + 1);
      } else if (phase.kind === "answering" && e.key === "Enter" && !isTyping(e.target)) {
        e.preventDefault();
        void submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [allowHints, hints, onNext, phase.kind, pistas.length, submit]);

  useEffect(() => {
    if (phase.kind === "feedback") nextRef.current?.focus();
  }, [phase.kind]);

  if (!mod) {
    return (
      <div role="alert" className="rounded-lg border border-warning p-4 text-warning">
        Este tipo de ejercicio («{exercise.tipo}») todavía no se puede jugar aquí.
        <div className="mt-3">
          <Button onClick={onNext}>{nextLabel}</Button>
        </div>
      </div>
    );
  }

  const Input = mod.Input as unknown as React.ComponentType<{ exercise: CatalogExercise; draft: unknown; setDraft: (d: unknown) => void; disabled: boolean; onEnter: () => void }>;
  const answering = phase.kind === "answering";

  return (
    <article
      aria-label={`Ejercicio ${exercise.id}`}
      className={cn(
        "rounded-xl border-2 bg-surface p-5 sm:p-6",
        phase.kind === "feedback" ? (phase.correct ? "fx-right border-brand" : "fx-wrong border-danger") : "border-border-strong",
      )}
    >
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="console-label">{TYPE_LABELS[exercise.tipo] ?? exercise.tipo}</span>
        <span className="font-mono text-xs text-muted-foreground" aria-label={`Dificultad ${exercise.dificultad} de 5`}>
          {"■".repeat(exercise.dificultad)}
          <span className="opacity-30">{"■".repeat(5 - exercise.dificultad)}</span>
        </span>
        <span className="ml-auto">{header}</span>
      </header>

      <RichText text={exercise.enunciado} className="text-lg" />

      <div className="mt-5">
        <Input exercise={exercise} draft={draft} setDraft={setDraft} disabled={!answering} onEnter={() => void submit()} />
      </div>

      {allowHints && hints > 0 ? (
        <ol className="mt-4 grid gap-2" aria-label="Pistas">
          {pistas.slice(0, hints).map((p, i) => (
            <li key={i} className="flex gap-2 rounded-md border border-dashed border-xp bg-surface-2 p-3 text-sm">
              <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-xp-text" />
              <RichText text={p} />
            </li>
          ))}
        </ol>
      ) : null}

      {answering ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={() => void submit()}>
            Comprobar <span className="kbd border-current/40 text-current">⏎</span>
          </Button>
          {allowHints && hints < pistas.length ? (
            <Button variant="outline" onClick={() => setHints((h) => h + 1)}>
              <Lightbulb aria-hidden /> Pista ({pistas.length - hints}) <span className="kbd">H</span>
            </Button>
          ) : null}
          {phase.error ? (
            <p role="alert" className="text-sm text-warning">
              {phase.error}
            </p>
          ) : null}
        </div>
      ) : null}

      {phase.kind === "confidence" ? (
        <div className="mt-5">
          <ConfidencePicker onPick={pickConfidence} onCancel={cancelConfidence} />
        </div>
      ) : null}

      {phase.kind === "self-grade" && exercise.tipo === "autoevaluacion" ? (
        <SelfGrade
          exercise={exercise}
          draft={draft as SelfDraft}
          onDone={(met) => {
            const answer: Answer = { kind: "self", text: (draft as SelfDraft).text, met };
            setDraft({ ...(draft as SelfDraft), met });
            void finish(answer, checkAnswer(exercise, answer), phase.timeMs, phase.confidence);
          }}
        />
      ) : null}

      {phase.kind === "saving" ? <p className="mt-5 text-sm text-muted-foreground">Guardando…</p> : null}

      {phase.kind === "feedback" ? (
        <section aria-live="polite" className="mt-6 border-t pt-5">
          <p className={cn("flex items-center gap-2 text-lg font-semibold", phase.correct ? "text-brand" : "text-danger")}>
            {phase.correct ? <CheckCircle2 aria-hidden /> : <XCircle aria-hidden />}
            {phase.correct ? "¡Correcto!" : "No es correcto."}
            {phase.after?.xp && phase.after.xp.total > 0 ? <span className="ml-1 font-mono text-base text-xp-text">+{phase.after.xp.total} XP</span> : null}
          </p>
          {!phase.correct && phase.expected && exercise.tipo !== "autoevaluacion" ? (
            <div className="mt-2 text-sm">
              <span className="text-muted-foreground">Respuesta esperada: </span>
              {exercise.tipo === "predecir_salida" || exercise.tipo === "codigo" ? (
                <pre className="code-view mt-1">{phase.expected}</pre>
              ) : (
                <RichText text={exercise.tipo === "simbolico" || exercise.tipo === "numerico" ? `\`${phase.expected}\`` : phase.expected} inline />
              )}
            </div>
          ) : null}
          {!phase.correct && phase.confidence === 3 ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-warning">
              <CircleHelp aria-hidden className="size-4" /> Lo marcaste como seguro: queda como «ilusión de saber» y se repasa primero.
            </p>
          ) : null}
          {phase.after?.note ? <p className="mt-2 text-sm text-muted-foreground">{phase.after.note}</p> : null}
          {phase.error ? (
            <p role="alert" className="mt-2 text-sm text-warning">
              {phase.error}
            </p>
          ) : null}
          <div className="mt-4 rounded-md bg-surface-2 p-4">
            <p className="console-label mb-1">Explicación</p>
            <RichText text={exercise.explicacion} />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button ref={nextRef} onClick={onNext}>
              {nextLabel} <span className="kbd border-current/40 text-current">N</span>
            </Button>
            <ReportButton exerciseId={exercise.id} />
          </div>
        </section>
      ) : answering ? (
        <div className="mt-4">
          <ReportButton exerciseId={exercise.id} subtle />
        </div>
      ) : null}
    </article>
  );
}

function SelfGrade({
  exercise,
  draft,
  onDone,
}: {
  exercise: Extract<CatalogExercise, { tipo: "autoevaluacion" }>;
  draft: SelfDraft;
  onDone: (met: boolean[]) => void;
}) {
  const [met, setMet] = useState<boolean[]>(() => exercise.rubrica.map((_, i) => draft.met[i] ?? false));
  return (
    <section className="mt-5 grid gap-4 rounded-lg border border-border-strong p-4">
      <div>
        <p className="console-label mb-1">Respuesta modelo</p>
        <RichText text={exercise.respuesta_modelo} />
      </div>
      <fieldset>
        <legend className="console-label mb-2">Marca lo que tu explicación sí incluyó</legend>
        <ul className="grid gap-2">
          {exercise.rubrica.map((r, i) => (
            <li key={i}>
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1.5 size-4 accent-[var(--brand)]" checked={met[i] ?? false} onChange={(e) => setMet(met.map((m, j) => (j === i ? e.target.checked : m)))} />
                <RichText text={r} inline />
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div>
        <Button onClick={() => onDone(met)}>Calificar</Button>
      </div>
    </section>
  );
}
