import { z } from "zod";

// Mensajes de error de Zod en español.
z.config(z.locales.es());

/** `<prefijo>-<NN unidad>-<NNN>`, p. ej. `calc-01-001` (docs/05). Igual que ID_RE de verify_content.py. */
export const EXERCISE_ID_RE = /^[a-z]+-\d{2}-\d{3}$/;
/** kebab-case: minúsculas, dígitos y guiones. Igual que KEBAB_RE de verify_content.py. */
export const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Carpeta de unidad: `NN-nombre`. */
export const UNIT_DIR_RE = /^\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/;
/** Clave de unidad: `materia/NN-nombre`. */
export const UNIT_KEY_RE = /^[a-z0-9]+(-[a-z0-9]+)*\/\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/;

export const kebab = z.string().regex(KEBAB_RE, "debe ir en kebab-case (minúsculas, dígitos y guiones)");
export const exerciseId = z.string().regex(EXERCISE_ID_RE, "id no cumple <prefijo>-<NN>-<NNN>");
export const unitKey = z.string().regex(UNIT_KEY_RE, "debe ser <materia>/<NN-nombre>");
export const nonEmptyText = z.string().trim().min(1, "no puede ir vacío");

/** Número o texto que sympy pueda evaluar (p. ej. `"1/3"`). */
export const numberOrExpr = z.union([z.number(), nonEmptyText]);

export { z };
