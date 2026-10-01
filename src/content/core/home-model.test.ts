import { describe, expect, it } from "vitest";
import { loadContent } from "../loader";
import { buildHomeModel } from "./home-model";

const { index } = loadContent(process.cwd());
if (!index) throw new Error("el contenido real debe cargar");
const home = buildHomeModel(index);

describe("buildHomeModel con el plan 2020 real", () => {
  it("agrupa los 8 semestres en orden, con los créditos del plan", () => {
    expect(home.semesters.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(home.semesters.map((s) => s.credits)).toEqual(index.plan.semestres.map((s) => s.creditos));
  });

  it("cada semestre trae las materias del JSON, en su orden", () => {
    for (const sem of index.plan.semestres) {
      const group = home.semesters.find((g) => g.n === sem.n);
      expect(group?.subjects.map((s) => s.id)).toEqual(sem.materias.map((m) => m.id));
    }
  });

  it("cuenta 41 materias (sin los 4 espacios de optativa) y 14 optativas", () => {
    expect(home.totals.subjects).toBe(41);
    expect(home.electives).toHaveLength(14);
  });

  it("solo cálculo y programación tienen contenido, con una lección cada una", () => {
    expect(home.totals.withContent).toBe(2);
    expect(home.lessons.map((l) => [l.subjectId, l.unit.slug])).toEqual([
      ["calculo", "01-limites"],
      ["programacion", "01-variables-y-tipos"],
    ]);
    expect(home.lessons[0]?.unit.title).toBe("Límites: acercarse sin llegar");
  });

  it("Mecánica y electromagnetismo aparece como Fase 4", () => {
    const mec = home.semesters[0]?.subjects.find((s) => s.id === "mecanica-electromagnetismo");
    expect(mec?.cortexPhase).toBe(4);
  });
});
