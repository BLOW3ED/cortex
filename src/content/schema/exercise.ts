import { exerciseId, kebab, nonEmptyText, numberOrExpr, unitKey, z } from "./common";

export const EXERCISE_TYPES = [
  "opcion_multiple",
  "numerico",
  "simbolico",
  "completar",
  "ordenar",
  "codigo",
  "predecir_salida",
  "autoevaluacion",
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

/** Cómo se verifica la respuesta (docs/05, "Sobre `verificar`"). */
export const verifySchema = z.union(
  [
    z.strictObject({ sympy: nonEmptyText }),
    z.strictObject({ python: nonEmptyText }),
    z.strictObject({ revision: z.literal("manual") }),
  ],
  { error: "verificar debe ser { sympy: ... }, { python: ... } o { revision: manual }" },
);
export type Verify = z.infer<typeof verifySchema>;

/** Campos comunes a todos los tipos. */
const common = {
  id: exerciseId,
  dificultad: z.number().int().min(1).max(5),
  conceptos: z.array(kebab).min(1, "conceptos vacío"),
  enunciado: nonEmptyText,
  explicacion: nonEmptyText,
  pistas: z.array(nonEmptyText).optional(),
  tarjeta: z.boolean().optional(),
  tiempo_estimado_s: z.number().positive().optional(),
  verificar: verifySchema.optional(),
  retirado: z.literal(false).optional(),
};

/**
 * Texto que la app muestra o compara tal cual: va entre comillas en el YAML. Un número sin
 * comillas perdería su forma (`3.0` → 3) y ya no coincidiría con lo que verificó Python.
 */
const displayText = z.string({ error: "escribe este valor entre comillas (texto exacto, p. ej. \"3.0\")" });
const uniqueAsText = (items: readonly string[]) => new Set(items).size === items.length;

const multipleChoice = z
  .strictObject({
    ...common,
    tipo: z.literal("opcion_multiple"),
    opciones: z.array(displayText).min(2, "opciones inválidas: se necesitan al menos 2"),
    correcta: z.number().int().nonnegative(),
    valores: z.array(numberOrExpr).optional(),
  })
  .superRefine((ex, ctx) => {
    if (ex.correcta >= ex.opciones.length) {
      ctx.addIssue({ code: "custom", path: ["correcta"], message: "'correcta' fuera de rango" });
    }
    if (!uniqueAsText(ex.opciones)) {
      ctx.addIssue({ code: "custom", path: ["opciones"], message: "opciones repetidas" });
    }
    if (ex.valores && ex.valores.length !== ex.opciones.length) {
      ctx.addIssue({
        code: "custom",
        path: ["valores"],
        message: "'valores' debe tener la misma longitud que 'opciones'",
      });
    }
  });

const numeric = z.strictObject({
  ...common,
  tipo: z.literal("numerico"),
  respuesta: numberOrExpr,
  tolerancia: z.number().nonnegative().optional(),
  verificar: verifySchema,
});

const symbolic = z.strictObject({
  ...common,
  tipo: z.literal("simbolico"),
  respuesta: z.union([nonEmptyText, z.number()]),
  variables: z.array(nonEmptyText).optional(),
  verificar: z.strictObject({ sympy: nonEmptyText }),
});

const fillBlanks = z
  .strictObject({
    ...common,
    tipo: z.literal("completar"),
    texto: nonEmptyText,
    respuestas: z.array(displayText),
  })
  .superRefine((ex, ctx) => {
    const blanks = ex.texto.split("___").length - 1;
    if (blanks === 0 || blanks !== ex.respuestas.length) {
      ctx.addIssue({
        code: "custom",
        path: ["respuestas"],
        message: `huecos (${blanks}) != respuestas (${ex.respuestas.length})`,
      });
    }
  });

const ordering = z
  .strictObject({
    ...common,
    tipo: z.literal("ordenar"),
    elementos: z.array(displayText),
  })
  .superRefine((ex, ctx) => {
    if (ex.elementos.length < 3 || !uniqueAsText(ex.elementos)) {
      ctx.addIssue({ code: "custom", path: ["elementos"], message: "ordenar requiere ≥3 elementos únicos" });
    }
  });

const pythonTest = z.strictObject({
  expr: nonEmptyText,
  esperado: z.json(),
  tolerancia: z.number().nonnegative().optional(),
});
const cTest = z.strictObject({
  entrada: z.string().optional(),
  salida: displayText,
});

const codePython = z.strictObject({
  ...common,
  tipo: z.literal("codigo"),
  lenguaje: z.literal("python"),
  plantilla: z.string(),
  solucion: nonEmptyText,
  tests: z.array(pythonTest).min(1),
});
const codeC = z.strictObject({
  ...common,
  tipo: z.literal("codigo"),
  lenguaje: z.literal("c"),
  plantilla: z.string(),
  solucion: nonEmptyText,
  tests: z.array(cTest).min(1),
});

const predictOutput = z.strictObject({
  ...common,
  tipo: z.literal("predecir_salida"),
  lenguaje: z.literal("python"),
  codigo: nonEmptyText,
  respuesta: displayText,
});

const selfAssessment = z.strictObject({
  ...common,
  tipo: z.literal("autoevaluacion"),
  rubrica: z.array(nonEmptyText).min(1, "requiere 'rubrica'"),
  respuesta_modelo: nonEmptyText,
});

/** Un esquema por tipo; `codigo` se despacha además por `lenguaje`. */
export const exerciseSchemas = {
  opcion_multiple: multipleChoice,
  numerico: numeric,
  simbolico: symbolic,
  completar: fillBlanks,
  ordenar: ordering,
  codigo: z.discriminatedUnion("lenguaje", [codePython, codeC], { error: "lenguaje debe ser 'python' o 'c'" }),
  predecir_salida: predictOutput,
  autoevaluacion: selfAssessment,
} as const satisfies Record<ExerciseType, z.ZodType>;

/**
 * Ejercicio retirado (`retirado: true`): su id queda reservado para siempre y no se verifica
 * el resto (igual que verify_content.py). Solo se exige el id.
 */
export const retiredExerciseSchema = z.looseObject({
  id: exerciseId,
  retirado: z.literal(true),
});

export type MultipleChoiceExercise = z.infer<typeof multipleChoice>;
export type NumericExercise = z.infer<typeof numeric>;
export type SymbolicExercise = z.infer<typeof symbolic>;
export type FillBlanksExercise = z.infer<typeof fillBlanks>;
export type OrderingExercise = z.infer<typeof ordering>;
export type CodeExercise = z.infer<(typeof exerciseSchemas)["codigo"]>;
export type PredictOutputExercise = z.infer<typeof predictOutput>;
export type SelfAssessmentExercise = z.infer<typeof selfAssessment>;
export type Exercise =
  | MultipleChoiceExercise
  | NumericExercise
  | SymbolicExercise
  | FillBlanksExercise
  | OrderingExercise
  | CodeExercise
  | PredictOutputExercise
  | SelfAssessmentExercise;
export type RetiredExercise = z.infer<typeof retiredExerciseSchema>;

/** Encabezado de `ejercicios.yaml`; cada ejercicio se valida aparte con `parseExercise`. */
export const exercisesFileSchema = z.strictObject({
  unidad: unitKey,
  ejercicios: z.array(z.unknown()),
});

export type ParsedExercise =
  | { ok: true; retired: false; exercise: Exercise }
  | { ok: true; retired: true; exercise: RetiredExercise }
  | { ok: false; issues: z.core.$ZodIssue[] };

const typeSchema = z.enum(EXERCISE_TYPES, {
  error: (iss) => (iss.input === undefined ? "falta 'tipo'" : `tipo desconocido '${String(iss.input)}'`),
});

/** Valida un ejercicio en dos tiempos (tipo y luego campos) para dar mensajes claros. */
export function parseExercise(raw: unknown): ParsedExercise {
  const retirado = typeof raw === "object" && raw !== null ? (raw as { retirado?: unknown }).retirado : undefined;
  if (retirado !== undefined && typeof retirado !== "boolean") {
    return {
      ok: false,
      issues: [{ code: "custom", path: ["retirado"], message: "retirado debe ser true (o quítalo)", input: retirado }],
    };
  }
  if (retirado === true) {
    const r = retiredExerciseSchema.safeParse(raw);
    return r.success ? { ok: true, retired: true, exercise: r.data } : { ok: false, issues: r.error.issues };
  }
  const head = z.looseObject({ tipo: typeSchema }).safeParse(raw);
  if (!head.success) return { ok: false, issues: head.error.issues };
  const r = exerciseSchemas[head.data.tipo].safeParse(raw);
  return r.success
    ? { ok: true, retired: false, exercise: r.data as Exercise }
    : { ok: false, issues: r.error.issues };
}
