"use client";

import { useMemo } from "react";
import { renderRichTextSafe } from "@/content/rich-text";
import { cn } from "@/lib/utils";

/**
 * Texto de un ejercicio con Markdown y KaTeX. El HTML sale de `renderRichText` (Markdown sin HTML
 * crudo, validado por `content:check`), así que es seguro inyectarlo.
 */
export function RichText({ text, inline = false, className }: { text: string; inline?: boolean; className?: string }) {
  const html = useMemo(() => renderRichTextSafe(text, { inline }), [text, inline]);
  return inline ? (
    <span className={cn("rich", className)} dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <div className={cn("rich", className)} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
