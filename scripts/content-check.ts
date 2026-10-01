/**
 * `pnpm content:check [ruta] [--root <dir>]`
 *
 * Verifica el contenido en 4 capas y sale con 1 si cualquiera falla:
 *   1. Esquemas Zod y reglas cruzadas sobre el índice completo (lo mismo que usa `next build`).
 *   2. Cada lección compila y se dibuja (MDX, componentes, KaTeX, escapes).
 *   3. Paridad YAML: la app y PyYAML leen igual cada archivo.
 *   4. `scripts/verify_content.py` (corrección de respuestas con sympy / ejecución).
 * Con una ruta, las capas 1–3 cargan todo pero solo reportan lo que está bajo esa ruta.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LessonBody } from "../src/components/lessons/lesson-body";
import { buildIndex, splitFrontmatter } from "../src/content/core/build-index";
import { type ContentIssue, formatIssue, issue } from "../src/content/core/issues";
import { readRawContent } from "../src/content/loader";
import { LessonCompileError } from "../src/content/mdx";
import { findPython, PYTHON_ENV } from "./lib/find-python";
import { compareWithPyYaml, type YamlSource } from "./lib/yaml-parity";
import { spawnSync } from "node:child_process";

function parseArgs(argv: readonly string[]): { root: string; target: string | null } {
  let root = process.cwd();
  let target: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") root = resolve(argv[++i] ?? ".");
    else if (a && !a.startsWith("-")) target = a;
  }
  return { root, target };
}

function main(): number {
  const { root, target } = parseArgs(process.argv.slice(2));
  const failed: string[] = [];

  let scope = "";
  if (target) {
    const abs = resolve(root, target);
    if (!existsSync(abs)) {
      console.error(`ERROR   la ruta '${target}' no existe`);
      return 1;
    }
    scope = relative(root, abs).split(/[\\/]/).join("/").replace(/\/$/, "");
  }
  const inScope = (path: string) => !scope || path === scope || path.startsWith(`${scope}/`);
  const show = (list: readonly ContentIssue[]) => list.filter((i) => inScope(i.file)).forEach((i) => console.log(formatIssue(i)));

  const raw = readRawContent(root);

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
      const where = e instanceof LessonCompileError ? e.message : `${lesson.path}: ${e instanceof Error ? e.message : String(e)}`;
      layer2.push(issue("mdx-invalido", lesson.path, where.replace(`${lesson.path}`, "línea")));
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
    console.log("        Instálalo y corre `pip install -r scripts/requirements.txt` (o define CORTEX_PYTHON).");
    failed.push("3", "4");
  } else {
    // ---- Capa 3
    const yamlSources: YamlSource[] = [];
    if (raw.plan) yamlSources.push({ path: raw.plan.path, text: raw.plan.text });
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
    const r = spawnSync(py.python.command, [...py.python.args, script, ...(target ? [resolve(root, target)] : [])], {
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

process.exitCode = main();
