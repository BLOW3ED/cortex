import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../core/yaml";
import { describe, expect, it } from "vitest";
import { bossSchema } from "./boss";
import { conceptsFileSchema } from "./concepts";
import { exercisesFileSchema, parseExercise } from "./exercise";
import { lessonFrontmatterSchema } from "./lesson";
import { planSchema } from "./plan";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const subjects = readdirSync(join(ROOT, "content")).filter((d) => !d.startsWith("_"));
const units = subjects.flatMap((s) =>
  readdirSync(join(ROOT, "content", s))
    .filter((d) => /^\d{2}-/.test(d))
    .map((u) => `content/${s}/${u}`),
);

describe("el contenido real cumple los esquemas", () => {
  it("hay contenido de cálculo y programación, y cada unidad trae sus 3 archivos", () => {
    expect(subjects.sort()).toEqual(["calculo", "programacion"]);
    expect(units).toContain("content/calculo/01-limites");
    expect(units).toContain("content/programacion/01-variables-y-tipos");
    for (const u of units) for (const f of ["leccion.mdx", "ejercicios.yaml", "jefe.yaml"]) expect(() => read(`${u}/${f}`), `${u}/${f}`).not.toThrow();
  });

  it("plan-2020.json", () => {
    const r = planSchema.safeParse(JSON.parse(read("curriculum/plan-2020.json")));
    expect(r.error?.issues ?? []).toEqual([]);
  });

  it.each(subjects)("content/%s/conceptos.yaml", (s) => {
    const r = conceptsFileSchema.safeParse(parseYaml(read(`content/${s}/conceptos.yaml`)));
    expect(r.error?.issues ?? []).toEqual([]);
  });

  it.each(units)("%s: ejercicios, jefe y front matter", (u) => {
    const file = exercisesFileSchema.parse(parseYaml(read(`${u}/ejercicios.yaml`)));
    const bad = file.ejercicios.map(parseExercise).filter((r) => !r.ok);
    expect(bad).toEqual([]);

    const boss = bossSchema.safeParse(parseYaml(read(`${u}/jefe.yaml`)));
    expect(boss.error?.issues ?? []).toEqual([]);

    const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(read(`${u}/leccion.mdx`));
    expect(fm).not.toBeNull();
    const lesson = lessonFrontmatterSchema.safeParse(parseYaml(fm?.[1] ?? ""));
    expect(lesson.error?.issues ?? []).toEqual([]);
  });

  it("la plantilla de lección solo falla por sus marcadores de ejemplo", () => {
    const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(read("content/_plantillas/leccion.mdx"));
    expect(fm).not.toBeNull();
    const lesson = lessonFrontmatterSchema.safeParse(parseYaml(fm?.[1] ?? ""));
    // "NN-nombre-unidad" es un marcador a propósito; cualquier otro error significa que la plantilla envejeció.
    expect(lesson.error?.issues.map((i) => i.path.join("."))).toEqual(["unidad"]);
  });
});

describe("esquemas · casos inválidos", () => {
  it("jefe: aprobado_minimo en (0, 1] y vidas enteras", () => {
    const ok = {
      unidad: "calculo/01-limites",
      nombre: "Jefe",
      vidas: 3,
      tiempo_segundos: 480,
      aprobado_minimo: 0.8,
      preguntas: { propias: ["calc-01-001"], repaso_de: [] },
      recompensa: { xp: 300, insignia: "domador-de-limites" },
    };
    expect(bossSchema.safeParse(ok).success).toBe(true);
    expect(bossSchema.safeParse({ ...ok, aprobado_minimo: 0 }).success).toBe(false);
    expect(bossSchema.safeParse({ ...ok, aprobado_minimo: 80 }).success).toBe(false);
    expect(bossSchema.safeParse({ ...ok, vidas: 2.5 }).success).toBe(false);
    expect(bossSchema.safeParse({ ...ok, recompensa: { xp: 300, insignia: "Domador" } }).success).toBe(false);
  });

  it("conceptos: id en kebab-case y prerrequisitos locales o materia:concepto", () => {
    const base = { materia: "calculo", conceptos: [{ id: "a", nombre: "A", prerequisitos: [] }] };
    expect(conceptsFileSchema.safeParse(base).success).toBe(true);
    const ext = { ...base, conceptos: [{ id: "b", nombre: "B", prerequisitos: ["algebra-lineal:matrices"] }] };
    expect(conceptsFileSchema.safeParse(ext).success).toBe(true);
    expect(conceptsFileSchema.safeParse({ ...base, conceptos: [{ id: "Mal_Id", nombre: "X" }] }).success).toBe(false);
  });

  it("front matter: duracion_min entera positiva", () => {
    const fm = {
      titulo: "T",
      materia: "calculo",
      unidad: "01-limites",
      duracion_min: 20,
      conceptos: ["a"],
      programa_ref: "pendiente",
    };
    expect(lessonFrontmatterSchema.safeParse(fm).success).toBe(true);
    expect(lessonFrontmatterSchema.safeParse({ ...fm, duracion_min: 0 }).success).toBe(false);
    expect(lessonFrontmatterSchema.safeParse({ ...fm, unidad: "limites" }).success).toBe(false);
  });
});
