import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/** El módulo se importa de nuevo en cada prueba: `cache` de React no comparte índice entre ellas. */
async function freshServer() {
  vi.resetModules();
  return import("./server");
}

describe("getContentIndex (lo que usa `next build`)", () => {
  const dirs: string[] = [];
  afterEach(() => {
    vi.unstubAllEnvs();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("con el contenido real devuelve el índice aunque haya avisos", async () => {
    const { getContentIndex } = await freshServer();
    const index = getContentIndex();
    expect(index.subjects.filter((s) => s.hasContent).map((s) => s.id)).toEqual(["programacion", "calculo"]);
  });

  it("con un error de contenido lanza ContentValidationError (el build falla)", async () => {
    const root = mkdtempSync(join(tmpdir(), "cortex-server-"));
    dirs.push(root);
    cpSync("content", join(root, "content"), { recursive: true });
    cpSync("curriculum", join(root, "curriculum"), { recursive: true });
    const file = join(root, "content/programacion/01-variables-y-tipos/ejercicios.yaml");
    writeFileSync(file, readFileSync(file, "utf8").replace("  - id: prog-01-002\n", "  - id: prog-01-001\n"));
    vi.stubEnv("CORTEX_CONTENT_ROOT", root);

    const { getContentIndex, ContentValidationError } = await freshServer();
    let err: unknown;
    try {
      getContentIndex();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ContentValidationError);
    const issues = (err as InstanceType<typeof ContentValidationError>).issues;
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.severity === "error")).toBe(true);
    expect(issues.map((i) => i.code)).toContain("id-duplicado");
  });
});
