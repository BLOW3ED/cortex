/**
 * Catálogo de reglas de contenido con código estable.
 *
 * `python: true` = verify_content.py aplica la misma regla con la misma severidad (se prueba en
 * tests/parity). `python: false` = regla "solo TS" (decisión D5): más estricta, siempre error,
 * salvo las marcadas como aviso.
 */
export type Severity = "error" | "warning";

export interface RuleSpec {
  readonly severity: Severity;
  readonly python: boolean;
  readonly description: string;
}

export const RULES = {
  // Estructura de archivos
  "yaml-invalido": { severity: "error", python: true, description: "El YAML no se puede leer." },
  "falta-archivo": { severity: "error", python: true, description: "Una unidad necesita leccion.mdx, ejercicios.yaml y jefe.yaml." },
  "sin-conceptos": { severity: "warning", python: true, description: "La materia no tiene conceptos.yaml." },
  "materia-fuera-del-plan": { severity: "warning", python: true, description: "La carpeta de materia no existe en plan-2020.json." },
  // Esquemas (campos, tipos y valores de docs/05)
  esquema: { severity: "error", python: true, description: "Campo faltante, de tipo incorrecto o con valor inválido." },
  "clave-desconocida": { severity: "error", python: false, description: "Campo que no existe en docs/05 (errores de dedo como `tolerancai`)." },
  // Conceptos
  "concepto-duplicado": { severity: "error", python: true, description: "Dos conceptos con el mismo id en una materia." },
  "prerrequisito-inexistente": { severity: "error", python: true, description: "Un concepto requiere otro que no existe." },
  "ciclo-prerrequisitos": { severity: "error", python: true, description: "Los prerrequisitos forman un ciclo." },
  "concepto-inexistente": { severity: "error", python: true, description: "Un ejercicio o lección usa un concepto que no existe." },
  "materia-conceptos-distinta": { severity: "error", python: false, description: "`materia` de conceptos.yaml no coincide con la carpeta." },
  // Lección
  "sin-front-matter": { severity: "error", python: true, description: "La lección no abre con front matter." },
  "programa-pendiente": { severity: "warning", python: true, description: "`programa_ref` pendiente." },
  "falta-componente-pedagogico": { severity: "warning", python: true, description: "La lección no usa <Predice>, <Resumen> o <Feynman>." },
  "leccion-fuera-de-lugar": { severity: "error", python: false, description: "`materia`/`unidad` del front matter no coinciden con la carpeta." },
  "prerrequisito-leccion-inexistente": { severity: "error", python: false, description: "Un prerrequisito de la lección no existe." },
  "mdx-invalido": { severity: "error", python: false, description: "La lección no compila o no se puede dibujar (MDX, componentes, KaTeX, escapes)." },
  // Ejercicios
  "id-duplicado": { severity: "error", python: true, description: "Un id de ejercicio se repite en el repo (incluidos los retirados)." },
  "pocos-ejercicios": { severity: "warning", python: true, description: "Menos de 6 ejercicios en la unidad." },
  "muchas-pistas": { severity: "warning", python: true, description: "Más de 3 pistas." },
  "ejercicios-fuera-de-lugar": { severity: "error", python: false, description: "`unidad` de ejercicios.yaml o jefe.yaml no coincide con la carpeta." },
  "id-unidad-distinta": { severity: "error", python: false, description: "El NN del id no coincide con el número de la unidad." },
  "prefijo-inconsistente": { severity: "error", python: false, description: "Una materia usa más de un prefijo de id." },
  // Jefe
  "jefe-propia-inexistente": { severity: "error", python: true, description: "Una pregunta propia del jefe no está en la unidad." },
  "jefe-repaso-inexistente": { severity: "error", python: true, description: "Un id de `repaso_de` no existe." },
  "jefe-pocas-propias": { severity: "warning", python: true, description: "Menos de 6 preguntas propias." },
  "jefe-sin-dificil": { severity: "warning", python: true, description: "Ninguna pregunta propia de dificultad ≥ 4." },
  "jefe-repaso-no-previo": { severity: "error", python: false, description: "`repaso_de` debe venir de una unidad anterior (docs/05)." },
  "jefe-autoevaluacion": { severity: "error", python: false, description: "Las preguntas de autoevaluación no van en jefes cronometrados (docs/05)." },
  "jefe-retirado": { severity: "error", python: false, description: "Un jefe no puede usar ejercicios retirados." },
} as const satisfies Record<string, RuleSpec>;

export type RuleCode = keyof typeof RULES;
