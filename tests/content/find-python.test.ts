import { describe, expect, it } from "vitest";
import { findPython } from "../../scripts/lib/find-python";

type Fake = Record<string, { status: number | null; stdout: string }>;
const runner = (fake: Fake) => (command: string, args: readonly string[]) =>
  fake[[command, ...args.filter((a) => a === "-3")].join(" ")] ?? { status: null, stdout: "", error: new Error("ENOENT") };

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

  it("rechaza Python viejo o sin sympy y explica qué probó", () => {
    const r = findPython({}, runner({ python3: { status: 0, stdout: "3.9" }, python: { status: 1, stdout: "" } }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.tried).toEqual([
      "python3 (Python 3.9: se necesita 3.11+)",
      "python (no sirve o le falta sympy/PyYAML)",
      "py -3 (no sirve o le falta sympy/PyYAML)",
    ]);
  });

  it("encuentra el Python real de este equipo", () => {
    const r = findPython();
    expect(r.ok).toBe(true);
  });
});
