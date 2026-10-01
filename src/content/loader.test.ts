import { describe, expect, it } from "vitest";
import { formatIssue } from "./core/issues";
import { loadContent } from "./loader";

describe("loadContent sobre el repo real", () => {
  const { index, issues } = loadContent(process.cwd());

  it("no hay errores; solo los 2 avisos de programa_ref pendiente", () => {
    expect(issues.filter((i) => i.severity === "error").map(formatIssue)).toEqual([]);
    expect(issues.map((i) => i.code)).toEqual(["programa-pendiente", "programa-pendiente"]);
  });

  it("indexa 2 unidades y 24 ejercicios", () => {
    const units = Object.values(index?.content ?? {}).flatMap((s) => s.units);
    expect(units.map((u) => u.key)).toEqual(["calculo/01-limites", "programacion/01-variables-y-tipos"]);
    expect(Object.keys(index?.exercises ?? {})).toHaveLength(24);
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
