"use client";

import { ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, CircleX, IndentDecrease, IndentIncrease, Play, RotateCcw, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { InputProps, TypeModule } from "@/components/study/exercise-types";
import { RichText } from "@/components/study/rich-text";
import { Button } from "@/components/ui/button";
import type { CatalogExercise } from "@/content/core/study-catalog";
import type { CTest, PythonTest, TraceCell } from "@/content/schema";
import type { Answer } from "@/engine/answers/check";
import { blankMatches } from "@/engine/answers/text";
import { createRng, seedFrom, shuffle } from "@/engine/rng";
import { pythonLoaded, warmPython } from "@/runners/python-client";
import { cn } from "@/lib/utils";
import { CodeEditor } from "./code-editor";
import { runCodeTests, type TestRun } from "./run-tests";

/**
 * Tipos de ejercicio de la Fase 2. Cada módulo guarda en su borrador el código y el último
 * resultado de "Probar"; "Comprobar" vuelve a correr las pruebas y califica.
 */

type Lang = "python" | "c";
type Ex<T extends string> = Extract<CatalogExercise, { tipo: T }>;

// ---------------------------------------------------------------- piezas comunes
function useWarmPython(language: Lang) {
  useEffect(() => {
    if (language === "python") void warmPython().catch(() => undefined);
  }, [language]);
}

function TestList({ tests, language }: { tests: readonly (PythonTest | CTest)[]; language: Lang }) {
  const visible = tests.map((t, i) => ({ t, i })).filter(({ t }) => !t.oculto);
  const hidden = tests.length - visible.length;
  return (
    <details className="rounded-md border bg-surface-2 p-3 text-sm" open>
      <summary className="cursor-pointer font-mono text-xs text-muted-foreground">
        Pruebas: {visible.length} visibles{hidden ? ` + ${hidden} ocultas` : ""}
      </summary>
      <ul className="mt-2 grid gap-1 font-mono text-xs">
        {visible.map(({ t, i }) => (
          <li key={i}>
            {language === "python" ? (
              <>
                <code>{(t as PythonTest).expr}</code> → <code>{JSON.stringify((t as PythonTest).esperado)}</code>
              </>
            ) : (
              <>
                entrada <code>{JSON.stringify((t as CTest).entrada ?? "")}</code> → salida <code>{JSON.stringify((t as CTest).salida)}</code>
              </>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Results({ run }: { run: TestRun | null }) {
  if (!run) return null;
  if (run.status === "unavailable") {
    return (
      <p role="alert" className="rounded-md border border-warning p-3 text-sm text-warning">
        {run.message}
      </p>
    );
  }
  const g = run.grade;
  return (
    <div aria-live="polite" className="grid gap-2 rounded-md border p-3 text-sm">
      <p className={cn("flex items-center gap-2 font-semibold", g.passed ? "text-brand" : "text-danger")}>
        {g.passed ? <CheckCircle2 aria-hidden className="size-4" /> : <CircleX aria-hidden className="size-4" />}
        {g.ok}/{g.total} pruebas
      </p>
      {g.text.startsWith("Error:") ? <pre className="code-view text-danger">{g.text.split("\n").slice(0, g.text.split("\n").findIndex((l) => /^\d+\/\d+ pruebas$/.test(l))).join("\n")}</pre> : null}
      <ul className="grid gap-1 font-mono text-xs">
        {g.outcomes.map((o) => (
          <li key={o.index} className={o.passed ? "text-ink-2" : "text-danger"}>
            {o.passed ? "✓" : "✗"} {o.hidden ? `prueba oculta ${o.index + 1}` : `${o.label} → ${o.got}${o.passed ? "" : ` (esperado ${o.expected})`}`}
          </li>
        ))}
      </ul>
      {run.stdout ? (
        <details>
          <summary className="cursor-pointer font-mono text-xs text-muted-foreground">Salida de tu programa</summary>
          <pre className="code-view mt-1 text-xs">{run.stdout.slice(0, 4000)}</pre>
        </details>
      ) : null}
    </div>
  );
}

function RunButton({ running, onRun, language }: { running: boolean; onRun: () => void; language: Lang }) {
  return (
    <Button variant="secondary" onClick={onRun} disabled={running}>
      <Play aria-hidden /> {running ? (language === "python" && !pythonLoaded() ? "Cargando Python (solo la primera vez)…" : "Ejecutando…") : "Probar"}
      <span className="kbd">Ctrl ⏎</span>
    </Button>
  );
}

function asAnswer(run: TestRun, code: string, extra?: { passed: boolean; prefix: string }): Answer | string {
  if (run.status === "unavailable") return run.message;
  if (extra) return { kind: "steps", passed: extra.passed && run.grade.passed, summary: `${extra.prefix}\n${run.grade.text}` };
  return { kind: "code", code, passed: run.grade.passed, summary: run.grade.text };
}

// ---------------------------------------------------------------- código
interface CodeDraft {
  readonly code: string;
  readonly run: TestRun | null;
  readonly running: boolean;
}

function CodeInput({ exercise, draft, setDraft, disabled, onEnter }: InputProps<CodeDraft>) {
  const ex = exercise as Ex<"codigo">;
  useWarmPython(ex.lenguaje);
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  });
  const probe = async () => {
    setDraft({ ...latest.current, running: true });
    const run = await runCodeTests(ex.lenguaje, latest.current.code, ex.tests);
    setDraft({ ...latest.current, running: false, run });
  };
  return (
    <div className="grid gap-3">
      <CodeEditor
        label={`Tu código en ${ex.lenguaje === "c" ? "C" : "Python"}`}
        language={ex.lenguaje}
        value={draft.code}
        readOnly={disabled}
        onChange={(code) => setDraft({ ...latest.current, code, run: null })}
        onSubmit={onEnter}
        minLines={Math.min(14, Math.max(6, ex.plantilla.split("\n").length + 2))}
      />
      <TestList tests={ex.tests} language={ex.lenguaje} />
      {!disabled ? (
        <div className="flex flex-wrap gap-2">
          <RunButton running={draft.running} onRun={() => void probe()} language={ex.lenguaje} />
          <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, code: ex.plantilla, run: null })}>
            <RotateCcw aria-hidden /> Volver a la plantilla
          </Button>
        </div>
      ) : null}
      <Results run={draft.run} />
    </div>
  );
}

export const codeModule: TypeModule<CodeDraft> = {
  initial: (ex) => ({ code: ex.tipo === "codigo" ? ex.plantilla : "", run: null, running: false }),
  Input: CodeInput,
  toAnswer: async (ex, d) => {
    if (ex.tipo !== "codigo") return "Tipo inválido.";
    if (d.code.trim() === ex.plantilla.trim()) return "Escribe tu solución antes de comprobar (o usa Probar).";
    return asAnswer(await runCodeTests(ex.lenguaje, d.code, ex.tests), d.code);
  },
  describe: (_ex, d) => d.code,
};

// ---------------------------------------------------------------- Debug Dojo
interface DebugDraft extends CodeDraft {
  readonly picked: number | null;
}

const bugLinesOf = (ex: Ex<"depurar">) => (Array.isArray(ex.linea_bug) ? ex.linea_bug : [ex.linea_bug]);

function DebugInput({ exercise, draft, setDraft, disabled, onEnter }: InputProps<DebugDraft>) {
  const ex = exercise as Ex<"depurar">;
  useWarmPython(ex.lenguaje);
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  });
  const lines = ex.codigo.replace(/\n+$/, "").split("\n");
  const bugs = bugLinesOf(ex);
  if (draft.picked === null) {
    return (
      <div className="grid gap-2">
        <p className="console-label">Paso 1 · ¿En qué línea está el error? Haz clic en ella.</p>
        <ol className="code-view grid !whitespace-normal p-1" aria-label="Código con un error">
          {lines.map((l, i) => (
            <li key={i}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setDraft({ ...draft, picked: i + 1 })}
                aria-label={`Línea ${i + 1}: ${l.trim() || "(vacía)"}`}
                className="flex w-full gap-3 rounded-sm px-2 text-left hover:bg-surface-3 focus-visible:bg-surface-3"
              >
                <span className="w-6 shrink-0 text-right text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="whitespace-pre">{l || " "}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  const right = bugs.includes(draft.picked);
  const probe = async () => {
    setDraft({ ...latest.current, running: true });
    const run = await runCodeTests(ex.lenguaje, latest.current.code, ex.tests);
    setDraft({ ...latest.current, running: false, run });
  };
  return (
    <div className="grid gap-3">
      <p className={cn("text-sm", right ? "text-brand" : "text-warning")}>
        {right
          ? `Bien visto: el error está en la línea ${draft.picked}.`
          : `Elegiste la línea ${draft.picked}; el error está en la ${bugs.length > 1 ? "líneas" : "línea"} ${bugs.join(", ")}.`}{" "}
        Paso 2 · corrígelo y pasa las pruebas.
      </p>
      <CodeEditor
        label={`Código para corregir en ${ex.lenguaje === "c" ? "C" : "Python"}`}
        language={ex.lenguaje}
        value={draft.code}
        readOnly={disabled}
        onChange={(code) => setDraft({ ...latest.current, code, run: null })}
        onSubmit={onEnter}
        minLines={Math.min(14, lines.length + 1)}
      />
      <TestList tests={ex.tests} language={ex.lenguaje} />
      {!disabled ? <RunButton running={draft.running} onRun={() => void probe()} language={ex.lenguaje} /> : null}
      <Results run={draft.run} />
    </div>
  );
}

export const debugModule: TypeModule<DebugDraft> = {
  initial: (ex) => ({ code: ex.tipo === "depurar" ? ex.codigo : "", run: null, running: false, picked: null }),
  Input: DebugInput,
  toAnswer: async (ex, d) => {
    if (ex.tipo !== "depurar") return "Tipo inválido.";
    if (d.picked === null) return "Primero elige la línea con el error.";
    const lineOk = bugLinesOf(ex).includes(d.picked);
    const run = await runCodeTests(ex.lenguaje, d.code, ex.tests);
    return asAnswer(run, d.code, { passed: lineOk, prefix: lineOk ? `✓ Línea del error: ${d.picked}` : `✗ Elegiste la línea ${d.picked}; era la ${bugLinesOf(ex).join(", ")}` });
  },
  describe: (_ex, d) => `línea ${d.picked ?? "?"}\n${d.code}`,
};

// ---------------------------------------------------------------- Parsons
interface ParsonsItem {
  readonly key: number;
  readonly text: string;
  readonly indent: number;
}
interface ParsonsDraft {
  readonly pool: readonly ParsonsItem[];
  readonly placed: readonly ParsonsItem[];
  readonly run: TestRun | null;
}

const indentOf = (line: string) => Math.floor((line.length - line.trimStart().length) / 4);

function ParsonsInput({ exercise, draft, setDraft, disabled }: InputProps<ParsonsDraft>) {
  const ex = exercise as Ex<"parsons">;
  const python = ex.lenguaje === "python";
  const placedRefs = useRef<(HTMLLIElement | null)[]>([]);
  const update = (pool: readonly ParsonsItem[], placed: readonly ParsonsItem[], focus?: number) => {
    setDraft({ ...draft, pool, placed, run: null });
    if (focus !== undefined) requestAnimationFrame(() => placedRefs.current[focus]?.focus());
  };
  const place = (item: ParsonsItem) => update(draft.pool.filter((p) => p.key !== item.key), [...draft.placed, { ...item, indent: 0 }]);
  const unplace = (i: number) => {
    const item = draft.placed[i];
    if (!item) return;
    update([...draft.pool, item], draft.placed.filter((_, j) => j !== i));
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= draft.placed.length) return;
    const next = [...draft.placed];
    [next[i], next[j]] = [next[j] as ParsonsItem, next[i] as ParsonsItem];
    update(draft.pool, next, j);
  };
  const indent = (i: number, d: number) => {
    const next = draft.placed.map((p, j) => (j === i ? { ...p, indent: Math.max(0, Math.min(6, p.indent + d)) } : p));
    update(draft.pool, next, i);
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section aria-labelledby="parsons-pool">
        <h3 id="parsons-pool" className="console-label mb-2">
          Líneas disponibles {ex.distractores?.length ? "(alguna sobra)" : ""}
        </h3>
        <ul className="grid gap-1.5">
          {draft.pool.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => place(item)}
                className="w-full rounded-md border border-border-strong bg-surface-2 px-3 py-1.5 text-left font-mono text-sm whitespace-pre hover:border-brand"
              >
                {item.text}
              </button>
            </li>
          ))}
          {draft.pool.length === 0 ? <li className="text-sm text-muted-foreground">Ya usaste todas.</li> : null}
        </ul>
      </section>
      <section aria-labelledby="parsons-program">
        <h3 id="parsons-program" className="console-label mb-2">
          Tu programa {python ? "· Alt+←/→ sangría, Alt+↑/↓ mover, Supr quitar" : "· Alt+↑/↓ mover, Supr quitar"}
        </h3>
        <ol className="code-view grid gap-1 !whitespace-normal p-2" aria-label="Tu programa">
          {draft.placed.map((item, i) => (
            <li
              key={item.key}
              ref={(el) => {
                placedRefs.current[i] = el;
              }}
              tabIndex={disabled ? -1 : 0}
              aria-label={`Línea ${i + 1}${python ? `, sangría ${item.indent}` : ""}: ${item.text}`}
              onKeyDown={(e) => {
                if (disabled) return;
                const action =
                  e.altKey && e.key === "ArrowUp"
                    ? () => move(i, -1)
                    : e.altKey && e.key === "ArrowDown"
                      ? () => move(i, 1)
                      : python && e.altKey && e.key === "ArrowRight"
                        ? () => indent(i, 1)
                        : python && e.altKey && e.key === "ArrowLeft"
                          ? () => indent(i, -1)
                          : e.key === "Delete" || e.key === "Backspace"
                            ? () => unplace(i)
                            : null;
                if (action) {
                  e.preventDefault();
                  action();
                }
              }}
              className="flex items-center gap-1 rounded-sm bg-surface px-1"
            >
              <span className="min-w-0 flex-1 overflow-x-auto py-0.5 whitespace-pre" style={{ paddingLeft: `${item.indent * 2}ch` }}>
                {item.text}
              </span>
              {!disabled ? (
                <span className="flex shrink-0">
                  {python ? (
                    <>
                      <button type="button" aria-label={`Quitar sangría a la línea ${i + 1}`} onClick={() => indent(i, -1)} className="rounded-sm p-1 hover:bg-surface-3">
                        <IndentDecrease aria-hidden className="size-3.5" />
                      </button>
                      <button type="button" aria-label={`Dar sangría a la línea ${i + 1}`} onClick={() => indent(i, 1)} className="rounded-sm p-1 hover:bg-surface-3">
                        <IndentIncrease aria-hidden className="size-3.5" />
                      </button>
                    </>
                  ) : null}
                  <button type="button" aria-label={`Subir la línea ${i + 1}`} onClick={() => move(i, -1)} className="rounded-sm p-1 hover:bg-surface-3">
                    <ArrowUp aria-hidden className="size-3.5" />
                  </button>
                  <button type="button" aria-label={`Bajar la línea ${i + 1}`} onClick={() => move(i, 1)} className="rounded-sm p-1 hover:bg-surface-3">
                    <ArrowDown aria-hidden className="size-3.5" />
                  </button>
                  <button type="button" aria-label={`Quitar la línea ${i + 1}`} onClick={() => unplace(i)} className="rounded-sm p-1 hover:bg-surface-3">
                    <X aria-hidden className="size-3.5" />
                  </button>
                </span>
              ) : null}
            </li>
          ))}
          {draft.placed.length === 0 ? <li className="px-1 text-sm text-muted-foreground">Elige líneas de la izquierda en orden.</li> : null}
        </ol>
        <Results run={draft.run} />
      </section>
    </div>
  );
}

function parsonsCode(ex: Ex<"parsons">, placed: readonly ParsonsItem[]): string {
  return `${placed.map((p) => `${ex.lenguaje === "python" ? " ".repeat(4 * p.indent) : ""}${p.text}`).join("\n")}\n`;
}

export const parsonsModule: TypeModule<ParsonsDraft> = {
  initial: (ex, seed) => {
    if (ex.tipo !== "parsons") return { pool: [], placed: [], run: null };
    const all = [...ex.lineas, ...(ex.distractores ?? [])].map((l, key) => ({ key, text: l.trim(), indent: 0 }));
    let pool = shuffle(createRng(seed ^ seedFrom(ex.id)), all);
    if (pool.every((p, i) => p.key === i)) pool = [...pool.slice(1), pool[0] as ParsonsItem];
    return { pool, placed: [], run: null };
  },
  Input: ParsonsInput,
  toAnswer: async (ex, d) => {
    if (ex.tipo !== "parsons") return "Tipo inválido.";
    if (d.placed.length === 0) return "Arma tu programa con las líneas de la izquierda.";
    const python = ex.lenguaje === "python";
    const exact =
      d.placed.length === ex.lineas.length &&
      ex.lineas.every((l, i) => d.placed[i]?.text === l.trim() && (!python || d.placed[i]?.indent === indentOf(l)));
    if (exact) return { kind: "steps", passed: true, summary: "Orden exacto." };
    // Otro orden también puede ser correcto: si hay pruebas, deciden ellas.
    if (ex.tests) {
      const run = await runCodeTests(ex.lenguaje, parsonsCode(ex, d.placed), ex.tests);
      if (run.status === "unavailable") return run.message;
      return { kind: "steps", passed: run.grade.passed, summary: `${run.grade.passed ? "Otro orden válido: pasa las pruebas." : "Así no pasa las pruebas."}\n${run.grade.text}\n\nUn orden correcto:\n${ex.lineas.join("\n")}` };
    }
    return { kind: "steps", passed: false, summary: `Un orden correcto:\n${ex.lineas.join("\n")}` };
  },
  describe: (ex, d) => (ex.tipo === "parsons" ? parsonsCode(ex, d.placed) : ""),
};

// ---------------------------------------------------------------- rastreo de memoria
interface TraceDraft {
  readonly step: number;
  /** Respuesta por índice de paso (solo en pasos con pregunta). */
  readonly answers: Readonly<Record<number, string>>;
  /** Pasos con pregunta ya superados (se revelan sus valores). */
  readonly passed: readonly number[];
}

function Cells({ title, cells, hide }: { title: string; cells: readonly TraceCell[]; hide: boolean }) {
  return (
    <section aria-label={title}>
      <h4 className="console-label mb-1">{title}</h4>
      {cells.length ? (
        <table className="w-full font-mono text-sm">
          <tbody>
            {cells.map((c, i) => (
              <tr key={`${c.nombre}-${i}`} className="border-t first:border-t-0">
                <th scope="row" className="py-1 pr-3 text-left font-semibold">
                  {c.nombre}
                </th>
                <td className={cn("py-1 text-right", c.valor.startsWith("→") && "text-info")}>{hide ? "?" : c.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-muted-foreground">(vacío)</p>
      )}
    </section>
  );
}

function TraceInput({ exercise, draft, setDraft, disabled, onEnter }: InputProps<TraceDraft>) {
  const ex = exercise as Ex<"rastreo_memoria">;
  const lines = ex.codigo.replace(/\n+$/, "").split("\n");
  const step = ex.pasos[draft.step];
  const total = ex.pasos.length;
  const isQuestion = Boolean(step?.pregunta);
  const answered = (draft.answers[draft.step] ?? "").trim() !== "";
  const canNext = draft.step < total - 1 && (!isQuestion || answered);
  const go = (d: number) => {
    const next = Math.max(0, Math.min(total - 1, draft.step + d));
    const passed = d > 0 && isQuestion && !draft.passed.includes(draft.step) ? [...draft.passed, draft.step] : draft.passed;
    setDraft({ ...draft, step: next, passed });
  };
  const hide = isQuestion && !draft.passed.includes(draft.step);
  if (!step) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <ol className="code-view grid !whitespace-normal p-1" aria-label="Programa">
        {lines.map((l, i) => (
          <li key={i} aria-current={i + 1 === step.linea ? "step" : undefined} className={cn("flex gap-3 rounded-sm px-2", i + 1 === step.linea && "bg-[color-mix(in_srgb,var(--xp)_22%,transparent)]")}>
            <span className="w-6 shrink-0 text-right text-muted-foreground tabular-nums">{i + 1}</span>
            <span className="whitespace-pre">{l || " "}</span>
          </li>
        ))}
      </ol>
      <div className="grid content-start gap-4">
        <p className="font-mono text-xs text-muted-foreground" aria-live="polite">
          Paso {draft.step + 1} de {total} · se acaba de ejecutar la línea {step.linea}
        </p>
        {step.nota ? <RichText text={step.nota} className="text-sm" /> : null}
        <Cells title="Pila (variables locales)" cells={step.pila} hide={hide} />
        <Cells title="Heap (memoria dinámica)" cells={step.heap ?? []} hide={hide} />
        {isQuestion ? (
          <label className="grid gap-1.5 rounded-md border border-xp p-3">
            <RichText text={step.pregunta ?? ""} inline className="font-semibold" />
            <input
              aria-label="Tu respuesta al paso"
              disabled={disabled}
              value={draft.answers[draft.step] ?? ""}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setDraft({ ...draft, answers: { ...draft.answers, [draft.step]: e.target.value } })}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (draft.step < total - 1) go(1);
                else onEnter();
              }}
              className="h-10 rounded-md border border-input bg-surface px-3 font-mono"
            />
          </label>
        ) : null}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={draft.step === 0} onClick={() => go(-1)}>
            <ChevronLeft aria-hidden /> Anterior
          </Button>
          <Button variant="secondary" size="sm" disabled={!canNext || disabled} onClick={() => go(1)}>
            Siguiente paso <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

export const traceModule: TypeModule<TraceDraft> = {
  initial: () => ({ step: 0, answers: {}, passed: [] }),
  Input: TraceInput,
  toAnswer: (ex, d) => {
    if (ex.tipo !== "rastreo_memoria") return "Tipo inválido.";
    const questions = ex.pasos.map((p, i) => ({ p, i })).filter(({ p }) => p.pregunta);
    const missing = questions.filter(({ i }) => !(d.answers[i] ?? "").trim());
    if (missing.length) return `Te faltan ${missing.length === 1 ? "1 pregunta" : `${missing.length} preguntas`} (paso ${missing.map(({ i }) => i + 1).join(", ")}).`;
    const rows = questions.map(({ p, i }) => {
      const mine = (d.answers[i] ?? "").trim();
      const ok = blankMatches(mine, p.respuesta ?? "");
      return { ok, text: `${ok ? "✓" : "✗"} Paso ${i + 1}: ${p.pregunta} → ${mine}${ok ? "" : ` (era ${p.respuesta})`}` };
    });
    return { kind: "steps", passed: rows.every((r) => r.ok), summary: rows.map((r) => r.text).join("\n") };
  },
  describe: (ex, d) => (ex.tipo === "rastreo_memoria" ? Object.entries(d.answers).map(([k, v]) => `paso ${Number(k) + 1}: ${v}`).join(" · ") : ""),
};
