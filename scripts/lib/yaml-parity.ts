import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { parseYaml } from "../../src/content/core/yaml";
import { PYTHON_ENV, type PythonCommand } from "./find-python";

export interface YamlSource {
  /** Ruta para el reporte (`content/calculo/conceptos.yaml` o `.../leccion.mdx#front-matter`). */
  readonly path: string;
  readonly text: string;
}

export interface YamlDifference {
  readonly path: string;
  readonly app: unknown;
  readonly pyyaml: unknown;
}

// Normaliza a JSON comparable: fechas a texto, infinitos y NaN a marcas, errores a {__error__}.
const PY_SCRIPT = String.raw`
import sys, json, math, datetime, yaml
def norm(v):
    if isinstance(v, bool) or v is None or isinstance(v, (int, str)):
        return v
    if isinstance(v, float):
        if math.isnan(v): return "__nan__"
        if math.isinf(v): return "__inf__" if v > 0 else "__-inf__"
        return v
    if isinstance(v, datetime.datetime): return "__datetime__"
    if isinstance(v, datetime.date): return v.isoformat()
    if isinstance(v, dict): return {str(k): norm(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)): return [norm(x) for x in v]
    if isinstance(v, (set, frozenset)): return sorted(norm(x) for x in v)
    return "__" + type(v).__name__ + "__"
out = []
for item in json.load(sys.stdin):
    try:
        out.append(norm(yaml.safe_load(item)))
    except Exception:
        out.append({"__error__": True})
print(json.dumps(out, ensure_ascii=False))
`;

function normJs(v: unknown): unknown {
  if (v === null || typeof v === "boolean" || typeof v === "string") return v;
  if (typeof v === "number") {
    if (Number.isNaN(v)) return "__nan__";
    if (!Number.isFinite(v)) return v > 0 ? "__inf__" : "__-inf__";
    return v;
  }
  if (v instanceof Date) {
    const iso = v.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : "__datetime__";
  }
  if (Array.isArray(v)) return v.map(normJs);
  if (v instanceof Set) return [...v].map(normJs).sort();
  if (v instanceof Map) return Object.fromEntries([...v].map(([k, x]) => [String(k), normJs(x)]));
  if (typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normJs(x)]));
  return `__${typeof v}__`;
}

/** Lee cada YAML con la app y con PyYAML real, y devuelve las diferencias. */
export function compareWithPyYaml(sources: readonly YamlSource[], python: PythonCommand): YamlDifference[] {
  const r = spawnSync(python.command, [...python.args, "-c", PY_SCRIPT], {
    input: JSON.stringify(sources.map((s) => s.text)),
    encoding: "utf8",
    env: { ...process.env, ...PYTHON_ENV },
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (r.status !== 0) throw new Error(`PyYAML falló: ${r.stderr || r.error?.message || "sin salida"}`);
  const py = JSON.parse(r.stdout) as unknown[];
  return sources.flatMap((s, i) => {
    let app: unknown;
    try {
      app = normJs(parseYaml(s.text));
    } catch {
      app = { __error__: true };
    }
    return isDeepStrictEqual(app, py[i]) ? [] : [{ path: s.path, app, pyyaml: py[i] }];
  });
}
