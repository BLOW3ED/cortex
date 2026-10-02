/**
 * Todas las constantes de las mecánicas de Cortex (docs/03, ADR-008). Afinar la "adictividad"
 * se hace AQUÍ, sin tocar componentes. Las cifras son un punto de partida; se ajustan con uso real.
 */

export const DIFFICULTIES = [1, 2, 3, 4, 5] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const CONFIG = {
  /** Meta diaria de Carlo (decisión del 2026-10-01). */
  dailyMinutes: { min: 15, max: 25 },

  xp: {
    /** Ejercicio correcto por dificultad. */
    byDifficulty: { 1: 5, 2: 8, 3: 12, 4: 18, 5: 25 } satisfies Record<Difficulty, number>,
    /** Correcto la primera vez que se intenta ese ejercicio: +50 %. */
    firstTryBonus: 0.5,
    /** Repaso FSRS correcto. */
    review: 6,
    /** +2 si el intervalo desde el último repaso era largo. */
    reviewLongBonus: 2,
    reviewLongDays: 7,
    /** Lección completada con mini quiz ≥ 80 %. */
    lesson: 20,
    lessonQuizPass: 0.8,
    lessonQuizSize: 4,
    /** Misión diaria completada (cada una). */
    mission: 30,
    /** Rendimientos decrecientes por repetir el MISMO ejercicio el mismo día (índice = aciertos previos hoy). */
    repeatFactors: [1, 0.5, 0.25, 0] as readonly number[],
    /** Cada pista usada quita este porcentaje del XP del ejercicio (docs/04: costo pequeño). */
    hintCost: 0.2,
    /** El XP de un ejercicio nunca baja de este factor por pistas. */
    hintFloor: 0.4,
    /** Acertar con confianza alta (3). */
    calibrationBonus: 2,
    /** Ganarle al fantasma en un jefe. */
    ghostBonus: 25,
    /** Aprobar un jefe que ya habías aprobado da esta fracción de su recompensa. */
    bossRepeatFactor: 0.1,
  },

  /** XP para pasar del nivel n al n+1: base · n^exponente (docs/03). */
  levels: { base: 100, exponent: 1.5, max: 999 },

  streak: {
    /** Misión mínima del día: 3 ejercicios correctos... */
    minCorrect: 3,
    /** ...o un repaso completo (vaciar la cola del día con al menos este número de tarjetas). */
    minReviewsForBlock: 1,
    /** Se gana 1 congelamiento cada 7 días de racha. */
    freezeEvery: 7,
    maxFreezes: 2,
    /** Reparación: doble misión dentro de las siguientes 48 h (2 días). */
    repairDays: 2,
    repairMultiplier: 2,
  },

  missions: { perDay: 3 },

  /** Cofre diario: pesos visibles en Ajustes (docs/03, transparencia). */
  chest: [
    { kind: "xp", weight: 45, amounts: [25, 50, 100] as readonly number[] },
    { kind: "fact", weight: 25 },
    { kind: "freeze", weight: 15 },
    { kind: "frame", weight: 10 },
    { kind: "rare-badge", weight: 5 },
  ] as const,

  league: {
    divisions: ["Bronce", "Plata", "Oro", "Platino", "Diamante"] as readonly string[],
    up: 1.25,
    down: 0.75,
    weeksBack: 4,
  },

  boss: {
    /** Oleadas: fácil / medio / difícil. */
    waves: [0.3, 0.4, 0.3] as readonly number[],
    hardcoreLives: 1,
    /** Para "maestría" se exigen repasos exitosos con intervalo mayor a esto (días). */
    expertIntervalDays: 21,
    /** Fracción de las tarjetas de la unidad que deben tener ese repaso largo exitoso. */
    expertCardShare: 0.5,
  },

  flow: {
    /** Acierto esperado al que apunta la selección de ejercicios. */
    targetAccuracy: 0.82,
    /** Tras 2 errores seguidos en un concepto: baja un nivel y muestra ejemplo resuelto. */
    downAfterErrors: 2,
    /** Tras 4 aciertos seguidos rápidos: sube un nivel. */
    upAfterFastCorrect: 4,
    /** "Rápido" = menos de esta fracción del tiempo estimado. */
    fastFactor: 0.6,
    /** Tiempo estimado por dificultad cuando el ejercicio no trae `tiempo_estimado_s`. */
    estimatedSecondsByDifficulty: { 1: 30, 2: 45, 3: 75, 4: 120, 5: 180 } satisfies Record<Difficulty, number>,
    practiceBlockSize: 6,
  },

  srs: {
    requestRetention: 0.9,
    maximumIntervalDays: 365,
    /** Tarjetas del calentamiento (~2–3 min). */
    warmupMax: 8,
    /** Respuesta "fácil" si fue rápida y con confianza alta. */
  },

  mastery: {
    /** Concepto "practicado": aciertos mínimos en ejercicios que lo usan. */
    practicedCorrect: 3,
    /** Unidad "practicada": fracción de sus ejercicios acertados al menos una vez. */
    unitPracticedShare: 0.5,
  },

  /** Modo sano (activable): tras 90 min en un día sugiere descanso y ya no da XP ni racha ese día. */
  healthy: { minutes: 90 },

  gym: {
    /** Escalera 2 aciertos → sube / 1 error → baja (docs/06). */
    upAfter: 2,
    downAfter: 1,
    roundSeconds: 90,
    nbackTrials: 20,
  },

  /** Cosméticos: títulos por nivel (no dan ventajas de estudio). */
  titles: [
    { level: 1, title: "Novato curioso" },
    { level: 3, title: "Aprendiz de laboratorio" },
    { level: 5, title: "Depurador en formación" },
    { level: 8, title: "Resolvedor constante" },
    { level: 12, title: "Arquitecto de ideas" },
    { level: 18, title: "Ingeniero de fondo" },
    { level: 25, title: "Leyenda del cortex" },
  ] as readonly { level: number; title: string }[],

  /** Marcos del HUD que pueden salir en el cofre. */
  frames: ["fosforo", "ambar", "coral", "cian", "doble"] as readonly string[],
} as const;

export type ChestKind = (typeof CONFIG.chest)[number]["kind"];
