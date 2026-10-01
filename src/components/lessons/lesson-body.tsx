import { compileMdx } from "@/content/mdx";
import { LESSON_API, LESSON_COMPONENTS } from "./registry";

/** Compila y dibuja una lección en el servidor. Lanza `LessonCompileError` (con línea) si algo falla. */
export function LessonBody({ file, source }: { file: string; source: string }) {
  const content = compileMdx({ file, source, components: LESSON_API });
  // El MDX compilado no usa hooks: se llama como función (no se crea un componente en cada render).
  return content({ components: LESSON_COMPONENTS });
}
