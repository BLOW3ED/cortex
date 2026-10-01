import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { findPython } from "../../scripts/lib/find-python";

type Fake = Record<string, { status: number | null; stdout: string }>;
/** Runner falso: solo responde si la sonda de verdad importa sympy y yaml. */
const runner = (fake: Fake) => (command: string, args: readonly string[]) => {
  const code = args[args.indexOf("-c") + 1] ?? "";
  if (!/import [^\n]*\bsympy\b/.test(code) || !/\byaml\b/.test(code)) return { status: 1, stdout: "" };
  return fake[[command, ...args.filter((a) => a === "-3")].join(" ")] ?? { status: null, stdout: "", error: new Error("ENOENT") };
};

describe("findPython", () => {
  it("prefiere CORTEX_PYTHON", () => {
    const r = findPython({ CORTEX_PYTHON: "/opt/py" }, runner({ "/opt/py": { status: 0, stdout: "3.12\n" }, python3: { status: 0, stdout: "3.11" } }));
    expect(r).toEqual({ ok: true, python: { command: "/opt/py", args: [], version: "3.12" } });
  });

  it("usa python3 si no hay variable", () => {
    const r = findPython({}, runner({ python3: { status: 0, stdout: "3.11" } }));
    expect(r.ok && r.python.command).toBe("python3");
  });

  it("en Windows cae a `py -3`", () => {
    const r = findPython({}, runner({ "py -3": { status: 0, stdout: "3.13" } }));
    expect(r).toEqual({ ok: true, python: { command: "py", args: ["-3"], version: "3.13" } });
  });

  it("rechaza Python viejo o roto y explica qué probó", () => {
    const r = findPython({}, runner({ python3: { status: 0, stdout: "3.9" }, python: { status: 1, stdout: "" } }));
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

describe("findPython con un Python real sin sympy", () => {
  const dir = mkdtempSync(join(tmpdir(), "cortex-venv-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("descarta un entorno virtual vacío y sigue con el siguiente", () => {
    const made = spawnSync("python3", ["-m", "venv", "--without-pip", dir], { encoding: "utf8" });
    expect(made.status, made.stderr).toBe(0);
    const venvPython = process.platform === "win32" ? join(dir, "Scripts", "python.exe") : join(dir, "bin", "python");
    const r = findPython({ CORTEX_PYTHON: venvPython, PATH: process.env.PATH });
    expect(r.ok).toBe(true);
    expect(r.ok && r.python.command).not.toBe(venvPython);
  });
});
