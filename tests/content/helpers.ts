import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = process.cwd();
const TSX_CLI = createRequire(import.meta.url).resolve("tsx/cli");

/** Copia content/, curriculum/ y verify_content.py a una raíz temporal. */
export function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "cortex-check-"));
  cpSync(join(REPO, "content"), join(root, "content"), { recursive: true });
  cpSync(join(REPO, "curriculum"), join(root, "curriculum"), { recursive: true });
  mkdirSync(join(root, "scripts"));
  cpSync(join(REPO, "scripts", "verify_content.py"), join(root, "scripts", "verify_content.py"));
  return root;
}

export function edit(root: string, rel: string, change: (text: string) => string): void {
  const p = join(root, ...rel.split("/"));
  const before = readFileSync(p, "utf8");
  const after = change(before);
  if (after === before) throw new Error(`la edición no cambió ${rel}`);
  writeFileSync(p, after);
}

export function contentCheck(root: string, args: readonly string[] = [], env: NodeJS.ProcessEnv = process.env) {
  const r = spawnSync(process.execPath, [TSX_CLI, "scripts/content-check.ts", "--root", root, ...args], {
    cwd: REPO,
    encoding: "utf8",
    env,
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
