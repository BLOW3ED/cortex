import { isScalar, parse, parseDocument, type Tags, visit } from "yaml";

/**
 * Lee YAML igual que PyYAML (`yaml.safe_load`, YAML 1.1), que es lo que usa verify_content.py.
 *
 * La librería `yaml` en modo 1.1 difiere de PyYAML en algunos escalares; aquí se usan las regex
 * del resolver de PyYAML:
 * - Booleanos: `y`, `Y`, `n`, `N` son texto (`variables: [x, y, n]`).
 * - Enteros: `09` es texto; los sexagesimales empiezan en 1-9 (`0:30` es texto).
 * - Flotantes: exigen punto decimal (`1e3` es texto, `1.0e+3` es número); `.5` sin signo sí,
 *   `-.5`, `+.5`, `._5` y `.` son texto.
 * - Fechas: sin hora, el mes y el día van con 2 dígitos (`2026-1-1` es texto).
 * La capa de paridad de `pnpm content:check` compara contra PyYAML real para atrapar el resto.
 */
const BOOL = "tag:yaml.org,2002:bool";

/** Regex original de `yaml` 2.9 (modo 1.1) → regex de PyYAML. Se busca por la fuente exacta. */
const OVERRIDES = new Map<string, RegExp>([
  // int decimal
  ["^[-+]?[0-9][0-9_]*$", /^[-+]?(?:0|[1-9][0-9_]*)$/],
  // int sexagesimal
  ["^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$", /^[-+]?[1-9][0-9_]*(?::[0-5]?[0-9])+$/],
  // float
  ["^[-+]?(?:[0-9][0-9_]*)?\\.[0-9_]*$", /^(?:[-+]?[0-9][0-9_]*\.[0-9_]*|\.[0-9][0-9_]*)$/],
  // float con exponente
  ["^[-+]?(?:[0-9][0-9_]*)?(?:\\.[0-9_]*)?[eE][-+]?[0-9]+$", /^(?:[-+]?[0-9][0-9_]*\.[0-9_]*|\.[0-9][0-9_]*)[eE][-+][0-9]+$/],
  // timestamp: sin hora exige AAAA-MM-DD; con hora acepta mes y día de 1 dígito
  [
    "^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$",
    /^(?:[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}(?:[Tt]|[ \t]+)[0-9]{1,2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]*)?(?:[ \t]*(?:Z|[-+][0-9]{1,2}(?::[0-9]{2})?))?)$/,
  ],
]);
const PY_TRUE = /^(?:yes|Yes|YES|true|True|TRUE|on|On|ON)$/;
const PY_FALSE = /^(?:no|No|NO|false|False|FALSE|off|Off|OFF)$/;

function pyCompatible(tags: Tags): Tags {
  let replaced = 0;
  const out = tags.map((t) => {
    if (typeof t === "string" || !("test" in t) || !t.test) return t;
    if (t.tag === BOOL) {
      replaced++;
      return { ...t, test: t.identify?.(true) ? PY_TRUE : PY_FALSE };
    }
    const test = OVERRIDES.get(t.test.source);
    if (!test) return t;
    replaced++;
    return { ...t, test };
  });
  // 2 booleanos + los de OVERRIDES. Si la librería cambia sus regex, falla aquí y no en silencio.
  if (replaced !== 2 + OVERRIDES.size) {
    throw new Error(`parseYaml: se esperaban ${2 + OVERRIDES.size} tags ajustables y hubo ${replaced}`);
  }
  return out;
}

const OPTIONS = { version: "1.1", customTags: pyCompatible, prettyErrors: true } as const;

export function parseYaml(text: string): unknown {
  return parse(text, OPTIONS);
}

/**
 * Campos que deben ser enteros pero se escribieron con decimales o exponente (`dificultad: 4.0`).
 * En JS `4.0 === 4`, pero PyYAML lo lee como flotante y verify_content.py lo rechaza.
 */
export function integralFloats(text: string, fields: ReadonlySet<string>): { field: string; source: string }[] {
  const found: { field: string; source: string }[] = [];
  let doc;
  try {
    doc = parseDocument(text, OPTIONS);
  } catch {
    return found;
  }
  visit(doc, {
    Pair(_key, pair) {
      if (!isScalar(pair.key) || !isScalar(pair.value)) return;
      const field = String(pair.key.value);
      const source = pair.value.source;
      if (fields.has(field) && typeof pair.value.value === "number" && typeof source === "string" && /[.eE]/.test(source)) {
        found.push({ field, source });
      }
    },
  });
  return found;
}

/** Quita BOM y normaliza fines de línea (Windows) antes de leer. */
export function normalizeText(text: string): string {
  return text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}
