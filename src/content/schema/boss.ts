import { exerciseId, kebab, nonEmptyText, unitKey, z } from "./common";

/** `jefe.yaml` (docs/05 y docs/03). */
export const bossSchema = z.strictObject({
  unidad: unitKey,
  nombre: nonEmptyText,
  vidas: z.number().int().positive(),
  tiempo_segundos: z.number().int().positive(),
  aprobado_minimo: z.number().gt(0).lte(1),
  preguntas: z.strictObject({
    propias: z.array(exerciseId),
    repaso_de: z.array(exerciseId).nullish(),
  }),
  recompensa: z.strictObject({
    xp: z.number().int().nonnegative(),
    insignia: kebab,
  }),
});

export type Boss = z.infer<typeof bossSchema>;
