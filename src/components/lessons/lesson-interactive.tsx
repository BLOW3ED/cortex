"use client";

import { Check, X } from "lucide-react";
import { Fragment, type ReactNode, useId, useState } from "react";
import { blankMatches } from "@/engine/answers/text";
import { cn } from "@/lib/utils";

/**
 * Partes interactivas de la lección (Fase 1). El texto llega ya dibujado desde el servidor
 * (Markdown + KaTeX); aquí solo vive el estado: escribir la predicción y llenar los huecos.
 */

/** `<Predice>`: primero escribes tu predicción (recuperar antes de leer, docs/04); luego ves la idea. */
export function PredictInteractive({ reveal }: { reveal: ReactNode | null }) {
  const id = useId();
  const [text, setText] = useState("");
  const [shown, setShown] = useState(false);
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="sr-only">
        Tu predicción
      </label>
      <textarea
        id={id}
        rows={2}
        value={text}
        disabled={shown}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escribe tu predicción antes de seguir…"
        className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-base"
      />
      {reveal ? (
        shown ? (
          <div className="rounded-md border border-dashed border-brand p-3" aria-live="polite">
            {reveal}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShown(true)}
              className="arcade rounded-md border-2 border-[var(--shadow-color)] bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
            >
              {text.trim() ? "Comparar con la idea" : "No sé: muéstrame la idea"}
            </button>
            <span className="text-xs text-muted-foreground">Intentarlo primero (aunque falles) ayuda a recordar.</span>
          </div>
        )
      ) : null}
    </div>
  );
}

/** `<Desvanecido>`: cada paso con huecos; comparas y ves las respuestas. */
export function FadedInteractive({
  steps,
  answers,
  rendered,
}: {
  /** Tramos de texto de cada paso, ya dibujados (los huecos van entre tramos). */
  steps: ReactNode[][];
  /** Respuestas esperadas, en orden (texto plano para comparar). */
  answers: string[];
  /** Respuestas dibujadas para mostrarlas. */
  rendered: ReactNode[];
}) {
  const [values, setValues] = useState<string[]>(() => answers.map(() => ""));
  const [checked, setChecked] = useState(false);
  let blank = 0;
  return (
    <div className="grid gap-3">
      <ol className="lesson-steps">
        {steps.map((parts, i) => (
          <li key={i} className="leading-[2.2]">
            {parts.map((part, j) => {
              const k = j < parts.length - 1 ? blank++ : -1;
              const ok = k >= 0 && checked ? blankMatches(values[k] ?? "", answers[k] ?? "") : null;
              return (
                <Fragment key={j}>
                  {part}
                  {k >= 0 ? (
                    <span className="inline-flex items-center gap-1 align-baseline">
                      <input
                        aria-label={`Hueco ${k + 1}`}
                        value={values[k] ?? ""}
                        disabled={checked}
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(e) => setValues(values.map((v, x) => (x === k ? e.target.value : v)))}
                        style={{ width: `${Math.max(4, (values[k] ?? "").length + 2)}ch` }}
                        className={cn(
                          "mx-1 h-8 rounded-sm border-b-2 border-dashed bg-surface-2 px-1.5 font-mono text-sm",
                          ok === null ? "border-xp" : ok ? "border-brand" : "border-danger",
                        )}
                      />
                      {ok === null ? null : ok ? <Check aria-label="correcto" className="size-4 text-brand" /> : <X aria-label="incorrecto" className="size-4 text-danger" />}
                    </span>
                  ) : null}
                </Fragment>
              );
            })}
          </li>
        ))}
      </ol>
      {answers.length ? (
        checked ? (
          <div className="rounded-md bg-surface-2 p-3 text-sm" aria-live="polite">
            <p className="font-mono text-xs text-muted-foreground">Respuestas</p>
            <ol className="lesson-steps">
              {rendered.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ol>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setChecked(true)}
              className="arcade rounded-md border-2 border-[var(--shadow-color)] bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
            >
              Comprobar
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}
