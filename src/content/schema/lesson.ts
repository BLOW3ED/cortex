import { kebab, nonEmptyText, UNIT_DIR_RE, z } from "./common";

/** Front matter de `leccion.mdx` (docs/05). */
export const lessonFrontmatterSchema = z.strictObject({
  titulo: nonEmptyText,
  materia: kebab,
  unidad: z.string().regex(UNIT_DIR_RE, "debe ser <NN-nombre>"),
  duracion_min: z.number().int().positive(),
  prerrequisitos: z.array(z.string()).nullish(),
  conceptos: z.array(kebab),
  programa_ref: nonEmptyText,
});

export type LessonFrontmatter = z.infer<typeof lessonFrontmatterSchema>;
