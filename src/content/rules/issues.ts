import type { z } from "zod";
import { RULES, type RuleCode, type Severity } from "./catalog";

export interface ContentIssue {
  readonly code: RuleCode;
  readonly severity: Severity;
  /** Ruta relativa a la raíz del repo, con `/`. */
  readonly file: string;
  /** Id del ejercicio, si aplica. */
  readonly id?: string;
  readonly message: string;
}

export function issue(code: RuleCode, file: string, message: string, id?: string): ContentIssue {
  return { code, severity: RULES[code].severity, file, message, ...(id ? { id } : {}) };
}

function formatPath(path: readonly PropertyKey[]): string {
  return path.map((p, i) => (typeof p === "number" ? `[${p}]` : `${i ? "." : ""}${String(p)}`)).join("");
}

/** Convierte los errores de Zod en issues del catálogo. */
export function fromZod(issues: readonly z.core.$ZodIssue[], file: string, id?: string, prefix = ""): ContentIssue[] {
  return issues.flatMap((zi) => {
    const path = formatPath([...(prefix ? [prefix] : []), ...zi.path]);
    if (zi.code === "unrecognized_keys") {
      return zi.keys.map((k) =>
        issue("clave-desconocida", file, `campo desconocido '${k}'${path ? ` en ${path}` : ""}`, id),
      );
    }
    return [issue("esquema", file, path ? `${path}: ${zi.message}` : zi.message, id)];
  });
}

/** Mismo formato que verify_content.py: `ERROR   <dónde>: <mensaje>`. */
export function formatIssue(i: ContentIssue): string {
  const label = i.severity === "error" ? "ERROR  " : "AVISO  ";
  return `${label} ${i.file}${i.id ? ` [${i.id}]` : ""}: ${i.message}`;
}

export function hasErrors(issues: readonly ContentIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
