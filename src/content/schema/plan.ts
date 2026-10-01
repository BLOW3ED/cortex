import { kebab, nonEmptyText, z } from "./common";

export const planSubjectSchema = z.strictObject({
  id: kebab,
  nombre: nonEmptyText,
  teoria: z.number().nonnegative(),
  practica: z.number().nonnegative(),
  th: z.number().nonnegative(),
  creditos: z.number().nonnegative(),
  track: kebab,
  cortex_fase: z.number().int().nonnegative().nullable(),
  optativa: z.literal(true).optional(),
});

export const planSchema = z.strictObject({
  programa: nonEmptyText,
  plan: nonEmptyText,
  vigencia: nonEmptyText,
  unidades_academicas: z.array(nonEmptyText),
  fuente: nonEmptyText,
  totales: z.strictObject({
    teoria: z.number(),
    practica: z.number(),
    horas: z.number(),
    creditos_tepic: z.number(),
  }),
  tracks: z.record(kebab, nonEmptyText),
  semestres: z
    .array(
      z.strictObject({
        n: z.number().int().positive(),
        creditos: z.number().nonnegative(),
        materias: z.array(planSubjectSchema).min(1),
      }),
    )
    .min(1),
  optativas: z.array(z.strictObject({ id: kebab, nombre: nonEmptyText })),
  optativas_horas: z.strictObject({
    teoria: z.number(),
    practica: z.number(),
    th: z.number(),
    creditos: z.number(),
  }),
  notas: z.array(z.string()).optional(),
});

export type PlanSubject = z.infer<typeof planSubjectSchema>;
export type Plan = z.infer<typeof planSchema>;
