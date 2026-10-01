import { type ComponentProps, Fragment } from "react";
import { compileMdx, type MDXContent } from "@/content/mdx";

const cache = new Map<string, MDXContent>();

function Span(props: ComponentProps<"span">) {
  return <span {...props} />;
}

/**
 * Dibuja el texto de un atributo (`pregunta`, `revela`, `pasos`...) con Markdown y KaTeX.
 * Las fórmulas ya se validaron al compilar la lección, así que aquí no se espera error.
 */
export function InlineMarkdown({ text, block = false }: { text: string | number; block?: boolean }) {
  const source = String(text);
  let content = cache.get(source);
  if (!content) {
    content = compileMdx({ file: "atributo", source, components: [], format: "md" });
    cache.set(source, content);
  }
  // El MDX compilado no usa hooks: se llama como función (no se crea un componente en cada render).
  return content({ components: block ? {} : { p: Span, wrapper: Fragment } });
}
