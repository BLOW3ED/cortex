"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { codeModule, debugModule, parsonsModule, traceModule } from "@/components/code/code-types";
import { type ComponentType, Fragment, useEffect, useRef } from "react";
import type { CatalogExercise } from "@/content/core/study-catalog";
import { splitBlanks } from "@/content/core/blanks";
import type { Answer } from "@/engine/answers/check";
import { createRng, seedFrom, shuffle } from "@/engine/rng";
import { cn } from "@/lib/utils";
import { MathField } from "./math-field";
import { RichText } from "./rich-text";

/**
 * Un módulo por tipo de ejercicio: borrador inicial, componente de entrada y cómo se convierte
 * el borrador en una `Answer` para el verificador. La Fase 2 agrega los de código aquí mismo.
 */

export interface InputProps<D> {
  readonly exercise: CatalogExercise;
  readonly draft: D;
  readonly setDraft: (d: D) => void;
  readonly disabled: boolean;
  /** Enviar (Enter en un campo de una línea). */
  readonly onEnter: () => void;
}

export interface TypeModule<D> {
  initial(ex: CatalogExercise, seed: number): D;
  readonly Input: ComponentType<InputProps<D>>;
  /** `string` = mensaje de por qué todavía no se puede enviar. */
  toAnswer(ex: CatalogExercise, d: D): Answer | string | Promise<Answer | string>;
  /** Texto que se guarda en el intento (para el cuaderno de errores). */
  describe(ex: CatalogExercise, d: D): string;
}

const inputClass = "h-11 w-full rounded-md border border-input bg-surface px-3 font-mono text-base";

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable || el.tagName === "MATH-FIELD");
}

// ---------------------------------------------------------------- opción múltiple
const LETTERS = "ABCDEFGH";

function ChoiceInput({ exercise, draft, setDraft, disabled }: InputProps<number | null>) {
  const ex = exercise as Extract<CatalogExercise, { tipo: "opcion_multiple" }>;
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const i = LETTERS.indexOf(e.key.toUpperCase());
      if (i >= 0 && i < ex.opciones.length) {
        e.preventDefault();
        setDraft(i);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, ex.opciones.length, setDraft]);
  return (
    <div role="radiogroup" aria-label="Opciones" className="grid gap-2">
      {ex.opciones.map((o, i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={draft === i}
          disabled={disabled}
          onClick={() => setDraft(i)}
          className={cn(
            "flex items-center gap-3 rounded-md border-2 bg-surface px-3 py-2.5 text-left hover:border-brand disabled:opacity-80",
            draft === i ? "border-brand bg-surface-2" : "border-border-strong",
          )}
        >
          <span className="kbd" aria-hidden>
            {LETTERS[i]}
          </span>
          <RichText text={o} inline />
        </button>
      ))}
    </div>
  );
}

const choice: TypeModule<number | null> = {
  initial: () => null,
  Input: ChoiceInput,
  toAnswer: (_ex, d) => (d === null ? "Elige una opción (teclas A, B, C...)." : { kind: "choice", index: d }),
  describe: (ex, d) => (ex.tipo === "opcion_multiple" && d !== null ? (ex.opciones[d] ?? String(d)) : ""),
};

// ---------------------------------------------------------------- numérico y salida
function NumericInput({ draft, setDraft, disabled, onEnter }: InputProps<string>) {
  return (
    <input
      aria-label="Tu respuesta"
      autoFocus
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter();
        }
      }}
      className={inputClass}
      placeholder="Número, fracción (1/3) o expresión (sqrt(2)/2)"
    />
  );
}

const numeric: TypeModule<string> = {
  initial: () => "",
  Input: NumericInput,
  toAnswer: (_ex, d) => (d.trim() ? { kind: "text", value: d } : "Escribe tu respuesta."),
  describe: (_ex, d) => d,
};

function SymbolicInput({ draft, setDraft, disabled, onEnter }: InputProps<string>) {
  return <MathField label="Tu expresión" value={draft} onChange={setDraft} onEnter={onEnter} disabled={disabled} />;
}

const symbolic: TypeModule<string> = { ...numeric, Input: SymbolicInput };

function OutputInput({ exercise, draft, setDraft, disabled, onEnter }: InputProps<string>) {
  const ex = exercise as Extract<CatalogExercise, { tipo: "predecir_salida" }>;
  return (
    <div className="grid gap-3">
      <pre className="code-view" aria-label={`Código en ${ex.lenguaje}`}>
        {ex.codigo.replace(/\n$/, "")}
      </pre>
      <label className="grid gap-1.5">
        <span className="console-label">Salida exacta (una línea por renglón)</span>
        <textarea
          aria-label="Salida exacta"
          autoFocus
          disabled={disabled}
          value={draft}
          spellCheck={false}
          rows={Math.max(2, Math.min(8, draft.split("\n").length + 1))}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onEnter();
            }
          }}
          className="w-full rounded-md border border-input bg-surface px-3 py-2 font-mono text-base"
        />
        <span className="text-xs text-muted-foreground">
          <span className="kbd">Ctrl</span> + <span className="kbd">Enter</span> para comprobar
        </span>
      </label>
    </div>
  );
}

const output: TypeModule<string> = { ...numeric, Input: OutputInput };

// ---------------------------------------------------------------- completar
function BlanksInput({ exercise, draft, setDraft, disabled, onEnter }: InputProps<string[]>) {
  const ex = exercise as Extract<CatalogExercise, { tipo: "completar" }>;
  const parts = splitBlanks(ex.texto);
  return (
    <p className="rich text-lg leading-[2.4]">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part ? <RichText text={part} inline /> : null}
          {i < parts.length - 1 ? (
            <input
              aria-label={`Hueco ${i + 1} de ${parts.length - 1}`}
              autoFocus={i === 0}
              disabled={disabled}
              value={draft[i] ?? ""}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setDraft(draft.map((v, j) => (j === i ? e.target.value : v)))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onEnter();
                }
              }}
              style={{ width: `${Math.max(5, (draft[i] ?? "").length + 2)}ch` }}
              className="mx-1 inline-block h-9 rounded-sm border-b-2 border-dashed border-xp bg-surface-2 px-2 align-baseline font-mono text-base"
            />
          ) : null}
        </Fragment>
      ))}
    </p>
  );
}

const blanks: TypeModule<string[]> = {
  initial: (ex) => (ex.tipo === "completar" ? ex.respuestas.map(() => "") : []),
  Input: BlanksInput,
  toAnswer: (_ex, d) => (d.some((v) => !v.trim()) ? "Llena todos los huecos." : { kind: "blanks", values: d }),
  describe: (_ex, d) => d.join(" · "),
};

// ---------------------------------------------------------------- ordenar
function OrderInput({ draft, setDraft, disabled }: InputProps<string[]>) {
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= draft.length) return;
    const next = [...draft];
    [next[i], next[j]] = [next[j] as string, next[i] as string];
    setDraft(next);
    requestAnimationFrame(() => refs.current[j]?.focus());
  };
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        Enfoca un paso y usa <span className="kbd">Alt</span> + <span className="kbd">↑</span>/<span className="kbd">↓</span>, o los botones.
      </p>
      <ol className="grid gap-2" aria-label="Pasos en tu orden">
        {draft.map((item, i) => (
          <li
            key={item}
            ref={(el) => {
              refs.current[i] = el;
            }}
            tabIndex={disabled ? -1 : 0}
            aria-label={`Paso ${i + 1}`}
            onKeyDown={(e) => {
              if (disabled || !e.altKey) return;
              if (e.key === "ArrowUp") {
                e.preventDefault();
                move(i, -1);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                move(i, 1);
              }
            }}
            className="flex items-center gap-3 rounded-md border-2 border-border-strong bg-surface px-3 py-2"
          >
            <span className="font-mono text-sm text-xp-text tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <RichText text={item} inline />
            </span>
            <span className="flex gap-1">
              <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label={`Subir paso ${i + 1}`} className="rounded-sm p-1 hover:bg-surface-2 disabled:opacity-30">
                <ArrowUp className="size-4" aria-hidden />
              </button>
              <button type="button" disabled={disabled || i === draft.length - 1} onClick={() => move(i, 1)} aria-label={`Bajar paso ${i + 1}`} className="rounded-sm p-1 hover:bg-surface-2 disabled:opacity-30">
                <ArrowDown className="size-4" aria-hidden />
              </button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Baraja con semilla; si por azar queda en el orden correcto, rota uno. */
export function shuffledOrder(items: readonly string[], seed: number): string[] {
  const out = shuffle(createRng(seed), items);
  if (out.length > 1 && out.every((x, i) => x === items[i])) out.push(out.shift() as string);
  return out;
}

const order: TypeModule<string[]> = {
  initial: (ex, seed) => (ex.tipo === "ordenar" ? shuffledOrder(ex.elementos, seed ^ seedFrom(ex.id)) : []),
  Input: OrderInput,
  toAnswer: (_ex, d) => ({ kind: "order", items: d }),
  describe: (_ex, d) => d.join(" → "),
};

// ---------------------------------------------------------------- autoevaluación
export interface SelfDraft {
  readonly text: string;
  readonly met: readonly boolean[];
}

function SelfInput({ draft, setDraft, disabled, onEnter }: InputProps<SelfDraft>) {
  return (
    <label className="grid gap-1.5">
      <span className="console-label">Tu explicación (con tus palabras)</span>
      <textarea
        autoFocus
        disabled={disabled}
        value={draft.text}
        rows={5}
        onChange={(e) => setDraft({ ...draft, text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onEnter();
          }
        }}
        className="w-full rounded-md border border-input bg-surface px-3 py-2 text-base"
      />
      <span className="text-xs text-muted-foreground">
        Después compararás con una respuesta modelo y una rúbrica. <span className="kbd">Ctrl</span> + <span className="kbd">Enter</span>
      </span>
    </label>
  );
}

const self: TypeModule<SelfDraft> = {
  initial: (ex) => ({ text: "", met: ex.tipo === "autoevaluacion" ? ex.rubrica.map(() => false) : [] }),
  Input: SelfInput,
  toAnswer: (_ex, d) => (d.text.trim() ? { kind: "self", text: d.text, met: d.met } : "Escribe tu explicación antes de compararla."),
  describe: (_ex, d) => d.text,
};

/** Un módulo por tipo de ejercicio (los de código, de la Fase 2, viven en `components/code`). */
export const TYPE_MODULES: Record<string, TypeModule<never>> = {
  codigo: codeModule as unknown as TypeModule<never>,
  depurar: debugModule as unknown as TypeModule<never>,
  parsons: parsonsModule as unknown as TypeModule<never>,
  rastreo_memoria: traceModule as unknown as TypeModule<never>,
  opcion_multiple: choice as unknown as TypeModule<never>,
  numerico: numeric as unknown as TypeModule<never>,
  simbolico: symbolic as unknown as TypeModule<never>,
  completar: blanks as unknown as TypeModule<never>,
  ordenar: order as unknown as TypeModule<never>,
  predecir_salida: output as unknown as TypeModule<never>,
  autoevaluacion: self as unknown as TypeModule<never>,
};

/** ¿La app ya sabe jugar este tipo de ejercicio? Los que no, se omiten de práctica, repaso y jefes. */
export function isPlayable(ex: { tipo: string }): boolean {
  return ex.tipo in TYPE_MODULES;
}
