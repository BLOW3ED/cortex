import "server-only";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CRunResponse, ProcResult } from "@/engine/code/types";

/**
 * Runner de C local (ADR-005). Compila con `gcc -Wall -O0 ... -lm` (lo mismo que
 * verify_content.py) en una carpeta temporal única y ejecuta el programa por cada entrada:
 *  - límite de tiempo por ejecución y de bytes de salida (se mata todo el grupo de procesos);
 *  - sin red y sin escribir fuera de su carpeta: `sandbox-exec` en macOS o `unshare -rn` en Linux
 *    cuando el sistema lo permite;
 *  - `ulimit` de CPU y de tamaño de archivo; entorno mínimo; la carpeta se borra al terminar.
 * Nunca usa un shell con texto del usuario: el código se escribe a un archivo y los argumentos
 * van en arreglos.
 */

export const C_LIMITS = {
  codeBytes: 64_000,
  inputs: 30,
  inputBytes: 64_000,
  outputBytes: 64_000,
  compileMs: 20_000,
  runMs: 3_000,
} as const;

export type { CRunResponse, ProcResult } from "@/engine/code/types";

export type Sandbox = "sandbox-exec" | "unshare" | "ninguno";

let detected: Sandbox | null = null;

/** Qué aislamiento de red ofrece este sistema (se detecta una vez). */
export function detectSandbox(): Sandbox {
  if (detected) return detected;
  if (process.platform === "darwin" && existsSync("/usr/bin/sandbox-exec")) detected = "sandbox-exec";
  else if (process.platform === "linux" && spawnSync("unshare", ["-rn", "true"], { timeout: 3000 }).status === 0) detected = "unshare";
  else detected = "ninguno";
  return detected;
}

/** Límite de CPU (s) y de archivos (bloques de 512 B ≈ 10 MB); el ejecutable llega como $0, sin interpolar. */
const LIMIT_SCRIPT = 'ulimit -t 5 2>/dev/null; ulimit -f 20480 2>/dev/null; exec "$0"';

function sandboxCommand(exe: string, dir: string): [string, string[]] {
  const sh: [string, string[]] = ["/bin/sh", ["-c", LIMIT_SCRIPT, exe]];
  switch (detectSandbox()) {
    case "sandbox-exec": {
      const real = realpathSync(dir).replace(/["\\]/g, "");
      const profile = [
        "(version 1)",
        "(allow default)",
        "(deny network*)",
        "(deny file-write*)",
        `(allow file-write* (subpath "${real}") (literal "/dev/null") (literal "/dev/stdout") (literal "/dev/stderr"))`,
      ].join("");
      return ["/usr/bin/sandbox-exec", ["-p", profile, sh[0], ...sh[1]]];
    }
    case "unshare":
      return ["unshare", ["-rn", sh[0], ...sh[1]]];
    default:
      return sh;
  }
}

function killGroup(child: ChildProcess): void {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

/** Corre un proceso con límite de tiempo y de salida. */
export function runLimited(
  cmd: string,
  args: readonly string[],
  opts: { cwd: string; input?: string; timeoutMs: number; maxBytes: number; env: Record<string, string> },
): Promise<ProcResult> {
  return new Promise((resolve) => {
    // Entorno mínimo a propósito (Next declara NODE_ENV obligatorio en el tipo; el hijo no lo necesita).
    const env = opts.env as unknown as NodeJS.ProcessEnv;
    const child = spawn(cmd, [...args], { cwd: opts.cwd, env, detached: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let bytes = 0;
    let timedOut = false;
    let truncated = false;
    let done = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child);
    }, opts.timeoutMs);
    const take = (chunk: Buffer, to: "out" | "err") => {
      if (truncated) return;
      bytes += chunk.length;
      if (bytes > opts.maxBytes) {
        truncated = true;
        killGroup(child);
        return;
      }
      if (to === "out") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
    };
    child.stdout.on("data", (c: Buffer) => take(c, "out"));
    child.stderr.on("data", (c: Buffer) => take(c, "err"));
    const finish = (exitCode: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode, timedOut, truncated });
    };
    child.on("error", (e) => {
      stderr += e.message;
      finish(null);
    });
    child.on("close", (code) => finish(code));
    child.stdin.on("error", () => {});
    child.stdin.end(opts.input ?? "");
  });
}

// Una compilación/ejecución a la vez: nadie puede saturar la máquina con peticiones en paralelo.
let queue: Promise<unknown> = Promise.resolve();

export function compileAndRun(code: string, inputs: readonly string[]): Promise<CRunResponse> {
  const job = queue.then(() => doCompileAndRun(code, inputs));
  queue = job.catch(() => undefined);
  return job;
}

async function doCompileAndRun(code: string, inputs: readonly string[]): Promise<CRunResponse> {
  const dir = await mkdtemp(join(tmpdir(), "cortex-c-"));
  const clean = (s: string) => s.split(dir).join(".").slice(0, 8000);
  try {
    const src = join(dir, "main.c");
    const exe = join(dir, "main");
    await writeFile(src, code, "utf8");
    const compile = await runLimited("gcc", ["-Wall", "-O0", "-o", exe, src, "-lm"], {
      cwd: dir,
      timeoutMs: C_LIMITS.compileMs,
      maxBytes: C_LIMITS.outputBytes,
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: dir, TMPDIR: dir, LANG: "C" },
    });
    if (compile.exitCode !== 0 || compile.timedOut) {
      const why = compile.timedOut ? "la compilación tardó demasiado" : compile.stderr || compile.stdout || "no compila";
      return { compile: { ok: false, output: clean(why) }, runs: [] };
    }
    const [cmd, args] = sandboxCommand(exe, dir);
    const runs: ProcResult[] = [];
    for (const input of inputs) {
      const r = await runLimited(cmd, args, {
        cwd: dir,
        input,
        timeoutMs: C_LIMITS.runMs,
        maxBytes: C_LIMITS.outputBytes,
        env: { PATH: "/usr/bin:/bin", LANG: "C" },
      });
      runs.push({ ...r, stderr: clean(r.stderr) });
    }
    return { compile: { ok: true, output: clean(compile.stderr) }, runs };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function gccAvailable(): boolean {
  return spawnSync("gcc", ["--version"], { timeout: 5000 }).status === 0;
}

// ---------------------------------------------------------------- candados de acceso (ADR-005)
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export type Access = { readonly ok: true } | { readonly ok: false; readonly status: number; readonly message: string };

/** ¿El runner está habilitado en este proceso? Solo con `CORTEX_LOCAL=1`. */
export function runnerEnabled(env: NodeJS.ProcessEnv = process.env): Access {
  return env.CORTEX_LOCAL === "1"
    ? { ok: true }
    : { ok: false, status: 403, message: "El runner de C está apagado: arranca la app con `pnpm dev` o `pnpm start` en tu máquina (CORTEX_LOCAL=1)." };
}

/**
 * Revisa una petición: host local (contra DNS rebinding), mismo origen (contra que otra página
 * del navegador la dispare) y encabezado propio (fuerza la verificación previa de CORS).
 */
export function checkRequest(headers: Headers, method: string, env: NodeJS.ProcessEnv = process.env): Access {
  const enabled = runnerEnabled(env);
  if (!enabled.ok) return enabled;
  const host = headers.get("host") ?? "";
  const hostname = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : (host.split(":")[0] ?? "");
  if (!LOCAL_HOSTS.has(hostname)) return { ok: false, status: 403, message: "Solo desde localhost." };
  if (method === "POST") {
    if (headers.get("x-cortex-runner") !== "1") return { ok: false, status: 403, message: "Falta el encabezado del runner." };
    const origin = headers.get("origin");
    if (origin && origin !== `http://${host}`) return { ok: false, status: 403, message: "Origen no permitido." };
    const site = headers.get("sec-fetch-site");
    if (site && site !== "same-origin") return { ok: false, status: 403, message: "Solo desde la propia app." };
    if (!(headers.get("content-type") ?? "").startsWith("application/json")) return { ok: false, status: 415, message: "Se espera JSON." };
  }
  return { ok: true };
}

/** Valida el cuerpo de la petición; devuelve el código y las entradas o un mensaje. */
export function parseRunBody(body: unknown): { ok: true; code: string; inputs: string[] } | { ok: false; message: string } {
  if (typeof body !== "object" || body === null) return { ok: false, message: "Cuerpo inválido." };
  const { code, inputs } = body as { code?: unknown; inputs?: unknown };
  if (typeof code !== "string" || !code.trim()) return { ok: false, message: "Falta el código." };
  if (Buffer.byteLength(code, "utf8") > C_LIMITS.codeBytes) return { ok: false, message: "El código es demasiado grande." };
  if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > C_LIMITS.inputs) return { ok: false, message: "Entradas inválidas." };
  if (!inputs.every((i): i is string => typeof i === "string" && Buffer.byteLength(i, "utf8") <= C_LIMITS.inputBytes)) {
    return { ok: false, message: "Entradas inválidas." };
  }
  return { ok: true, code, inputs };
}
