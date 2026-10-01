import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { cleanupRoots, contentCheck, edit, emptyDir, makeRoot } from "./helpers";

const CALC = "content/calculo/01-limites";
const PROG = "content/programacion/01-variables-y-tipos";

afterAll(cleanupRoots);

describe("pnpm content:check", () => {
  it("el contenido real pasa las 4 capas", () => {
    const r = contentCheck(makeRoot());
    expect(r.out).toContain("✓ content:check en verde");
    expect(r.status).toBe(0);
  });

  it("una respuesta alterada falla en la capa 4 (verify_content.py)", () => {
    const root = makeRoot();
    edit(root, `${CALC}/ejercicios.yaml`, (t) => t.replace("respuesta: 3\n", "respuesta: 4\n"));
    const r = contentCheck(root);
    expect(r.status).toBe(1);
    expect(r.out).toContain("respuesta 4 pero la verificación da 3");
    expect(r.out).toContain("falló en la(s) capa(s): 4");
  });

  it("un componente desconocido falla en la capa 2 con su línea exacta", () => {
    const root = makeRoot();
    const text = edit(root, `${CALC}/leccion.mdx`, (t) => `${t}\n<Desconocido />\n`);
    const line = text.split("\n").findIndex((l) => l.includes("<Desconocido />")) + 1;
    const r = contentCheck(root);
    expect(r.status).toBe(1);
    expect(r.out).toContain(`${CALC}/leccion.mdx: línea ${line}: componente MDX no registrado <Desconocido>`);
    expect(r.out).toContain("falló en la(s) capa(s): 2");
  });

  it("LaTeX roto dentro de un atributo falla en la capa 2", () => {
    const root = makeRoot();
    edit(root, `${CALC}/leccion.mdx`, (t) => t.replace("\\dfrac{x^2-9}{x-3}$. No puedes", "\\dfrac{x^2-9}$. No puedes"));
    const r = contentCheck(root);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/<Predice pregunta>: KaTeX no puede dibujar/);
  });

  it("un id duplicado falla en las capas 1 y 4", () => {
    const root = makeRoot();
    edit(root, `${PROG}/ejercicios.yaml`, (t) => t.replace("  - id: prog-01-002\n", "  - id: prog-01-001\n"));
    const r = contentCheck(root);
    expect(r.status).toBe(1);
    expect(r.out).toContain("id duplicado 'prog-01-001'");
    expect(r.out).toMatch(/falló en la\(s\) capa\(s\): 1, 4/);
  });

  it("con una ruta (materia, unidad o archivo) solo reporta lo que está bajo ella", () => {
    const root = makeRoot();
    edit(root, `${PROG}/ejercicios.yaml`, (t) => t.replace("  - id: prog-01-002\n", "  - id: prog-01-001\n"));
    expect(contentCheck(root, ["content/calculo"]).status).toBe(0);
    expect(contentCheck(root, ["content/programacion"]).status).toBe(1);
    expect(contentCheck(root, [`${PROG}/ejercicios.yaml`]).status).toBe(1);
  });

  it("una ruta escrita con otras mayúsculas o por un enlace se resuelve a la carpeta real", () => {
    const root = makeRoot();
    edit(root, `${CALC}/ejercicios.yaml`, (t) => t.replace("    tolerancia: 0\n", "    tolerancai: 0\n"));
    symlinkSync(join(root, "content", "calculo"), join(root, "content", "Calculo"));
    const r = contentCheck(root, ["content/Calculo"]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("campo desconocido 'tolerancai'");
  });

  it.each([".", "curriculum", "content/_plantillas", "content/quimica"])("rechaza la ruta %s", (target) => {
    const r = contentCheck(makeRoot(), [target]);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/^ERROR/m);
  });

  it("rechaza más de una ruta", () => {
    expect(contentCheck(makeRoot(), ["content/calculo", "content/programacion"]).out).toContain("una sola ruta a la vez");
  });

  it("un YAML que la app y PyYAML leen distinto falla en la capa 3", () => {
    const root = makeRoot();
    edit(root, "content/calculo/conceptos.yaml", (t) => t.replace(/^notacion: .*$/m, "notacion: !!binary aGVsbG8="));
    const r = contentCheck(root);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/la app y PyYAML leen distinto/);
    expect(r.out).toMatch(/falló en la\(s\) capa\(s\): .*3/);
  });

  it("un plan con tabuladores (JSON válido) no es falso positivo de la capa 3", () => {
    const root = makeRoot();
    edit(root, "curriculum/plan-2020.json", (t) => JSON.stringify(JSON.parse(t), null, "\t"));
    expect(contentCheck(root).status).toBe(0);
  });

  it("sin Python falla y explica qué hacer", () => {
    const env = { ...process.env, PATH: emptyDir(), CORTEX_PYTHON: "/no/existe" };
    const r = contentCheck(makeRoot(), [], env);
    expect(r.status).toBe(1);
    expect(r.out).toContain("no encontré Python 3.11+");
    expect(r.out).toContain("pip install -r scripts/requirements.txt");
  });
});
