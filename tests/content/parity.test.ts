import { spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findPython, PYTHON_ENV } from "../../scripts/lib/find-python";
import { RULES, type RuleCode, type Severity } from "../../src/content/core/catalog";
import { loadContent } from "../../src/content/loader";

/*
 * Paridad de reglas: cada caso es una raíz mínima válida con UNA violación. Para las reglas
 * compartidas (`python: true`), la app (Zod + reglas) y verify_content.py deben dar la misma
 * severidad. Para las reglas "solo TS", la app da error y Python no.
 */

const PLAN = {
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
        { id: "fisica", nombre: "Física", teoria: 3, practica: 1.5, th: 4.5, creditos: 7.5, track: "matematicas", cortex_fase: 4 },
      ],
    },
  ],
  optativas: [],
  optativas_horas: { teoria: 3, practica: 1.5, th: 4.5, creditos: 7.5 },
};

const CONCEPTS = `materia: calculo
conceptos:
  - id: a
    nombre: "A"
    prerequisitos: []
  - id: b
    nombre: "B"
    prerequisitos: [a]
`;

const ex = (n: number, unit = "01") => `  - id: calc-${unit}-${String(n).padStart(3, "0")}
    tipo: numerico
    dificultad: ${n === 6 ? 4 : 2}
    conceptos: [a]
    enunciado: "Calcula ${n}."
    respuesta: ${n}
    tolerancia: 0
    verificar: { python: "${n}" }
    explicacion: "Es ${n}."
`;
const EXERCISES = `unidad: calculo/01-limites\nejercicios:\n${[1, 2, 3, 4, 5, 6].map((n) => ex(n)).join("")}`;
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

<Resumen>Uno.</Resumen>

<Feynman>Explica.</Feynman>
`;

type Files = Record<string, string | null>;
const U = "content/calculo/01-limites";
const BASE: Files = {
  "curriculum/plan-2020.json": JSON.stringify(PLAN, null, 1),
  "content/calculo/conceptos.yaml": CONCEPTS,
  [`${U}/leccion.mdx`]: LESSON,
  [`${U}/ejercicios.yaml`]: EXERCISES,
  [`${U}/jefe.yaml`]: BOSS,
};

interface Case {
  readonly name: string;
  readonly rules: readonly RuleCode[];
  /** Línea de verify_content.py que corresponde a la violación (solo reglas compartidas). */
  readonly python?: RegExp;
  readonly files: (base: Files) => Files;
}

const replace = (path: string, from: string | RegExp, to: string) => (b: Files): Files => {
  const before = b[path] ?? "";
  const after = before.replace(from, to);
  if (after === before) throw new Error(`el caso no cambió ${path}`);
  return { ...b, [path]: after };
};
const combine = (...fs: ((b: Files) => Files)[]) => (b: Files) => fs.reduce((acc, f) => f(acc), b);
const exercisesWith = (extra: string) => (b: Files): Files => ({ ...b, [`${U}/ejercicios.yaml`]: `${EXERCISES}${extra}` });
const planWith = (mutate: (p: typeof PLAN) => void) => (b: Files): Files => {
  const p = structuredClone(PLAN);
  mutate(p);
  return { ...b, "curriculum/plan-2020.json": JSON.stringify(p, null, 1) };
};
const EX = `${U}/ejercicios.yaml`;
const BOSS_FILE = `${U}/jefe.yaml`;
const LESSON_FILE = `${U}/leccion.mdx`;

const CASES: readonly Case[] = [
  // ---------------------------------------------------------------- reglas compartidas
  { name: "YAML inválido", rules: ["yaml-invalido"], python: /YAML inválido/, files: (b) => ({ ...b, [BOSS_FILE]: "nombre: [roto" }) },
  { name: "falta jefe.yaml", rules: ["falta-archivo"], python: /falta jefe\.yaml/, files: (b) => ({ ...b, [BOSS_FILE]: null }) },
  { name: "sin conceptos.yaml", rules: ["sin-conceptos"], python: /no hay conceptos\.yaml/, files: (b) => ({ ...b, "content/calculo/conceptos.yaml": null }) },
  {
    name: "materia fuera del plan",
    rules: ["materia-fuera-del-plan"],
    python: /no existe en curriculum/,
    files: (b) => ({ ...b, "content/quimica/conceptos.yaml": "materia: quimica\nconceptos: []\n" }),
  },
  { name: "ejercicio sin explicación", rules: ["esquema"], python: /falta 'explicacion'/, files: replace(EX, '    explicacion: "Es 1."\n', "") },
  { name: "tipo desconocido", rules: ["esquema"], python: /tipo desconocido/, files: replace(EX, /tipo: numerico/, "tipo: dibujo") },
  { name: "dificultad 6", rules: ["esquema"], python: /dificultad debe ser entero/, files: replace(EX, "dificultad: 2", "dificultad: 6") },
  { name: "id mal formado", rules: ["esquema"], python: /id no cumple/, files: combine(replace(EX, "id: calc-01-001", "id: calc-1-001"), replace(BOSS_FILE, "[calc-01-001,", "[calc-1-001,")) },
  { name: "conceptos vacío", rules: ["esquema"], python: /conceptos vacío/, files: replace(EX, /conceptos: \[a\]/, "conceptos: []") },
  { name: "numérico sin verificar", rules: ["esquema"], python: /numerico sin 'verificar'/, files: replace(EX, '    verificar: { python: "1" }\n', "") },
  {
    name: "opciones repetidas",
    rules: ["esquema"],
    python: /opciones repetidas/,
    files: exercisesWith(`  - id: calc-01-007\n    tipo: opcion_multiple\n    dificultad: 1\n    conceptos: [a]\n    enunciado: "¿?"\n    opciones: ["1", "1", "2"]\n    correcta: 0\n    explicacion: "x"\n`),
  },
  {
    name: "correcta fuera de rango",
    rules: ["esquema"],
    python: /'correcta' fuera de rango/,
    files: exercisesWith(`  - id: calc-01-007\n    tipo: opcion_multiple\n    dificultad: 1\n    conceptos: [a]\n    enunciado: "¿?"\n    opciones: ["1", "2"]\n    correcta: 2\n    explicacion: "x"\n`),
  },
  {
    name: "huecos distintos a respuestas",
    rules: ["esquema"],
    python: /huecos \(2\) != respuestas \(1\)/,
    files: exercisesWith(`  - id: calc-01-007\n    tipo: completar\n    dificultad: 1\n    conceptos: [a]\n    enunciado: "Completa"\n    texto: "a ___ b ___"\n    respuestas: ["x"]\n    explicacion: "x"\n`),
  },
  {
    name: "ordenar con 2 elementos",
    rules: ["esquema"],
    python: /ordenar requiere/,
    files: exercisesWith(`  - id: calc-01-007\n    tipo: ordenar\n    dificultad: 1\n    conceptos: [a]\n    enunciado: "Ordena"\n    elementos: ["a", "b"]\n    explicacion: "x"\n`),
  },
  {
    name: "autoevaluación sin rúbrica",
    rules: ["esquema"],
    python: /requiere 'rubrica'/,
    files: exercisesWith(`  - id: calc-01-007\n    tipo: autoevaluacion\n    dificultad: 1\n    conceptos: [a]\n    enunciado: "Explica"\n    respuesta_modelo: "Así."\n    explicacion: "x"\n`),
  },
  {
    name: "código sin tests",
    rules: ["esquema"],
    python: /codigo requiere 'tests'/,
    files: exercisesWith(`  - id: calc-01-007\n    tipo: codigo\n    lenguaje: python\n    dificultad: 1\n    conceptos: [a]\n    enunciado: "Escribe f"\n    plantilla: "def f(): pass"\n    solucion: "def f(): return 1"\n    explicacion: "x"\n`),
  },
  { name: "front matter sin título", rules: ["esquema"], python: /front matter sin 'titulo'/, files: replace(LESSON_FILE, 'titulo: "Límites"\n', "") },
  { name: "jefe sin vidas", rules: ["esquema"], python: /falta 'vidas'/, files: replace(BOSS_FILE, "vidas: 3\n", "") },
  { name: "concepto duplicado", rules: ["concepto-duplicado"], python: /concepto duplicado 'a'/, files: (b) => ({ ...b, "content/calculo/conceptos.yaml": `${CONCEPTS}  - id: a\n    nombre: "A2"\n` }) },
  { name: "prerrequisito inexistente", rules: ["prerrequisito-inexistente"], python: /requiere inexistente 'zeta'/, files: replace("content/calculo/conceptos.yaml", "prerequisitos: [a]", "prerequisitos: [zeta]") },
  {
    name: "ciclo de prerrequisitos",
    rules: ["ciclo-prerrequisitos"],
    python: /ciclo de prerrequisitos/,
    files: replace("content/calculo/conceptos.yaml", '  - id: a\n    nombre: "A"\n    prerequisitos: []', '  - id: a\n    nombre: "A"\n    prerequisitos: [b]'),
  },
  { name: "concepto inexistente en ejercicio", rules: ["concepto-inexistente"], python: /concepto inexistente 'zeta'/, files: replace(EX, /conceptos: \[a\]/, "conceptos: [zeta]") },
  { name: "concepto inexistente en lección", rules: ["concepto-inexistente"], python: /concepto inexistente 'zeta'/, files: replace(LESSON_FILE, "conceptos: [a, b]", "conceptos: [a, zeta]") },
  { name: "lección sin front matter", rules: ["sin-front-matter"], python: /sin front matter/, files: replace(LESSON_FILE, /^---[\s\S]*?---\n/, "") },
  { name: "programa pendiente", rules: ["programa-pendiente"], python: /programa_ref pendiente/, files: replace(LESSON_FILE, 'programa_ref: "Unidad I"', 'programa_ref: "pendiente"') },
  { name: "sin <Feynman>", rules: ["falta-componente-pedagogico"], python: /no usa <Feynman>/, files: replace(LESSON_FILE, "<Feynman>Explica.</Feynman>\n", "") },
  { name: "id duplicado", rules: ["id-duplicado"], python: /id duplicado 'calc-01-001'/, files: exercisesWith(ex(1)) },
  {
    name: "pocos ejercicios y pocas propias",
    rules: ["pocos-ejercicios", "jefe-pocas-propias"],
    python: /menos de 6 ejercicios/,
    files: combine(
      (b) => ({ ...b, [EX]: `unidad: calculo/01-limites\nejercicios:\n${[1, 2, 3, 4, 5].map((n) => ex(n)).join("")}`.replace("dificultad: 2\n    conceptos: [a]\n    enunciado: \"Calcula 5.\"", "dificultad: 4\n    conceptos: [a]\n    enunciado: \"Calcula 5.\"") }),
      replace(BOSS_FILE, ", calc-01-006]", "]"),
    ),
  },
  { name: "jefe con pocas propias", rules: ["jefe-pocas-propias"], python: /menos de 6 preguntas propias/, files: replace(BOSS_FILE, "calc-01-001, ", "") },
  { name: "más de 3 pistas", rules: ["muchas-pistas"], python: /más de 3 pistas/, files: replace(EX, '    explicacion: "Es 1."\n', '    explicacion: "Es 1."\n    pistas: ["1", "2", "3", "4"]\n') },
  { name: "propia inexistente", rules: ["jefe-propia-inexistente"], python: /pregunta propia 'calc-01-099'/, files: replace(BOSS_FILE, "calc-01-005,", "calc-01-099,") },
  { name: "repaso inexistente", rules: ["jefe-repaso-inexistente"], python: /repaso_de 'calc-00-001' no existe/, files: replace(BOSS_FILE, "repaso_de: []", "repaso_de: [calc-00-001]") },
  { name: "jefe sin pregunta difícil", rules: ["jefe-sin-dificil"], python: /ninguna pregunta de dificultad/, files: replace(EX, "dificultad: 4", "dificultad: 3") },
  { name: "plan: teoría + práctica ≠ th", rules: ["plan-inconsistente"], python: /teoria\+practica != th/, files: planWith((p) => ((p.semestres[0]?.materias[0] ?? { th: 0 }).th = 9)) },
  { name: "plan: créditos del semestre", rules: ["plan-inconsistente"], python: /semestre 1: créditos suman/, files: planWith((p) => ((p.semestres[0] ?? { creditos: 0 }).creditos = 99)) },
  { name: "plan: totales", rules: ["plan-inconsistente"], python: /totales no cuadran/, files: planWith((p) => (p.totales.creditos_tepic = 1)) },
  { name: "dificultad 4.0", rules: ["esquema"], python: /dificultad debe ser entero/, files: replace(EX, "dificultad: 4", "dificultad: 4.0") },
  {
    name: "correcta 0.0",
    rules: ["esquema"],
    python: /'correcta' fuera de rango/,
    files: exercisesWith(`  - id: calc-01-007\n    tipo: opcion_multiple\n    dificultad: 1\n    conceptos: [a]\n    enunciado: "¿?"\n    opciones: ["1", "2"]\n    correcta: 0.0\n    explicacion: "x"\n`),
  },
  { name: "lección con BOM", rules: ["sin-front-matter"], python: /sin front matter/, files: (b) => ({ ...b, [LESSON_FILE]: `\uFEFF${LESSON}` }) },

  // ---------------------------------------------------------------- reglas solo TS (D5)
  { name: "campo con error de dedo", rules: ["clave-desconocida"], files: replace(EX, "    tolerancia: 0\n", "    tolerancai: 0\n") },
  { name: "vidas no enteras", rules: ["esquema"], files: replace(BOSS_FILE, "vidas: 3", "vidas: 2.5") },
  { name: "lección en otra carpeta", rules: ["leccion-fuera-de-lugar"], files: replace(LESSON_FILE, "unidad: 01-limites", "unidad: 02-otra") },
  { name: "ejercicios de otra unidad", rules: ["ejercicios-fuera-de-lugar"], files: replace(EX, "unidad: calculo/01-limites", "unidad: calculo/02-otra") },
  { name: "NN del id distinto", rules: ["id-unidad-distinta"], files: combine(replace(EX, "id: calc-01-006", "id: calc-02-006"), replace(BOSS_FILE, "calc-01-006]", "calc-02-006]")) },
  { name: "dos prefijos", rules: ["prefijo-inconsistente"], files: combine(replace(EX, "id: calc-01-006", "id: calcu-01-006"), replace(BOSS_FILE, "calc-01-006]", "calcu-01-006]")) },
  { name: "prerrequisito de lección inexistente", rules: ["prerrequisito-leccion-inexistente"], files: replace(LESSON_FILE, "prerrequisitos: []", "prerrequisitos: [zeta]") },
  { name: "conceptos.yaml de otra materia", rules: ["materia-conceptos-distinta"], files: replace("content/calculo/conceptos.yaml", "materia: calculo", "materia: fisica") },
  { name: "repaso de la misma unidad", rules: ["jefe-repaso-no-previo"], files: replace(BOSS_FILE, "repaso_de: []", "repaso_de: [calc-01-001]") },
  {
    name: "jefe con autoevaluación",
    rules: ["jefe-autoevaluacion"],
    files: replace(EX, /  - id: calc-01-005[\s\S]*?explicacion: "Es 5."\n/, `  - id: calc-01-005\n    tipo: autoevaluacion\n    dificultad: 2\n    conceptos: [a]\n    enunciado: "Explica."\n    rubrica: ["Idea"]\n    respuesta_modelo: "Así."\n    explicacion: "Es 5."\n`),
  },
  { name: "jefe con retirado", rules: ["jefe-retirado"], files: replace(EX, /  - id: calc-01-005[\s\S]*?explicacion: "Es 5."\n/, "  - { id: calc-01-005, retirado: true }\n") },
  { name: "texto comparado sin comillas (respuesta: 3.0)", rules: ["esquema"], files: exercisesWith(`  - id: calc-01-007\n    tipo: predecir_salida\n    lenguaje: python\n    dificultad: 1\n    conceptos: [a]\n    enunciado: "¿Qué imprime?"\n    codigo: "print(6/2)"\n    respuesta: 3.0\n    explicacion: "x"\n`) },
  { name: "clave desconocida en el encabezado", rules: ["clave-desconocida"], files: replace(EX, "unidad: calculo/01-limites\n", "unidad: calculo/01-limites\nnotas: borrador\n") },
  {
    name: "prerrequisito de otra materia inexistente",
    rules: ["prerrequisito-externo-inexistente"],
    files: combine(
      replace("content/calculo/conceptos.yaml", "prerequisitos: [a]", "prerequisitos: [a, fisica:fuerza]"),
      (b) => ({ ...b, "content/fisica/conceptos.yaml": "materia: fisica\nconceptos:\n  - id: vector\n    nombre: V\n" }),
    ),
  },
];

/** Reglas que se prueban en otro lado (render de lecciones y paridad YAML de content:check). */
const COVERED_ELSEWHERE: readonly RuleCode[] = ["mdx-invalido", "yaml-distinto", "texto-invalido"];

// ---------------------------------------------------------------- arnés
const py = findPython();
if (!py.ok) throw new Error("las pruebas de paridad necesitan Python 3.11+ con sympy y PyYAML");
const SCRIPT = join(process.cwd(), "scripts", "verify_content.py");

function writeRoot(files: Files): string {
  const root = mkdtempSync(join(tmpdir(), "cortex-parity-"));
  for (const [rel, text] of Object.entries(files)) {
    if (text === null) continue;
    const p = join(root, ...rel.split("/"));
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, text);
  }
  mkdirSync(join(root, "scripts"));
  cpSync(SCRIPT, join(root, "scripts", "verify_content.py"));
  return root;
}

function runPython(root: string): Promise<{ status: number | null; lines: string[] }> {
  if (!py.ok) throw new Error("sin Python");
  const { command, args } = py.python;
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args, join(root, "scripts", "verify_content.py")], {
      env: { ...process.env, ...PYTHON_ENV },
      windowsHide: true,
    });
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString("utf8")));
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, lines: out.split("\n").filter((l) => /^(ERROR|AVISO)/.test(l)) }));
  });
}

const pySeverity = (line: string): Severity => (line.startsWith("ERROR") ? "error" : "warning");

async function evaluate(files: Files) {
  const root = writeRoot(files);
  try {
    const ts = loadContent(root).issues;
    const python = await runPython(root);
    return { ts, python };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- pruebas
describe("paridad de reglas Zod ↔ verify_content.py", () => {
  it("la raíz base está limpia en ambos", async () => {
    const { ts, python } = await evaluate(BASE);
    expect(ts).toEqual([]);
    expect(python.lines).toEqual([]);
    expect(python.status).toBe(0);
  });

  it("hay al menos un caso por regla del catálogo", () => {
    const covered = new Set([...CASES.flatMap((c) => c.rules), ...COVERED_ELSEWHERE]);
    expect(Object.keys(RULES).filter((r) => !covered.has(r as RuleCode))).toEqual([]);
  });

  it.concurrent.each(CASES.map((c) => [c.name, c] as const))("%s", async (_name, c) => {
    const { ts, python } = await evaluate(c.files(BASE));
    const tsCodes = [...new Set(ts.map((i) => i.code))].sort();
    expect(tsCodes).toEqual([...c.rules].sort());

    for (const rule of c.rules) {
      const spec = RULES[rule];
      expect(ts.filter((i) => i.code === rule).every((i) => i.severity === spec.severity)).toBe(true);
    }

    const shared = c.rules.every((r) => RULES[r].python) && c.python;
    if (shared && c.python) {
      const line = python.lines.find((l) => c.python?.test(l));
      expect(line, `verify_content.py no reportó ${c.python} · salida: ${python.lines.join(" | ")}`).toBeDefined();
      const tsSeverity = RULES[c.rules[0] as RuleCode].severity;
      expect(pySeverity(line ?? "")).toBe(tsSeverity);
      expect(python.status).toBe(c.rules.some((r) => RULES[r].severity === "error") ? 1 : 0);
    } else {
      // Regla solo TS: la app da error y Python no ve error.
      expect(ts.some((i) => i.severity === "error")).toBe(true);
      expect(python.lines.filter((l) => l.startsWith("ERROR")), python.lines.join(" | ")).toEqual([]);
      expect(python.status).toBe(0);
    }
  });
});
