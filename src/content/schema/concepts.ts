import { kebab, nonEmptyText, z } from "./common";

/** Prerrequisito local (`limite-intuitivo`) o de otra materia (`calculo:limite-intuitivo`). */
const prerequisiteRef = z
  .string()
  .regex(/^([a-z0-9]+(-[a-z0-9]+)*:)?[a-z0-9]+(-[a-z0-9]+)*$/, "debe ser <concepto> o <materia>:<concepto>");

export const conceptSchema = z.strictObject({
  id: kebab,
  nombre: nonEmptyText,
  prerequisitos: z.array(prerequisiteRef).nullish(),
});

export const conceptsFileSchema = z.strictObject({
  materia: kebab,
  notacion: z.string().optional(),
  conceptos: z.array(conceptSchema),
});

export type Concept = z.infer<typeof conceptSchema>;
export type ConceptsFile = z.infer<typeof conceptsFileSchema>;
