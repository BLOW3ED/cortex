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

/** Componentes que una lección puede usar (docs/05). La clave es el nombre en el MDX. */
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
} as const;

export const LESSON_COMPONENT_NAMES: readonly string[] = Object.keys(LESSON_COMPONENTS);
