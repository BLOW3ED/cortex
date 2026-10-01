import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { type BuildResult, buildIndex } from "./core/build-index";
import type { RawContent, RawFile, RawSubject } from "./core/model";

const UNIT_DIR = /^\d{2}-/;

/**
 * Lee `curriculum/plan-2020.json` y `content/**` tal como están en disco. Las rutas del resultado
 * son relativas a `root` y usan `/` en cualquier sistema operativo.
 */
export function readRawContent(root: string): RawContent {
  const abs = (rel: string) => join(root, ...rel.split("/"));
  const read = (rel: string): RawFile | null => {
    const p = abs(rel);
    return existsSync(p) && statSync(p).isFile() ? { path: rel, text: readFileSync(p, "utf8") } : null;
  };
  const dirs = (rel: string, keep: (name: string) => boolean): string[] => {
    const p = abs(rel);
    if (!existsSync(p)) return [];
    return readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isDirectory() && keep(d.name))
      .map((d) => d.name)
      .sort();
  };

  const subjects: RawSubject[] = dirs("content", (n) => !n.startsWith("_") && !n.startsWith(".")).map((s) => ({
    dir: s,
    concepts: read(`content/${s}/conceptos.yaml`),
    units: dirs(`content/${s}`, (n) => UNIT_DIR.test(n)).map((u) => ({
      dir: u,
      lesson: read(`content/${s}/${u}/leccion.mdx`),
      exercises: read(`content/${s}/${u}/ejercicios.yaml`),
      boss: read(`content/${s}/${u}/jefe.yaml`),
    })),
  }));

  return { plan: read("curriculum/plan-2020.json"), subjects };
}

/** Lee y valida todo el contenido. No lanza: devuelve el índice (si se pudo) y los issues. */
export function loadContent(root: string): BuildResult {
  return buildIndex(readRawContent(root));
}
