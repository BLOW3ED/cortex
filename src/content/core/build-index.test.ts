import { describe, expect, it } from "vitest";
import { buildIndex } from "./build-index";
import type { RuleCode } from "./catalog";
import type { RawContent, RawSubject, RawUnit } from "./model";

// ---------------------------------------------------------------- fixture mínimo válido
const PLAN = JSON.stringify({
  programa: "P",
  plan: "2020",
  vigencia: "2020",
  unidades_academicas: ["UPIIZ"],
  fuente: "prueba",
  totales: { teoria: 6, practica: 3, horas: 9, creditos_tepic: 15 },
  tracks: { matematicas: "Matemáticas" },
  semestres: [
    {
      n: 1,
      creditos: 15,
      materias: [
        { id: "calculo", nombre: "Cálculo", teoria: 3, practica: 1.5, th: 4.5, creditos: 7.5, track: "matematicas", cortex_fase: 3 },
        { id: "fisica", nombre: "Física", teoria: 3, practica: 1.5, th: 4.5, creditos: 7.5, track: "matematicas", cortex_fase: null },
      ],
    },
  ],
  optativas: [{ id: "big-data", nombre: "Big data" }],
  optativas_horas: { teoria: 3, practica: 1.5, th: 4.5, creditos: 7.5 },
});

const CONCEPTS = `materia: calculo
conceptos:
  - id: a
    nombre: "A"
    prerequisitos: []
  - id: b
    nombre: "B"
    prerequisitos: [a]
`;

function exercise(n: number, extra = ""): string {
  const id = `calc-01-${String(n).padStart(3, "0")}`;
  return `  - id: ${id}
    tipo: numerico
    dificultad: ${n === 6 ? 4 : 2}
    conceptos: [a]
    enunciado: "Calcula ${n}."
    respuesta: ${n}
    verificar: { python: "${n}" }
    explicacion: "Es ${n}."
${extra}`;
}

const EXERCISES = `unidad: calculo/01-limites\nejercicios:\n${[1, 2, 3, 4, 5, 6].map((n) => exercise(n)).join("")}`;
const BOSS = `unidad: calculo/01-limites
nombre: "Jefe"
vidas: 3
tiempo_segundos: 300
aprobado_minimo: 0.8
preguntas:
  propias: [calc-01-001, calc-01-002, calc-01-003, calc-01-004, calc-01-005, calc-01-006]
  repaso_de: []
recompensa: { xp: 100, insignia: "jefe-uno" }
`;
const LESSON = `---
titulo: "Límites"
materia: calculo
unidad: 01-limites
duracion_min: 20
prerrequisitos: []
conceptos: [a, b]
programa_ref: "Unidad I"
---

<Predice pregunta="¿?" revela="!" />

Texto.

<Resumen>Uno.</Resumen>

<Feynman>Explica.</Feynman>
`;

function unit(dir = "01-limites", over: Partial<Record<"lesson" | "exercises" | "boss", string | null>> = {}): RawUnit {
  const f = (name: string, text: string | null | undefined, fallback: string) => {
    const t = text === undefined ? fallback : text;
    return t === null ? null : { path: `content/calculo/${dir}/${name}`, text: t };
  };
  return {
    dir,
    lesson: f("leccion.mdx", over.lesson, LESSON),
    exercises: f("ejercicios.yaml", over.exercises, EXERCISES),
    boss: f("jefe.yaml", over.boss, BOSS),
  };
}

function subject(over: Partial<RawSubject> = {}): RawSubject {
  return { dir: "calculo", concepts: { path: "content/calculo/conceptos.yaml", text: CONCEPTS }, units: [unit()], ...over };
}

function raw(over: Partial<RawContent> = {}): RawContent {
  return { plan: { path: "curriculum/plan-2020.json", text: PLAN }, subjects: [subject()], ...over };
}

const codes = (r: RawContent) => buildIndex(r).issues.map((i) => i.code);
const only = (r: RawContent): RuleCode[] => [...new Set(codes(r))];

// ---------------------------------------------------------------- pruebas
describe("buildIndex · fixture válido", () => {
  it("no da errores ni avisos y arma el índice", () => {
    const { index, issues } = buildIndex(raw());
    expect(issues).toEqual([]);
    expect(index?.content.calculo?.units.map((u) => u.key)).toEqual(["calculo/01-limites"]);
    expect(index?.content.calculo?.units[0]?.exercises).toHaveLength(6);
    expect(index?.exercises["calc-01-003"]).toEqual({ unitKey: "calculo/01-limites", retired: false });
  });

  it("resume las materias del plan y del catálogo de optativas", () => {
    const subjects = buildIndex(raw()).index?.subjects ?? [];
    expect(subjects.map((s) => [s.id, s.semester, s.hasContent, s.unitCount, s.elective])).toEqual([
      ["calculo", 1, true, 1, false],
      ["fisica", 1, false, 0, false],
      ["big-data", null, false, 0, true],
    ]);
  });

  it("CRLF y BOM dan el mismo resultado que LF", () => {
    const crlf = (t: string) => `﻿${t.replace(/\n/g, "\r\n")}`;
    const r = raw({
      subjects: [
        subject({
          concepts: { path: "content/calculo/conceptos.yaml", text: crlf(CONCEPTS) },
          units: [unit("01-limites", { lesson: crlf(LESSON), exercises: crlf(EXERCISES), boss: crlf(BOSS) })],
        }),
      ],
    });
    expect(buildIndex(r)).toEqual(buildIndex(raw()));
  });
});

describe("buildIndex · reglas compartidas con verify_content.py", () => {
  it("plan inexistente", () => {
    expect(buildIndex(raw({ plan: null })).index).toBeNull();
  });

  it("materia fuera del plan (aviso)", () => {
    const r = raw({ subjects: [subject({ dir: "quimica", concepts: null, units: [] })] });
    expect(only(r)).toEqual(["materia-fuera-del-plan", "sin-conceptos"]);
  });

  it("falta un archivo de la unidad", () => {
    expect(only(raw({ subjects: [subject({ units: [unit("01-limites", { boss: null })] })] }))).toEqual([
      "falta-archivo",
    ]);
  });

  it("YAML inválido", () => {
    expect(only(raw({ subjects: [subject({ units: [unit("01-limites", { boss: "nombre: [roto" })] })] }))).toEqual([
      "yaml-invalido",
    ]);
  });

  it("concepto duplicado, prerrequisito inexistente y ciclo", () => {
    const dup = CONCEPTS + `  - id: a\n    nombre: "A2"\n`;
    const missing = CONCEPTS.replace("prerequisitos: [a]", "prerequisitos: [zeta]");
    const cycle = CONCEPTS.replace("  - id: a\n    nombre: \"A\"\n    prerequisitos: []", "  - id: a\n    nombre: \"A\"\n    prerequisitos: [b]");
    const withConcepts = (text: string) => raw({ subjects: [subject({ concepts: { path: "content/calculo/conceptos.yaml", text } })] });
    expect(codes(withConcepts(dup))).toContain("concepto-duplicado");
    expect(only(withConcepts(missing))).toEqual(["prerrequisito-inexistente"]);
    expect(only(withConcepts(cycle))).toEqual(["ciclo-prerrequisitos"]);
  });

  it("los prerrequisitos de otra materia no se revisan en conceptos.yaml (igual que Python)", () => {
    const ext = CONCEPTS.replace("prerequisitos: [a]", "prerequisitos: [a, algebra-lineal:matrices]");
    expect(only(raw({ subjects: [subject({ concepts: { path: "content/calculo/conceptos.yaml", text: ext } })] }))).toEqual([]);
  });

  it("concepto inexistente en ejercicio y lección", () => {
    const ex = EXERCISES.replace("conceptos: [a]", "conceptos: [zeta]");
    const le = LESSON.replace("conceptos: [a, b]", "conceptos: [a, zeta]");
    expect(only(raw({ subjects: [subject({ units: [unit("01-limites", { exercises: ex })] })] }))).toEqual([
      "concepto-inexistente",
    ]);
    expect(only(raw({ subjects: [subject({ units: [unit("01-limites", { lesson: le })] })] }))).toEqual([
      "concepto-inexistente",
    ]);
  });

  it("sin front matter, campo faltante y programa pendiente (aviso)", () => {
    const sinFm = LESSON.replace(/^---[\s\S]*?---\n/, "");
    const sinTitulo = LESSON.replace('titulo: "Límites"\n', "");
    const pendiente = LESSON.replace('programa_ref: "Unidad I"', 'programa_ref: "Pendiente"');
    const u = (lesson: string) => raw({ subjects: [subject({ units: [unit("01-limites", { lesson })] })] });
    expect(only(u(sinFm))).toEqual(["sin-front-matter"]);
    expect(only(u(sinTitulo))).toEqual(["esquema"]);
    expect(only(u(pendiente))).toEqual(["programa-pendiente"]);
  });

  it("faltan componentes pedagógicos (aviso)", () => {
    const lesson = LESSON.replace("<Feynman>Explica.</Feynman>", "");
    expect(only(raw({ subjects: [subject({ units: [unit("01-limites", { lesson })] })] }))).toEqual([
      "falta-componente-pedagogico",
    ]);
  });

  it("id duplicado entre unidades (incluidos retirados)", () => {
    const second = unit("02-continuidad", {
      lesson: LESSON.replace("unidad: 01-limites", "unidad: 02-continuidad"),
      exercises: `unidad: calculo/02-continuidad\nejercicios:\n  - { id: calc-01-001, retirado: true }\n`,
      boss: null,
    });
    const r = raw({ subjects: [subject({ units: [unit(), second] })] });
    const issues = buildIndex(r).issues;
    expect(issues.find((i) => i.code === "id-duplicado")?.message).toContain("también en content/calculo/01-limites/ejercicios.yaml");
  });

  it("pocos ejercicios y muchas pistas (avisos)", () => {
    const pocos = `unidad: calculo/01-limites\nejercicios:\n${[1, 2, 3, 4, 5, 6].map((n) => exercise(n)).slice(0, 5).join("")}`;
    const bossPocos = BOSS.replace(", calc-01-006]", "]");
    expect(codes(raw({ subjects: [subject({ units: [unit("01-limites", { exercises: pocos, boss: bossPocos })] })] }))).toEqual(
      expect.arrayContaining(["pocos-ejercicios", "jefe-pocas-propias"]),
    );
    const pistas = EXERCISES.replace('explicacion: "Es 1."', 'explicacion: "Es 1."\n    pistas: ["1", "2", "3", "4"]');
    expect(only(raw({ subjects: [subject({ units: [unit("01-limites", { exercises: pistas })] })] }))).toEqual([
      "muchas-pistas",
    ]);
  });

  it("jefe: propia inexistente, repaso inexistente y sin pregunta difícil", () => {
    const u = (boss: string) => raw({ subjects: [subject({ units: [unit("01-limites", { boss })] })] });
    expect(only(u(BOSS.replace("calc-01-006]", "calc-01-099]")))).toEqual(["jefe-propia-inexistente", "jefe-sin-dificil"]);
    expect(only(u(BOSS.replace("repaso_de: []", "repaso_de: [calc-00-001]")))).toEqual(["jefe-repaso-inexistente"]);
    const facil = EXERCISES.replace("dificultad: 4", "dificultad: 3");
    expect(only(raw({ subjects: [subject({ units: [unit("01-limites", { exercises: facil })] })] }))).toEqual([
      "jefe-sin-dificil",
    ]);
  });
});

describe("buildIndex · reglas solo TS (D5)", () => {
  const u = (over: Partial<Record<"lesson" | "exercises" | "boss", string>>) =>
    raw({ subjects: [subject({ units: [unit("01-limites", over)] })] });

  it("clave desconocida (error de dedo)", () => {
    expect(only(u({ exercises: EXERCISES.replace("respuesta: 1\n", "respuesta: 1\n    tolerancai: 0.1\n") }))).toEqual([
      "clave-desconocida",
    ]);
  });

  it("lección y ejercicios fuera de lugar", () => {
    expect(only(u({ lesson: LESSON.replace("unidad: 01-limites", "unidad: 02-otra") }))).toEqual(["leccion-fuera-de-lugar"]);
    expect(only(u({ exercises: EXERCISES.replace("unidad: calculo/01-limites", "unidad: calculo/02-otra") }))).toEqual([
      "ejercicios-fuera-de-lugar",
    ]);
  });

  it("NN del id distinto al de la unidad", () => {
    const ex = EXERCISES.replace("id: calc-01-006", "id: calc-02-006");
    const boss = BOSS.replace("calc-01-006]", "calc-02-006]");
    expect(only(u({ exercises: ex, boss }))).toEqual(["id-unidad-distinta"]);
  });

  it("más de un prefijo en la materia", () => {
    const ex = EXERCISES.replace("id: calc-01-006", "id: calcu-01-006");
    const boss = BOSS.replace("calc-01-006]", "calcu-01-006]");
    expect(only(u({ exercises: ex, boss }))).toEqual(["prefijo-inconsistente"]);
  });

  it("prerrequisito de lección inexistente", () => {
    expect(only(u({ lesson: LESSON.replace("prerrequisitos: []", "prerrequisitos: [zeta]") }))).toEqual([
      "prerrequisito-leccion-inexistente",
    ]);
  });

  it("materia de conceptos.yaml distinta a la carpeta", () => {
    const r = raw({ subjects: [subject({ concepts: { path: "content/calculo/conceptos.yaml", text: CONCEPTS.replace("materia: calculo", "materia: fisica") } })] });
    expect(only(r)).toEqual(["materia-conceptos-distinta"]);
  });

  it("jefe con autoevaluación o con retirado", () => {
    const auto = EXERCISES.replace(
      /  - id: calc-01-005[\s\S]*?explicacion: "Es 5."\n/,
      `  - id: calc-01-005\n    tipo: autoevaluacion\n    dificultad: 2\n    conceptos: [a]\n    enunciado: "Explica."\n    rubrica: ["Idea"]\n    respuesta_modelo: "Así."\n    explicacion: "Es 5."\n`,
    );
    expect(only(u({ exercises: auto }))).toEqual(["jefe-autoevaluacion"]);
    const ret = EXERCISES.replace(/  - id: calc-01-005[\s\S]*?explicacion: "Es 5."\n/, "  - { id: calc-01-005, retirado: true }\n");
    expect(only(u({ exercises: ret }))).toEqual(["jefe-retirado"]);
  });

  it("repaso_de debe venir de una unidad anterior", () => {
    expect(only(u({ boss: BOSS.replace("repaso_de: []", "repaso_de: [calc-01-001]") }))).toEqual(["jefe-repaso-no-previo"]);
  });
});
