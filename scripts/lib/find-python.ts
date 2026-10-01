import { spawnSync } from "node:child_process";

export interface PythonCommand {
  readonly command: string;
  readonly args: readonly string[];
  readonly version: string;
}

export type FindPythonResult = { ok: true; python: PythonCommand } | { ok: false; tried: readonly string[] };

/** Entorno para que Python escriba UTF-8 aunque la consola de Windows use cp1252. */
export const PYTHON_ENV = { PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" } as const;

const PROBE = "import sys, sympy, yaml; print('%d.%d' % sys.version_info[:2])";

type Runner = (command: string, args: readonly string[]) => { status: number | null; stdout: string; error?: Error };

const defaultRunner: Runner = (command, args) => {
  const r = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 15_000,
    env: { ...process.env, ...PYTHON_ENV },
    windowsHide: true,
  });
  return { status: r.status, stdout: r.stdout ?? "", error: r.error };
};

/**
 * Busca un Python 3.11+ con sympy y PyYAML. Orden: `CORTEX_PYTHON`, `python3`, `python`, `py -3`.
 * Cada sonda tiene timeout (el `python` de la Microsoft Store abre la tienda en vez de correr).
 */
export function findPython(
  env: Readonly<Record<string, string | undefined>> = process.env,
  run: Runner = defaultRunner,
): FindPythonResult {
  const candidates: [string, string[]][] = [];
  if (env.CORTEX_PYTHON) candidates.push([env.CORTEX_PYTHON, []]);
  candidates.push(["python3", []], ["python", []], ["py", ["-3"]]);

  const tried: string[] = [];
  for (const [command, pre] of candidates) {
    const label = [command, ...pre].join(" ");
    const r = run(command, [...pre, "-c", PROBE]);
    const version = r.stdout.trim().split(/\s+/).pop() ?? "";
    const [major, minor] = version.split(".").map(Number);
    if (r.status === 0 && major === 3 && (minor ?? 0) >= 11) {
      return { ok: true, python: { command, args: pre, version } };
    }
    tried.push(r.status === 0 ? `${label} (Python ${version}: se necesita 3.11+)` : `${label} (no sirve o le falta sympy/PyYAML)`);
  }
  return { ok: false, tried };
}
