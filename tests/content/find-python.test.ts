import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { findPython, REPO_VENV } from "../../scripts/lib/find-python";

const temps: string[] = [];
afterAll(() => temps.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));
const tempDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
};
const pythonIn = (venv: string) => (process.platform === "win32" ? join(venv, "Scripts", "python.exe") : join(venv, "bin", "python"));
/** Aísla las pruebas con runner falso del `.venv` real del repo (si Carlo lo creó). */
const NO_VENV = { CORTEX_VENV: tempDir("cortex-sin-venv-") };

type Fake = Record<string, { status: number | null; stdout: string }>;
/** Runner falso: solo responde si la sonda de verdad importa sympy y yaml. */
const runner = (fake: Fake) => (command: string, args: readonly string[]) => {
  const code = args[args.indexOf("-c") + 1] ?? "";
  if (!/import [^\n]*\bsympy\b/.test(code) || !/\byaml\b/.test(code)) return { status: 1, stdout: "" };
  return fake[[command, ...args.filter((a) => a === "-3")].join(" ")] ?? { status: null, stdout: "", error: new Error("ENOENT") };
};

describe("findPython", () => {
  it("prefiere CORTEX_PYTHON", () => {
    const r = findPython({ ...NO_VENV, CORTEX_PYTHON: "/opt/py" }, runner({ "/opt/py": { status: 0, stdout: "3.12\n" }, python3: { status: 0, stdout: "3.11" } }));
    expect(r).toEqual({ ok: true, python: { command: "/opt/py", args: [], version: "3.12" } });
  });

  it("usa python3 si no hay variable", () => {
    const r = findPython(NO_VENV, runner({ python3: { status: 0, stdout: "3.11" } }));
    expect(r.ok && r.python.command).toBe("python3");
  });

  it("en Windows cae a `py -3`", () => {
    const r = findPython(NO_VENV, runner({ "py -3": { status: 0, stdout: "3.13" } }));
    expect(r).toEqual({ ok: true, python: { command: "py", args: ["-3"], version: "3.13" } });
  });

  it("rechaza Python viejo o roto y explica qué probó", () => {
    const r = findPython(NO_VENV, runner({ python3: { status: 0, stdout: "3.9" }, python: { status: 1, stdout: "" } }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.tried).toEqual([
      "python3 (Python 3.9: se necesita 3.11+)",
      "python (no sirve o le falta sympy/PyYAML)",
      "py -3 (no sirve o le falta sympy/PyYAML)",
    ]);
  });

  it("encuentra el Python real de este equipo", () => {
    expect(findPython().ok).toBe(true);
  });
});

describe("findPython con el .venv del repo", () => {
  /** Un venv falso: solo el archivo del intérprete; el runner falso decide qué responde. */
  const fakeVenv = () => {
    const venv = tempDir("cortex-venv-falso-");
    const python = pythonIn(venv);
    mkdirSync(dirname(python));
    writeFileSync(python, "");
    return { venv, python };
  };

  it("lo busca en la raíz del repo, no en la carpeta desde donde se corre", () => {
    expect(REPO_VENV).toBe(join(process.cwd(), ".venv"));
  });

  it("lo usa antes que python3, sin tener que activarlo", () => {
    const { venv, python } = fakeVenv();
    const r = findPython({ CORTEX_VENV: venv }, runner({ [python]: { status: 0, stdout: "3.13" }, python3: { status: 0, stdout: "3.11" } }));
    expect(r).toEqual({ ok: true, python: { command: python, args: [], version: "3.13" } });
  });

  it("CORTEX_PYTHON le gana", () => {
    const { venv, python } = fakeVenv();
    const r = findPython({ CORTEX_VENV: venv, CORTEX_PYTHON: "/opt/py" }, runner({ "/opt/py": { status: 0, stdout: "3.12" }, [python]: { status: 0, stdout: "3.13" } }));
    expect(r.ok && r.python.command).toBe("/opt/py");
  });

  it("si no sirve, lo reporta y sigue con python3", () => {
    const { venv, python } = fakeVenv();
    const r = findPython({ CORTEX_VENV: venv }, runner({ python3: { status: 0, stdout: "3.11" } }));
    expect(r.ok && r.python.command).toBe("python3");
    const none = findPython({ CORTEX_VENV: venv }, runner({}));
    expect(!none.ok && none.tried[0]).toBe(`${python} (no sirve o le falta sympy/PyYAML)`);
  });

  // Crear enlaces simbólicos en Windows pide permisos de administrador.
  it.skipIf(process.platform === "win32")("un venv con el enlace roto (su Python base ya no existe) también sale en lo que probó", () => {
    const venv = tempDir("cortex-venv-roto-");
    mkdirSync(join(venv, "bin"));
    symlinkSync(join(venv, "no-existe", "python3.13"), join(venv, "bin", "python"));
    const r = findPython({ CORTEX_VENV: venv }, runner({}));
    expect(!r.ok && r.tried[0]).toBe(`${join(venv, "bin", "python")} (no sirve o le falta sympy/PyYAML)`);
  });
});

describe("findPython con un Python real sin sympy", () => {
  it("descarta un entorno virtual vacío y sigue con el siguiente", () => {
    const dir = tempDir("cortex-venv-");
    // Con el mismo Python que encuentra la app (en Windows suele no haber `python3`).
    const real = findPython();
    if (!real.ok) throw new Error(`no hay Python para crear el entorno: ${real.tried.join(", ")}`);
    const made = spawnSync(real.python.command, [...real.python.args, "-m", "venv", "--without-pip", dir], { encoding: "utf8" });
    expect(made.status, made.stderr).toBe(0);
    const venvPython = pythonIn(dir);
    const r = findPython({ CORTEX_PYTHON: venvPython, PATH: process.env.PATH });
    expect(r.ok).toBe(true);
    expect(r.ok && r.python.command).not.toBe(venvPython);
  });
});
