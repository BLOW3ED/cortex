import { type ComponentProps, Fragment } from "react";
import { compileMdx, type MDXContent } from "@/content/mdx";

const cache = new Map<string, MDXContent>();

function Span(props: ComponentProps<"span">) {
  return <span {...props} />;
}

/**
 * Dibuja el texto de un atributo (`pregunta`, `revela`, `pasos`...) con Markdown y KaTeX.
 * - `inline` (títulos): los párrafos se vuelven `<span>`; el contenedor debe aceptar contenido en línea.
 * - por defecto (bloque): conserva párrafos y listas; el contenedor debe ser un `<div>`.
 * Las fórmulas ya se validaron al compilar la lección, así que aquí no se espera error.
 */
export function InlineMarkdown({ text, inline = false }: { text: string; inline?: boolean }) {
  let content = cache.get(text);
  if (!content) {
    content = compileMdx({ file: "atributo", source: text, components: {}, format: "md" });
    cache.set(text, content);
  }
  // El MDX compilado no usa hooks: se llama como función (no se crea un componente en cada render).
  return content({ components: inline ? { p: Span, wrapper: Fragment } : {} });
}
