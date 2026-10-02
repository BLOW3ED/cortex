import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatIssue } from "./core/issues";
import { loadContent } from "./loader";

describe("loadContent sobre el repo real", () => {
  const { index, issues } = loadContent(process.cwd());

  // Lo que hay en disco, leído aparte (sin el loader): unidades y ids de ejercicio.
  const root = join(process.cwd(), "content");
  const unitDirs = readdirSync(root)
    .filter((s) => !s.startsWith("_") && statSync(join(root, s)).isDirectory())
    .flatMap((s) => readdirSync(join(root, s)).filter((u) => /^\d{2}-/.test(u)).map((u) => `${s}/${u}`))
    .sort();
  const idsOnDisk = unitDirs.flatMap((u) =>
    [...readFileSync(join(root, u, "ejercicios.yaml"), "utf8").matchAll(/^\s*- (?:\{ )?id: ([a-z]+-\d{2}-\d{3})/gm)].map((m) => m[1]),
  );

  it("no hay errores; solo avisos de programa_ref pendiente (uno por lección pendiente)", () => {
    expect(issues.filter((i) => i.severity === "error").map(formatIssue)).toEqual([]);
    const pending = unitDirs.filter((u) => /programa_ref: "pendiente"/.test(readFileSync(join(root, u, "leccion.mdx"), "utf8")));
    expect(issues.map((i) => i.code)).toEqual(pending.map(() => "programa-pendiente"));
  });

  it("indexa todas las unidades y todos los ejercicios que hay en disco", () => {
    const units = Object.values(index?.content ?? {}).flatMap((s) => s.units);
    expect(units.map((u) => u.key).sort()).toEqual(unitDirs);
    expect(Object.keys(index?.exercises ?? {}).sort()).toEqual([...idsOnDisk].sort());
    expect(idsOnDisk.length).toBeGreaterThanOrEqual(31);
  });

  it("solo cálculo y programación tienen contenido", () => {
    expect(index?.subjects.filter((s) => s.hasContent).map((s) => s.id)).toEqual(["programacion", "calculo"]);
  });

  it("lista las 45 entradas del mapa (41 materias + 4 espacios de optativa) y las 14 optativas", () => {
    const subjects = index?.subjects ?? [];
    expect(subjects.filter((s) => s.semester !== null)).toHaveLength(45);
    expect(subjects.filter((s) => s.electiveSlot)).toHaveLength(4);
    expect(subjects.filter((s) => s.elective)).toHaveLength(14);
  });

  it("las rutas del índice usan / aunque el sistema use otra cosa", () => {
    const unit = index?.content.calculo?.units[0];
    expect(unit?.lessonFile).toBe("content/calculo/01-limites/leccion.mdx");
  });
});
