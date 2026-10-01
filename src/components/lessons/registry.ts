import type { ComponentType } from "react";
import { LESSON_API, type LessonComponentName } from "@/content/core/lesson-api";
import {
  ConceptBox,
  Connection,
  FadedExample,
  FeynmanChallenge,
  Pitfall,
  PredictPrompt,
  Summary,
  VisualPlaceholder,
  WorkedExample,
} from "./lesson-blocks";

/**
 * Implementación de cada componente de `LESSON_API` (docs/05). La clave es el nombre que se
 * escribe en el MDX; el `satisfies` obliga a cubrir exactamente la API.
 */
export const LESSON_COMPONENTS = {
  Predice: PredictPrompt,
  Concepto: ConceptBox,
  Ejemplo: WorkedExample,
  Desvanecido: FadedExample,
  Ojo: Pitfall,
  Conexion: Connection,
  Resumen: Summary,
  Feynman: FeynmanChallenge,
  Visual: VisualPlaceholder,
} satisfies Record<LessonComponentName, ComponentType<never>>;

export { LESSON_API };
