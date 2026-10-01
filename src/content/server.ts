import "server-only";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { cache } from "react";
import { type ContentIssue, formatIssue } from "./core/issues";
import type { ContentIndex, UnitEntry } from "./core/model";
import { loadContent } from "./loader";

export class ContentValidationError extends Error {
  constructor(readonly issues: readonly ContentIssue[]) {
    super(
      `El contenido tiene ${issues.length} error(es); corre \`pnpm content:check\`:\n` +
        issues.map(formatIssue).join("\n"),
    );
    this.name = "ContentValidationError";
  }
}

/** Raíz del repo con `content/` y `curriculum/`. `CORTEX_CONTENT_ROOT` permite probar con otra. */
export function contentRoot(): string {
  const env = process.env.CORTEX_CONTENT_ROOT;
  return env ? resolve(env) : process.cwd();
}

/**
 * Índice de contenido validado. En `next build` se calcula una vez y las páginas se generan
 * estáticas; si el contenido tiene errores, el build falla.
 */
export const getContentIndex = cache((): ContentIndex => {
  const { index, issues } = loadContent(contentRoot());
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length || !index) throw new ContentValidationError(errors);
  return index;
});

export function getUnit(subjectId: string, slug: string): UnitEntry | null {
  return getContentIndex().content[subjectId]?.units.find((u) => u.slug === slug) ?? null;
}

export function readLessonSource(unit: UnitEntry): string {
  return readFileSync(join(contentRoot(), ...unit.lessonFile.split("/")), "utf8");
}
