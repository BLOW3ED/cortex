/**
 * API de los componentes que una lección puede usar (docs/05). Es dato puro: la guardia del
 * compilador la usa para validar cada uso, y el registro de React debe implementar exactamente
 * estos nombres (lo exige una prueba).
 */
export type PropType = "string" | "string[]";

export interface PropSpec {
  readonly type: PropType;
  readonly required?: boolean;
}

export interface ComponentSpec {
  readonly props: Readonly<Record<string, PropSpec>>;
  /** ¿Puede llevar contenido entre la etiqueta de apertura y la de cierre? */
  readonly children: boolean;
}

export const LESSON_API = {
  Predice: { props: { pregunta: { type: "string", required: true }, revela: { type: "string" } }, children: false },
  Concepto: { props: { titulo: { type: "string" } }, children: true },
  Ejemplo: { props: { titulo: { type: "string" } }, children: true },
  Desvanecido: {
    props: { titulo: { type: "string" }, pasos: { type: "string[]", required: true }, respuestas: { type: "string[]" } },
    children: false,
  },
  Ojo: { props: {}, children: true },
  Conexion: { props: { materia: { type: "string" } }, children: true },
  Resumen: { props: {}, children: true },
  Feynman: { props: {}, children: true },
  Visual: { props: { id: { type: "string", required: true } }, children: false },
} as const satisfies Record<string, ComponentSpec>;

export type LessonComponentName = keyof typeof LESSON_API;

/** Hueco que el lector completa en `<Desvanecido>` (y en ejercicios `completar`). */
export const BLANK = "___";
