/**
 * Récords personales (docs/03) y contadores. Ambos viven en la tabla `records`: los récords con
 * su clave (`best:...`) y los contadores con `stat:...`. Romper un récord dispara una celebración.
 */

export type RecordDirection = "higher" | "lower";

export interface RecordCandidate {
  readonly key: string;
  readonly value: number;
  readonly direction: RecordDirection;
  readonly label: string;
}

export interface StoredValue {
  readonly value: number;
}

export interface RecordUpdate {
  readonly key: string;
  readonly value: number;
  readonly at: number;
}

export interface RecordOutcome {
  readonly updates: RecordUpdate[];
  /** Récords que existían y se superaron (los primeros valores no se celebran). */
  readonly broken: RecordCandidate[];
}

export function applyRecords(
  existing: Readonly<Record<string, StoredValue | undefined>>,
  candidates: readonly RecordCandidate[],
  at: number,
): RecordOutcome {
  const updates: RecordUpdate[] = [];
  const broken: RecordCandidate[] = [];
  for (const c of candidates) {
    if (!Number.isFinite(c.value)) continue;
    const prev = existing[c.key];
    const better = !prev || (c.direction === "higher" ? c.value > prev.value : c.value < prev.value);
    if (!better) continue;
    updates.push({ key: c.key, value: c.value, at });
    if (prev) broken.push(c);
  }
  return { updates, broken };
}

/** Claves de récords conocidas (para la página de progreso). */
export const RECORD_LABELS: Readonly<Record<string, { label: string; unit: string; direction: RecordDirection }>> = {
  "best:combo": { label: "Aciertos seguidos", unit: "", direction: "higher" },
  "best:review-run": { label: "Repasos seguidos sin fallar", unit: "", direction: "higher" },
  "best:session-accuracy": { label: "Precisión en una sesión (≥ 10 respuestas)", unit: "%", direction: "higher" },
  "best:session-speed": { label: "Tiempo medio por acierto (sesión ≥ 10 aciertos)", unit: "s", direction: "lower" },
  "best:week-xp": { label: "Mejor semana", unit: "XP", direction: "higher" },
  "best:day-xp": { label: "Mejor día", unit: "XP", direction: "higher" },
};

export const STAT = {
  totalCorrect: "stat:total-correct",
  reviewRun: "stat:review-run",
  bossesPassed: "stat:bosses-passed",
  hardcorePassed: "stat:hardcore-passed",
  ghostsBeaten: "stat:ghosts-beaten",
  lessons: "stat:lessons",
  zeroLeak: "stat:zero-leak",
} as const;

/** Precisión y velocidad de una sesión, si alcanza el mínimo para contar como récord. */
export function sessionCandidates(answered: number, correct: number, correctTimeMs: number): RecordCandidate[] {
  const out: RecordCandidate[] = [];
  if (answered >= 10) {
    out.push({ key: "best:session-accuracy", value: Math.round((100 * correct) / answered), direction: "higher", label: "Precisión en una sesión" });
  }
  if (correct >= 10) {
    out.push({ key: "best:session-speed", value: Math.round(correctTimeMs / correct / 100) / 10, direction: "lower", label: "Tiempo medio por acierto" });
  }
  return out;
}
