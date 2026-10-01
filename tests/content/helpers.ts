import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = process.cwd();
const TSX_CLI = createRequire(import.meta.url).resolve("tsx/cli");
const created: string[] = [];

/** Copia content/, el plan y verify_content.py a una raíz temporal (se borra con `cleanupRoots`). */
export function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "cortex-check-"));
  created.push(root);
  cpSync(join(REPO, "content"), join(root, "content"), { recursive: true });
  mkdirSync(join(root, "curriculum"));
  cpSync(join(REPO, "curriculum", "plan-2020.json"), join(root, "curriculum", "plan-2020.json"));
  mkdirSync(join(root, "scripts"));
  cpSync(join(REPO, "scripts", "verify_content.py"), join(root, "scripts", "verify_content.py"));
  return root;
}

/** Una carpeta temporal vacía (p. ej. para un PATH sin Python). */
export function emptyDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "cortex-empty-"));
  created.push(dir);
  return dir;
}

export function cleanupRoots(): void {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
}

export function edit(root: string, rel: string, change: (text: string) => string): string {
  const p = join(root, ...rel.split("/"));
  const before = readFileSync(p, "utf8");
  const after = change(before);
  if (after === before) throw new Error(`la edición no cambió ${rel}`);
  writeFileSync(p, after);
  return after;
}

export function contentCheck(root: string, args: readonly string[] = [], env: NodeJS.ProcessEnv = process.env) {
  const r = spawnSync(process.execPath, [TSX_CLI, "scripts/content-check.ts", "--root", root, ...args], {
    cwd: REPO,
    encoding: "utf8",
    env,
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
