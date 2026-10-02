/**
 * `pnpm content:check [ruta] [--root <dir>]`
 *
 * Verifica el contenido en 4 capas y sale con 1 si cualquiera falla:
 *   1. Esquemas Zod y reglas cruzadas sobre el índice completo (lo mismo que usa `next build`).
 *   2. Cada lección compila y se dibuja (MDX, componentes, KaTeX, escapes).
 *   3. Paridad YAML: la app y PyYAML leen igual cada archivo YAML.
 *   4. `scripts/verify_content.py` (corrección de respuestas con sympy / ejecución).
 * La ruta acota el reporte: `content`, `content/<materia>` o `content/<materia>/<NN-unidad>` (un
 * archivo dentro de una unidad cuenta como su unidad). Las capas 1–3 siempre cargan todo.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LessonBody } from "../src/components/lessons/lesson-body";
import { buildIndex, splitFrontmatter } from "../src/content/core/build-index";
import { type ContentIssue, formatIssue, issue } from "../src/content/core/issues";
import { readRawContent } from "../src/content/loader";
import { LessonCompileError } from "../src/content/mdx";
import { findPython, PYTHON_ENV } from "./lib/find-python";
import { compareWithPyYaml, type YamlSource } from "./lib/yaml-parity";

type Scope = { ok: true; scope: string; pythonTarget: string | null } | { ok: false; error: string };

/** Convierte la ruta que escribió Carlo en un alcance canónico (`content/<materia>[/<unidad>]`). */
export function resolveScope(root: string, target: string | null): Scope {
  if (!target) return { ok: true, scope: "", pythonTarget: null };
  const abs = resolve(root, target);
  if (!existsSync(abs)) return { ok: false, error: `la ruta '${target}' no existe` };
  // realpath corrige mayúsculas (Windows/macOS) y enlaces, igual que `Path.resolve()` en Python.
  const realRoot = realpathSync.native(root);
  let real = realpathSync.native(abs);
  if (statSync(real).isFile()) real = dirname(real);
  const rel = relative(realRoot, real).split(sep).join("/");
  const parts = rel.split("/");
  const invalid = `'${target}' no es contenido: usa content, content/<materia> o content/<materia>/<NN-unidad>`;
  if (rel.startsWith("..") || parts[0] !== "content") return { ok: false, error: invalid };
  if (parts.length === 1) return { ok: true, scope: "", pythonTarget: null };
  const [, subject, unit] = parts;
  if (!subject || subject.startsWith("_") || subject.startsWith(".")) return { ok: false, error: invalid };
  if (parts.length > 3 || (unit !== undefined && !/^\d{2}-/.test(unit))) return { ok: false, error: invalid };
  const scope = unit ? `content/${subject}/${unit}` : `content/${subject}`;
  return { ok: true, scope, pythonTarget: join(realRoot, ...scope.split("/")) };
}

function parseArgs(argv: readonly string[]): { root: string; targets: string[] } {
  let root = process.cwd();
  const targets: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") root = resolve(argv[++i] ?? ".");
    else if (a && !a.startsWith("-")) targets.push(a);
  }
  return { root, targets };
}

function main(): number {
  const { root, targets } = parseArgs(process.argv.slice(2));
  if (targets.length > 1) {
    console.error(`ERROR   una sola ruta a la vez (recibí ${targets.length}: ${targets.join(", ")})`);
    return 1;
  }
  const resolved = resolveScope(root, targets[0] ?? null);
  if (!resolved.ok) {
    console.error(`ERROR   ${resolved.error}`);
    return 1;
  }
  const { scope, pythonTarget } = resolved;
  const inScope = (path: string) => !scope || path === scope || path.startsWith(`${scope}/`);
  const show = (list: readonly ContentIssue[]) => list.filter((i) => inScope(i.file)).forEach((i) => console.log(formatIssue(i)));
  const failed: string[] = [];

  const raw = readRawContent(root);
  const known = [
    ...raw.subjects.map((s) => `content/${s.dir}`),
    ...raw.subjects.flatMap((s) => s.units.map((u) => `content/${s.dir}/${u.dir}`)),
  ];
  if (scope && !known.includes(scope)) {
    console.error(`ERROR   '${scope}' no tiene contenido que content:check conozca`);
    return 1;
  }

  // ---- Capa 1
  const { index, issues } = buildIndex(raw);
  const layer1 = issues.filter((i) => inScope(i.file));
  const errors1 = layer1.filter((i) => i.severity === "error");
  show(layer1);
  console.log(`Capa 1 · esquemas y reglas: ${errors1.length} error(es), ${layer1.length - errors1.length} aviso(s)\n`);
  if (errors1.length || (!index && !scope)) failed.push("1");

  // ---- Capa 2
  const lessons = raw.subjects.flatMap((s) => s.units.flatMap((u) => (u.lesson ? [u.lesson] : [])));
  const template = join(root, "content", "_plantillas", "leccion.mdx");
  if (existsSync(template)) lessons.push({ path: "content/_plantillas/leccion.mdx", text: readFileSync(template, "utf8") });
  const layer2: ContentIssue[] = [];
  let compiled = 0;
  for (const lesson of lessons.filter((l) => inScope(l.path))) {
    try {
      renderToStaticMarkup(createElement(LessonBody, { file: lesson.path, source: lesson.text }));
      compiled++;
    } catch (e) {
      const reason =
        e instanceof LessonCompileError
          ? `${e.line ? `línea ${e.line}: ` : ""}${e.reason}`
          : `no se pudo dibujar: ${e instanceof Error ? e.message : String(e)}`;
      layer2.push(issue("mdx-invalido", lesson.path, reason));
    }
  }
  show(layer2);
  console.log(`Capa 2 · lecciones: ${compiled} se dibujan, ${layer2.length} con error\n`);
  if (layer2.length) failed.push("2");

  // ---- Python (capas 3 y 4)
  const py = findPython();
  if (!py.ok) {
    console.log("ERROR   no encontré Python 3.11+ con sympy y PyYAML. Probé:");
    py.tried.forEach((t) => console.log(`        - ${t}`));
    console.log("        Instala las dependencias en un entorno virtual (README, paso 2):");
    console.log("          python3 -m venv .venv && .venv/bin/python -m pip install -r scripts/requirements.txt");
    console.log("        y luego activa el entorno (`source .venv/bin/activate`) o define CORTEX_PYTHON con la ruta absoluta a su python.");
    failed.push("3", "4");
  } else {
    // ---- Capa 3 (solo YAML: el plan es JSON y ambos lados lo leen con un parser de JSON)
    const yamlSources: YamlSource[] = [];
    for (const s of raw.subjects) {
      if (s.concepts) yamlSources.push(s.concepts);
      for (const u of s.units) {
        if (u.exercises) yamlSources.push(u.exercises);
        if (u.boss) yamlSources.push(u.boss);
        const fm = u.lesson ? splitFrontmatter(u.lesson.text) : null;
        if (u.lesson && fm) yamlSources.push({ path: `${u.lesson.path}#front-matter`, text: fm.yaml });
      }
    }
    const scoped = yamlSources.filter((s) => inScope(s.path.split("#")[0] ?? s.path));
    const diffs = compareWithPyYaml(scoped, py.python);
    for (const d of diffs) {
      console.log(
        formatIssue(
          issue(
            "yaml-distinto",
            d.path,
            `la app y PyYAML leen distinto este YAML (pon comillas a los textos ambiguos; ver docs/05). App: ${JSON.stringify(d.app).slice(0, 200)} · PyYAML: ${JSON.stringify(d.pyyaml).slice(0, 200)}`,
          ),
        ),
      );
    }
    console.log(`Capa 3 · paridad YAML con PyYAML: ${scoped.length} archivo(s), ${diffs.length} diferencia(s)\n`);
    if (diffs.length) failed.push("3");

    // ---- Capa 4
    console.log(`Capa 4 · verify_content.py (Python ${py.python.version}):`);
    const script = join(root, "scripts", "verify_content.py");
    const r = spawnSync(py.python.command, [...py.python.args, script, ...(pythonTarget ? [pythonTarget] : [])], {
      encoding: "utf8",
      env: { ...process.env, ...PYTHON_ENV },
      windowsHide: true,
    });
    process.stdout.write(r.stdout ?? "");
    process.stderr.write(r.stderr ?? "");
    if (r.status !== 0) failed.push("4");
  }

  console.log(failed.length ? `\n✗ content:check falló en la(s) capa(s): ${[...new Set(failed)].join(", ")}` : "\n✓ content:check en verde");
  return failed.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) process.exitCode = main();
