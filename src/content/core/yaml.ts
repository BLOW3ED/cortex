import { parse, type Tags } from "yaml";

/**
 * Lee YAML igual que PyYAML (`yaml.safe_load`, YAML 1.1), que es lo que usa verify_content.py.
 *
 * La librería `yaml` en modo 1.1 difiere de PyYAML en algunos escalares; aquí se ajustan:
 * - Booleanos: PyYAML NO trata `y`, `Y`, `n`, `N` como booleanos (`variables: [x, y, n]`).
 * - Enteros: `09` es texto en PyYAML (ni octal ni decimal válido).
 * - Flotantes: PyYAML exige punto decimal (`1e3` es texto; `1.0e+3` es número) y `.` solo es texto.
 * La capa de paridad de `pnpm content:check` compara contra PyYAML real para atrapar el resto.
 */
const BOOL = "tag:yaml.org,2002:bool";

/** Regex original de `yaml` 2.9 (modo 1.1) → regex de PyYAML. Se busca por la fuente exacta. */
const OVERRIDES = new Map<string, RegExp>([
  ["^[-+]?[0-9][0-9_]*$", /^[-+]?(?:0|[1-9][0-9_]*)$/],
  ["^[-+]?(?:[0-9][0-9_]*)?\\.[0-9_]*$", /^[-+]?(?:[0-9][0-9_]*\.[0-9_]*|\.[0-9_]+)$/],
  ["^[-+]?(?:[0-9][0-9_]*)?(?:\\.[0-9_]*)?[eE][-+]?[0-9]+$", /^[-+]?(?:[0-9][0-9_]*\.[0-9_]*|\.[0-9_]+)[eE][-+][0-9]+$/],
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
  // 2 booleanos + 3 numéricos. Si la librería cambia sus regex, falla aquí y no en silencio.
  if (replaced !== 2 + OVERRIDES.size) {
    throw new Error(`parseYaml: se esperaban ${2 + OVERRIDES.size} tags ajustables y hubo ${replaced}`);
  }
  return out;
}

export function parseYaml(text: string): unknown {
  return parse(text, {
    version: "1.1",
    customTags: pyCompatible,
    prettyErrors: true,
  });
}

/** Quita BOM y normaliza fines de línea (Windows) antes de leer. */
export function normalizeText(text: string): string {
  return text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}
