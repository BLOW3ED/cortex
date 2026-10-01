import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => m.ruleId ?? "fatal");
}

describe("fronteras de pureza (ESLint)", () => {
  const pureFile = "src/engine/xp.ts";

  it("permite importar solo tipos de React en una zona pura", async () => {
    const ids = await ruleIds('import type { ReactNode } from "react";\nexport type X = ReactNode;\n', pureFile);
    expect(ids).toEqual([]);
  });

  it("rechaza importar valores de React en una zona pura", async () => {
    const ids = await ruleIds('import { useState } from "react";\nexport const f = useState;\n', pureFile);
    expect(ids).toContain("@typescript-eslint/no-restricted-imports");
  });

  it("rechaza Dexie y componentes en una zona pura", async () => {
    const dexie = await ruleIds('import Dexie from "dexie";\nexport const d = Dexie;\n', pureFile);
    const comp = await ruleIds('import { X } from "@/components/x";\nexport const c = X;\n', pureFile);
    expect(dexie).toContain("@typescript-eslint/no-restricted-imports");
    expect(comp).toContain("@typescript-eslint/no-restricted-imports");
  });

  it("rechaza globals del navegador en una zona pura", async () => {
    const ids = await ruleIds("export const w = window.innerWidth;\n", pureFile);
    expect(ids).toContain("no-restricted-globals");
  });

  it("permite React fuera de las zonas puras", async () => {
    const ids = await ruleIds('import { useState } from "react";\nexport const f = useState;\n', "src/components/x.ts");
    expect(ids).toEqual([]);
  });

  it("prohíbe next/font/google en todo el repo", async () => {
    const code = 'import { Inter } from "next/font/google";\nexport const f = Inter;\n';
    expect(await ruleIds(code, "src/app/layout.tsx")).toContain("no-restricted-imports");
    expect(await ruleIds(code, pureFile)).toContain("@typescript-eslint/no-restricted-imports");
  });

  it("prohíbe any explícito", async () => {
    const ids = await ruleIds("export const f = (x: any) => x;\n", "src/lib/x.ts");
    expect(ids).toContain("@typescript-eslint/no-explicit-any");
  });
});
