"use client";

import { useState } from "react";
import { checkAnswer } from "@/engine/answers/check";
import type { CatalogExercise } from "@/content/core/study-catalog";
import { MathField } from "./math-field";

const DEMO = {
  id: "demo-00-001",
  tipo: "simbolico",
  dificultad: 2,
  conceptos: ["demo"],
  enunciado: "Simplifica",
  explicacion: "x+3",
  respuesta: "x+3",
  verificar: { sympy: "x+3" },
  unitKey: "demo/00-demo",
  subjectId: "demo",
} as unknown as CatalogExercise;

/** Demostración de la entrada de fórmulas y del verificador simbólico (catálogo `/estilo`). */
export function FormulaDemo() {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const check = () => {
    const r = checkAnswer(DEMO, { kind: "text", value });
    setResult(r.status === "correct" ? "Equivalente a x+3" : r.status === "wrong" ? "No es equivalente a x+3" : r.message);
  };
  return (
    <div className="grid max-w-xl gap-3">
      <p className="text-sm text-ink-2">
        Escribe algo equivalente a <code>x+3</code> (por ejemplo <code>(x^2-9)/(x-3)</code>) y pulsa Enter.
      </p>
      <MathField label="Expresión de prueba" value={value} onChange={setValue} onEnter={check} />
      <p aria-live="polite" className="font-mono text-sm" data-testid="formula-demo-result">
        {value ? `Leído: ${value}` : "Leído: —"}
        {result ? ` · ${result}` : ""}
      </p>
    </div>
  );
}
