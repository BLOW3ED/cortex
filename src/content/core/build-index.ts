import {
  bossSchema,
  conceptsFileSchema,
  type ConceptsFile,
  type Exercise,
  exercisesFileSchema,
  lessonFrontmatterSchema,
  parseExercise,
  type Plan,
  planSchema,
  type RetiredExercise,
  UNIT_KEY_RE,
} from "../schema";
import { type ContentIssue, fromZod, issue } from "./issues";
import type {
  ContentIndex,
  ExerciseLocation,
  RawContent,
  RawFile,
  RawSubject,
  RawUnit,
  SubjectContent,
  SubjectSummary,
  UnitEntry,
} from "./model";
import { integralFloats, normalizeText, parseYaml } from "./yaml";

export interface BuildResult {
  /** `null` solo si `plan-2020.json` falta o es inválido. */
  readonly index: ContentIndex | null;
  readonly issues: readonly ContentIssue[];
}

/** Front matter: misma regex que verify_content.py, sobre texto normalizado a LF. */
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;
const PEDAGOGY_TAGS = ["Predice", "Resumen", "Feynman"] as const;

/** Campos enteros: PyYAML lee `4.0` como flotante y verify_content.py lo rechaza; en JS `4.0 === 4`. */
const INT_FIELDS_EXERCISES = new Set(["dificultad", "correcta"]);
const INT_FIELDS_BOSS = new Set(["vidas", "tiempo_segundos", "xp"]);
const INT_FIELDS_LESSON = new Set(["duracion_min"]);

/** Tolerancia de las sumas del plan (igual que verify_content.py). */
const PLAN_EPS = 1e-9;

export function splitFrontmatter(text: string): { yaml: string; body: string } | null {
  const m = FRONTMATTER_RE.exec(normalizeText(text));
  if (!m) return null;
  return { yaml: m[1] ?? "", body: normalizeText(text).slice(m[0].length) };
}

/** `calc-01-001` → `{ prefix: "calc", unit: 1 }`. */
function idParts(id: string): { prefix: string; unit: number } | null {
  const m = /^([a-z]+)-(\d{2})-\d{3}$/.exec(id);
  return m ? { prefix: m[1] ?? "", unit: Number(m[2]) } : null;
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const stringArray = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : null;
const firstLine = (e: unknown) => (e instanceof Error ? e.message.split("\n")[0] : String(e));

/** Valida todo el contenido y construye el índice. Función pura: no toca el disco. */
export function buildIndex(raw: RawContent): BuildResult {
  const issues: ContentIssue[] = [];
  const add = (i: ContentIssue | ContentIssue[]) => (Array.isArray(i) ? issues.push(...i) : issues.push(i));

  const readYaml = (file: RawFile): { ok: true; data: unknown } | { ok: false } => {
    try {
      return { ok: true, data: parseYaml(normalizeText(file.text)) };
    } catch (e) {
      add(issue("yaml-invalido", file.path, `YAML inválido: ${firstLine(e)}`));
      return { ok: false };
    }
  };
  const integerFields = (text: string, fields: ReadonlySet<string>, file: string) => {
    for (const f of integralFloats(normalizeText(text), fields)) {
      add(issue("esquema", file, `${f.field}: debe ser un entero sin decimales (escribiste ${f.source})`));
    }
  };

  // ---------------------------------------------------------------- plan
  let plan: Plan | null = null;
  if (!raw.plan) {
    add(issue("esquema", "curriculum/plan-2020.json", "no existe"));
  } else {
    try {
      const r = planSchema.safeParse(JSON.parse(raw.plan.text));
      if (r.success) {
        plan = r.data;
        add(checkPlanSums(r.data, raw.plan.path));
      } else add(fromZod(r.error.issues, raw.plan.path));
    } catch (e) {
      add(issue("esquema", raw.plan.path, `JSON inválido: ${firstLine(e)}`));
    }
  }
  const planIds = new Set(plan?.semestres.flatMap((s) => s.materias.map((m) => m.id)) ?? []);

  // ---------------------------------------------------------------- conceptos (todas las materias primero)
  const conceptsBySubject = new Map<string, ConceptsResult>();
  for (const subject of raw.subjects) {
    const dirPath = `content/${subject.dir}`;
    if (plan && !planIds.has(subject.dir)) {
      add(issue("materia-fuera-del-plan", dirPath, "la materia no existe en curriculum/plan-2020.json"));
    }
    conceptsBySubject.set(subject.dir, checkConcepts(subject, add, readYaml));
  }
  // Prerrequisitos de otra materia (`materia:concepto`): solo si esa materia está cargada (regla solo TS).
  for (const [subjectId, c] of conceptsBySubject) {
    for (const [id, refs] of c.prereq) {
      for (const ref of refs) {
        if (!ref.includes(":")) continue;
        const [other = "", local = ""] = ref.split(":", 2);
        const ids = conceptsBySubject.get(other)?.ids;
        if (ids && !ids.has(local)) {
          add(issue("prerrequisito-externo-inexistente", `content/${subjectId}/conceptos.yaml`, `'${id}' requiere inexistente '${ref}'`));
        }
      }
    }
  }

  // ---------------------------------------------------------------- unidades
  const locator = new Map<string, ExerciseLocation & { file: string; exercise: Exercise | RetiredExercise | null }>();
  const content: Record<string, SubjectContent> = {};
  const bossRefs: { file: string; unitKey: string; subjectId: string; number: number; ids: readonly string[] }[] = [];
  const bossOwn: { file: string; ids: readonly string[] }[] = [];

  for (const subject of raw.subjects) {
    const concepts = conceptsBySubject.get(subject.dir) ?? EMPTY_CONCEPTS;
    const units: UnitEntry[] = [];
    const prefixes = new Map<string, string>();

    const checkUnit = (subj: RawSubject, u: RawUnit, conceptIds: Set<string> | null): UnitEntry | null => {
      const unitPath = `content/${subj.dir}/${u.dir}`;
      const unitKey = `${subj.dir}/${u.dir}`;
      const unitNumber = Number(u.dir.slice(0, 2));
      for (const [name, f] of [
        ["leccion.mdx", u.lesson],
        ["ejercicios.yaml", u.exercises],
        ["jefe.yaml", u.boss],
      ] as const) {
        if (!f) add(issue("falta-archivo", unitPath, `falta ${name}`));
      }

      // ---- lección
      let frontmatter: UnitEntry["frontmatter"] | null = null;
      if (u.lesson) {
        const lessonPath = u.lesson.path;
        if (u.lesson.text.startsWith("﻿")) {
          // verify_content.py lee sin quitar el BOM y no encuentra el `---` inicial.
          add(issue("sin-front-matter", lessonPath, "sin front matter: el archivo empieza con BOM; guárdalo como UTF-8 sin BOM"));
        }
        const split = splitFrontmatter(u.lesson.text);
        if (!split) {
          add(issue("sin-front-matter", lessonPath, "sin front matter"));
        } else {
          let fmRaw: unknown;
          try {
            fmRaw = parseYaml(split.yaml);
          } catch (e) {
            add(issue("yaml-invalido", lessonPath, `front matter inválido: ${firstLine(e)}`));
          }
          if (fmRaw !== undefined) {
            integerFields(split.yaml, INT_FIELDS_LESSON, lessonPath);
            const ref = asRecord(fmRaw)?.programa_ref;
            if (typeof ref === "string" && ref.trim().toLowerCase() === "pendiente") {
              add(issue("programa-pendiente", lessonPath, "programa_ref pendiente (alinear con el programa oficial)"));
            }
            const r = lessonFrontmatterSchema.safeParse(fmRaw);
            if (!r.success) {
              add(fromZod(r.error.issues, lessonPath, undefined, "front matter"));
            } else {
              frontmatter = r.data;
              if (r.data.materia !== subj.dir || r.data.unidad !== u.dir) {
                add(
                  issue(
                    "leccion-fuera-de-lugar",
                    lessonPath,
                    `el front matter dice ${r.data.materia}/${r.data.unidad} pero el archivo está en ${unitKey}`,
                  ),
                );
              }
              if (conceptIds) {
                for (const c of r.data.conceptos) {
                  if (!conceptIds.has(c)) add(issue("concepto-inexistente", lessonPath, `concepto inexistente '${c}'`));
                }
              }
              for (const p of r.data.prerrequisitos ?? []) {
                const [other, local] = p.includes(":") ? (p.split(":", 2) as [string, string]) : [subj.dir, p];
                const ids = conceptsBySubject.get(other)?.ids;
                if (ids && !ids.has(local)) {
                  add(issue("prerrequisito-leccion-inexistente", lessonPath, `prerrequisito inexistente '${p}'`));
                }
              }
            }
          }
        }
        for (const tag of PEDAGOGY_TAGS) {
          if (!u.lesson.text.includes(`<${tag}`)) add(issue("falta-componente-pedagogico", lessonPath, `no usa <${tag}>`));
        }
      }

      // ---- ejercicios
      const exercises: Exercise[] = [];
      const retired: RetiredExercise[] = [];
      const idsInUnit = new Set<string>();
      const difficulty = new Map<string, number>();
      let exercisesOk = false;
      if (u.exercises) {
        const file = u.exercises.path;
        const y = readYaml(u.exercises);
        if (y.ok) {
          integerFields(u.exercises.text, INT_FIELDS_EXERCISES, file);
          // El encabezado se valida aparte: un error ahí no debe apagar la revisión de cada ejercicio.
          const head = exercisesFileSchema.safeParse(y.data);
          if (!head.success) add(fromZod(head.error.issues, file));
          const data = asRecord(y.data);
          const list = Array.isArray(data?.ejercicios) ? (data.ejercicios as unknown[]) : null;
          if (list) {
            exercisesOk = true;
            const declared = data?.unidad;
            if (typeof declared === "string" && UNIT_KEY_RE.test(declared) && declared !== unitKey) {
              add(issue("ejercicios-fuera-de-lugar", file, `unidad '${declared}' pero el archivo está en ${unitKey}`));
            }
            for (const rawEx of list) {
              const rawRec = asRecord(rawEx);
              const id = typeof rawRec?.id === "string" ? rawRec.id : undefined;
              if (id !== undefined) {
                const prev = locator.get(id);
                if (prev) add(issue("id-duplicado", file, `id duplicado '${id}' (también en ${prev.file})`, id));
                idsInUnit.add(id);
                // Igual que Python: la dificultad cuenta para el jefe aunque el ejercicio tenga otro error.
                if (typeof rawRec?.dificultad === "number") difficulty.set(id, rawRec.dificultad);
                const parts = idParts(id);
                if (parts) {
                  if (!prefixes.has(parts.prefix)) prefixes.set(parts.prefix, id);
                  if (parts.unit !== unitNumber) {
                    add(issue("id-unidad-distinta", file, `el id dice unidad ${String(parts.unit).padStart(2, "0")} pero está en ${u.dir}`, id));
                  }
                }
              }
              const parsed = parseExercise(rawEx);
              if (id !== undefined && !locator.has(id)) {
                locator.set(id, {
                  unitKey,
                  retired: parsed.ok && parsed.retired,
                  file,
                  exercise: parsed.ok ? parsed.exercise : null,
                });
              }
              if (!parsed.ok) {
                add(fromZod(parsed.issues, file, id));
                continue;
              }
              if (parsed.retired) {
                retired.push(parsed.exercise);
                continue;
              }
              const ex = parsed.exercise;
              exercises.push(ex);
              if (conceptIds) {
                for (const c of ex.conceptos) {
                  if (!conceptIds.has(c)) add(issue("concepto-inexistente", file, `concepto inexistente '${c}'`, ex.id));
                }
              }
              if ((ex.pistas?.length ?? 0) > 3) add(issue("muchas-pistas", file, "más de 3 pistas", ex.id));
            }
            if (list.length < 6) {
              add(issue("pocos-ejercicios", unitPath, "menos de 6 ejercicios (la meta es 15–25 por unidad)"));
            }
          }
        }
      }

      // ---- jefe
      let boss: UnitEntry["boss"] | null = null;
      if (u.boss) {
        const file = u.boss.path;
        const y = readYaml(u.boss);
        if (y.ok) {
          integerFields(u.boss.text, INT_FIELDS_BOSS, file);
          const r = bossSchema.safeParse(y.data);
          if (r.success) boss = r.data;
          else add(fromZod(r.error.issues, file));
          // Las reglas cruzadas corren aunque otro campo del jefe tenga error (igual que Python).
          const preguntas = asRecord(asRecord(y.data)?.preguntas);
          const own = r.success ? r.data.preguntas.propias : stringArray(preguntas?.propias);
          const review = r.success ? (r.data.preguntas.repaso_de ?? []) : (stringArray(preguntas?.repaso_de) ?? []);
          const declared = asRecord(y.data)?.unidad;
          if (typeof declared === "string" && UNIT_KEY_RE.test(declared) && declared !== unitKey) {
            add(issue("ejercicios-fuera-de-lugar", file, `unidad '${declared}' pero el archivo está en ${unitKey}`));
          }
          if (own) {
            if (own.length < 6) add(issue("jefe-pocas-propias", file, "menos de 6 preguntas propias"));
            if (exercisesOk) {
              for (const id of own) {
                if (!idsInUnit.has(id)) add(issue("jefe-propia-inexistente", file, `pregunta propia '${id}' no existe en esta unidad`));
              }
              if (own.length && Math.max(...own.map((id) => difficulty.get(id) ?? 0)) < 4) {
                add(issue("jefe-sin-dificil", file, "ninguna pregunta de dificultad ≥ 4"));
              }
            }
            bossOwn.push({ file, ids: own });
          }
          bossRefs.push({ file, unitKey, subjectId: subj.dir, number: unitNumber, ids: review });
        }
      }

      if (!frontmatter || !boss || !u.lesson) return null;
      return {
        key: unitKey,
        subjectId: subj.dir,
        slug: u.dir,
        number: unitNumber,
        lessonFile: u.lesson.path,
        frontmatter,
        exercises,
        retired,
        boss,
      };
    };

    for (const unit of subject.units) {
      const entry = checkUnit(subject, unit, concepts.ids);
      if (entry) units.push(entry);
    }
    if (prefixes.size > 1) {
      const list = [...prefixes.entries()].map(([p, id]) => `'${p}' (${id})`).join(", ");
      add(issue("prefijo-inconsistente", `content/${subject.dir}`, `la materia usa más de un prefijo de id: ${list}`));
    }
    content[subject.dir] = { id: subject.dir, concepts: concepts.file, units };
  }

  // ---------------------------------------------------------------- referencias de jefes (con todo cargado)
  const unitNumberOf = (key: string) => Number(key.split("/")[1]?.slice(0, 2));
  for (const ref of bossRefs) {
    for (const id of ref.ids) {
      const loc = locator.get(id);
      if (!loc) {
        add(issue("jefe-repaso-inexistente", ref.file, `repaso_de '${id}' no existe`));
        continue;
      }
      const sameSubject = loc.unitKey.split("/")[0] === ref.subjectId;
      if (sameSubject && unitNumberOf(loc.unitKey) >= ref.number) {
        add(issue("jefe-repaso-no-previo", ref.file, `repaso_de '${id}' es de ${loc.unitKey}, no de una unidad anterior`));
      }
    }
  }
  for (const ref of [...bossOwn, ...bossRefs]) {
    for (const id of ref.ids) {
      const loc = locator.get(id);
      if (!loc) continue;
      if (loc.retired) add(issue("jefe-retirado", ref.file, `'${id}' está retirado y no puede ir en un jefe`));
      else if (loc.exercise && "tipo" in loc.exercise && loc.exercise.tipo === "autoevaluacion") {
        add(issue("jefe-autoevaluacion", ref.file, `'${id}' es de autoevaluación y no va en un jefe cronometrado`));
      }
    }
  }

  if (!plan) return { index: null, issues: dedupe(issues) };

  const exerciseIndex: Record<string, ExerciseLocation> = {};
  for (const [id, loc] of locator) exerciseIndex[id] = { unitKey: loc.unitKey, retired: loc.retired };

  return {
    index: { plan, subjects: summarize(plan, content), content, exercises: exerciseIndex },
    issues: dedupe(issues),
  };
}

/** Las mismas sumas que `check_plan()` de verify_content.py. */
function checkPlanSums(plan: Plan, file: string): ContentIssue[] {
  const out: ContentIssue[] = [];
  let credits = 0;
  let theory = 0;
  let practice = 0;
  for (const sem of plan.semestres) {
    let semCredits = 0;
    for (const m of sem.materias) {
      semCredits += m.creditos;
      theory += m.teoria;
      practice += m.practica;
      if (Math.abs(m.teoria + m.practica - m.th) > PLAN_EPS) {
        out.push(issue("plan-inconsistente", file, `${m.id}: teoria+practica != th`));
      }
    }
    if (Math.abs(semCredits - sem.creditos) > PLAN_EPS) {
      out.push(issue("plan-inconsistente", file, `semestre ${sem.n}: créditos suman ${semCredits}, dice ${sem.creditos}`));
    }
    credits += semCredits;
  }
  const t = plan.totales;
  if (Math.abs(credits - t.creditos_tepic) > PLAN_EPS || Math.abs(theory - t.teoria) > PLAN_EPS || Math.abs(practice - t.practica) > PLAN_EPS) {
    out.push(issue("plan-inconsistente", file, `totales no cuadran: créditos ${credits}, teoría ${theory}, práctica ${practice}`));
  }
  return out;
}

interface ConceptsResult {
  readonly file: ConceptsFile | null;
  /** `null` = no hay conceptos que revisar (sin archivo o YAML ilegible), igual que Python. */
  readonly ids: Set<string> | null;
  readonly prereq: ReadonlyMap<string, readonly string[]>;
}
const EMPTY_CONCEPTS: ConceptsResult = { file: null, ids: null, prereq: new Map() };

function checkConcepts(
  subject: RawSubject,
  add: (i: ContentIssue | ContentIssue[]) => void,
  readYaml: (f: RawFile) => { ok: true; data: unknown } | { ok: false },
): ConceptsResult {
  if (!subject.concepts) {
    add(issue("sin-conceptos", `content/${subject.dir}`, "no hay conceptos.yaml"));
    return EMPTY_CONCEPTS;
  }
  const path = subject.concepts.path;
  const y = readYaml(subject.concepts);
  if (!y.ok) return EMPTY_CONCEPTS;
  const data = asRecord(y.data);
  if (!data) {
    add(issue("esquema", path, "conceptos.yaml vacío o sin forma de mapa"));
    return EMPTY_CONCEPTS;
  }
  const r = conceptsFileSchema.safeParse(data);
  if (!r.success) add(fromZod(r.error.issues, path));
  if (typeof data.materia === "string" && data.materia !== subject.dir) {
    add(issue("materia-conceptos-distinta", path, `materia '${data.materia}' pero la carpeta es '${subject.dir}'`));
  }
  // Como verify_content.py: los ids se toman del YAML aunque algún concepto tenga otro error.
  const ids = new Set<string>();
  const prereq = new Map<string, readonly string[]>();
  for (const rawC of Array.isArray(data.conceptos) ? data.conceptos : []) {
    const c = asRecord(rawC);
    const id = typeof c?.id === "string" ? c.id : "";
    if (ids.has(id)) add(issue("concepto-duplicado", path, `concepto duplicado '${id}'`));
    ids.add(id);
    prereq.set(id, stringArray(c?.prerequisitos) ?? []);
  }
  for (const [id, ps] of prereq) {
    for (const p of ps) {
      // Igual que verify_content.py: los de otra materia (`materia:concepto`) se revisan aparte.
      if (!p.includes(":") && !ids.has(p)) add(issue("prerrequisito-inexistente", path, `'${id}' requiere inexistente '${p}'`));
    }
  }
  // Ciclos (DFS, mismo recorrido que verify_content.py).
  const state = new Map<string, 1 | 2>();
  const dfs = (n: string, trail: string[]) => {
    state.set(n, 1);
    for (const p of prereq.get(n) ?? []) {
      if (!prereq.has(p)) continue;
      if (state.get(p) === 1) add(issue("ciclo-prerrequisitos", path, `ciclo de prerrequisitos: ${[...trail, n, p].join(" -> ")}`));
      else if (!state.has(p)) dfs(p, [...trail, n]);
    }
    state.set(n, 2);
  };
  for (const n of prereq.keys()) if (!state.has(n)) dfs(n, []);
  return { file: r.success ? r.data : null, ids, prereq };
}

function summarize(plan: Plan, content: Record<string, SubjectContent>): SubjectSummary[] {
  const unitCount = (id: string) => content[id]?.units.length ?? 0;
  const fromPlan = plan.semestres.flatMap((s) =>
    s.materias.map(
      (m): SubjectSummary => ({
        id: m.id,
        name: m.nombre,
        semester: s.n,
        track: m.track,
        credits: m.creditos,
        cortexPhase: m.cortex_fase,
        electiveSlot: m.optativa === true,
        elective: false,
        hasContent: unitCount(m.id) > 0,
        unitCount: unitCount(m.id),
      }),
    ),
  );
  const electives = plan.optativas.map(
    (o): SubjectSummary => ({
      id: o.id,
      name: o.nombre,
      semester: null,
      track: null,
      credits: plan.optativas_horas.creditos,
      cortexPhase: null,
      electiveSlot: false,
      elective: true,
      hasContent: unitCount(o.id) > 0,
      unitCount: unitCount(o.id),
    }),
  );
  return [...fromPlan, ...electives];
}

function dedupe(issues: ContentIssue[]): ContentIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const k = `${i.code}|${i.file}|${i.id ?? ""}|${i.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
