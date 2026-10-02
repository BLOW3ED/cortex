"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Entrada de fórmulas con MathLive (docs/02). Se carga solo en el navegador; mientras carga (o si
 * prefieres teclear) hay un campo de texto con la misma sintaxis que aceptan los verificadores:
 * `x^2`, `sqrt(x)`, `(x+1)/(x-1)`, `sin(x)`.
 */

interface MathFieldElement extends HTMLElement {
  value: string;
  getValue(format: "ascii-math" | "latex"): string;
  setValue(value: string): void;
  insert(s: string, options?: { format?: "ascii-math" | "latex" }): boolean;
  smartFence: boolean;
  mathVirtualKeyboardPolicy: string;
}

let configured: Promise<void> | null = null;

function loadMathLive(): Promise<void> {
  configured ??= import("mathlive").then(({ MathfieldElement }) => {
    MathfieldElement.fontsDirectory = "/vendor/mathlive/fonts";
    MathfieldElement.soundsDirectory = null;
  });
  return configured;
}

/** MathLive escribe `\cdot`, `⋅` o `·`; los verificadores ya traducen esos símbolos. */
export function asciiFromMathLive(ascii: string): string {
  return ascii.replace(/⁢/g, "*").replace(/\s+/g, " ").trim();
}

export function MathField({
  value,
  onChange,
  onEnter,
  disabled,
  label,
}: {
  value: string;
  onChange: (ascii: string) => void;
  onEnter: () => void;
  disabled?: boolean;
  label: string;
}) {
  const [mode, setMode] = useState<"visual" | "texto">("visual");
  const [ready, setReady] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<MathFieldElement | null>(null);
  const handlers = useRef({ onChange, onEnter, value });
  useEffect(() => {
    handlers.current = { onChange, onEnter, value };
  });

  useEffect(() => {
    if (mode !== "visual") return;
    let alive = true;
    loadMathLive().then(
      () => {
        if (!alive || !host.current) return;
        const mf = document.createElement("math-field") as MathFieldElement;
        mf.setAttribute("aria-label", label);
        mf.mathVirtualKeyboardPolicy = "manual";
        mf.smartFence = true;
        mf.className = "block w-full rounded-md border border-input bg-surface px-3 py-2 text-xl";
        mf.addEventListener("input", () => handlers.current.onChange(asciiFromMathLive(mf.getValue("ascii-math"))));
        mf.addEventListener("keydown", (e) => {
          if ((e as KeyboardEvent).key === "Enter") {
            e.preventDefault();
            handlers.current.onEnter();
          }
        });
        host.current.replaceChildren(mf);
        field.current = mf;
        // Si venías del modo texto, se conserva lo escrito.
        const typed = handlers.current.value;
        if (typed) {
          try {
            mf.insert(typed, { format: "ascii-math" });
          } catch {
            handlers.current.onChange("");
          }
        }
        setReady(true);
        mf.focus();
      },
      () => alive && setMode("texto"),
    );
    return () => {
      alive = false;
      field.current = null;
      setReady(false);
    };
    // El campo se crea una vez por modo; los manejadores se leen de la ref.
  }, [mode, label]);

  useEffect(() => {
    if (field.current) field.current.toggleAttribute("read-only", Boolean(disabled));
  }, [disabled, ready]);

  return (
    <div>
      {mode === "visual" ? (
        <div ref={host} className={cn("min-h-12", !ready && "animate-pulse rounded-md bg-surface-2")} />
      ) : (
        <input
          aria-label={label}
          autoFocus
          disabled={disabled}
          value={value}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            }
          }}
          className="h-12 w-full rounded-md border border-input bg-surface px-3 font-mono text-lg"
          placeholder="p. ej. (x+1)/(x-1) o sqrt(x)"
        />
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <button
          type="button"
          className="underline underline-offset-2 hover:text-ink"
          onClick={() => setMode((m) => (m === "visual" ? "texto" : "visual"))}
          disabled={disabled}
        >
          {mode === "visual" ? "Prefiero teclear como texto" : "Usar el editor de fórmulas"}
        </button>
        {mode === "texto" ? <span>Sintaxis: x^2 · sqrt(x) · sin(x) · (a)/(b)</span> : <span>Teclea / para fracción, ^ para potencia</span>}
      </div>
    </div>
  );
}
