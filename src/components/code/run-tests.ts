"use client";

import type { CTest, PythonTest } from "@/content/schema";
import { type GradeSummary, gradeC, gradePython } from "@/engine/code/grade";
import { runC } from "@/runners/c-client";
import { runPython } from "@/runners/python-client";

/** Corre los tests de un código en el runner que toca y lo califica como verify_content.py. */
export type TestRun =
  | { readonly status: "graded"; readonly grade: GradeSummary; readonly stdout: string }
  | { readonly status: "unavailable"; readonly message: string };

export async function runCodeTests(language: "python" | "c", code: string, tests: readonly (PythonTest | CTest)[]): Promise<TestRun> {
  if (language === "python") {
    const pyTests = tests as readonly PythonTest[];
    const r = await runPython(code, pyTests.map((t) => t.expr));
    if (r.status === "timeout") {
      return {
        status: "graded",
        stdout: "",
        grade: gradePython(pyTests, { ok: false, error: `se tardó más de ${r.seconds} s (¿un ciclo que no termina?)`, stdout: "", results: [] }),
      };
    }
    if (r.status === "unavailable") return { status: "unavailable", message: `No pude cargar Python: ${r.message}` };
    return { status: "graded", grade: gradePython(pyTests, r.result), stdout: r.result.stdout };
  }
  const cTests = tests as readonly CTest[];
  const r = await runC(code, cTests.map((t) => t.entrada ?? ""));
  if (r.status === "unavailable") return { status: "unavailable", message: r.message };
  return { status: "graded", grade: gradeC(cTests, r.response), stdout: r.response.runs[0]?.stdout ?? "" };
}
