/**
 * Mode flow recommender (pure, deterministic).
 * @see specs/20260609-flow-recommendation/contracts/recommender-api.md
 */

/** @type {Record<string, (n: number) => number>} */
export const TIME_FACTORS = {
  rsvp: (words) => Math.ceil(words / 400),
  slow: (words) => Math.ceil(words / 120),
  cloze: (items) => Math.ceil(items * 0.5),
  questions: (words) => Math.ceil(words / 800),
  review: (items) => Math.ceil(items * 0.3),
};

/** @type {Record<string, string>} */
export const GENRE_LABEL_ES = {
  philosophical: "Texto filosófico argumentativo",
  scientific_theoretical: "Texto científico teórico",
  scientific_empirical: "Texto científico empírico",
  essay: "Ensayo",
  lecture_notes: "Apuntes de clase",
  textbook_chapter: "Capítulo de manual",
  unknown: "Texto académico",
};

/** @type {Record<string, { label: string, description: string }>} */
const MODE_TEMPLATES = {
  slow: {
    label: "Lectura profunda con anotaciones",
    description: "Anota lo que no entiendes, marca argumentos clave",
  },
  rsvp: {
    label: "Lectura rápida RSVP",
    description: "Recorre el texto a ritmo sostenido antes de evaluarte",
  },
  cloze: {
    label: "Práctica con Cloze",
    description: "Completa huecos para consolidar conceptos clave",
  },
  questions: {
    label: "Preguntas de comprensión",
    description: "Responde preguntas para verificar lo que recuerdas",
  },
  review: {
    label: "Revisión espaciada",
    description: "Repasa con repaso SM-2 lo que ya estudiaste",
  },
};

/** @typedef {'rsvp'|'slow'|'cloze'|'questions'|'review'} StudyMode */

/**
 * @param {number} value
 * @returns {number}
 */
function clampDensity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/**
 * @param {import('./analyzer.js').TextMetrics | Record<string, unknown>} textMetrics
 * @returns {number}
 */
function estimatedClozeItems(textMetrics) {
  const words = Number(textMetrics?.wordCount) || 0;
  return Math.max(5, Math.ceil(words / 200));
}

/**
 * @param {StudyMode} mode
 * @returns {import('./analyzer.js').TextMetrics extends never ? object : object}
 */
function createModeStep(mode) {
  const template = MODE_TEMPLATES[mode];
  return {
    id: `step_${mode}_1`,
    mode,
    label: template.label,
    description: template.description,
    estimatedTimeMin: 0,
    optional: false,
    completedAt: null,
    skippedAt: null,
  };
}

/**
 * @param {StudyMode[]} modes
 * @returns {ReturnType<typeof createModeStep>[]}
 */
function buildFlow(modes) {
  return modes.map((mode) => createModeStep(mode));
}

/**
 * @param {Record<string, unknown>} pedagogicalMeta
 * @param {Record<string, unknown>} textMetrics
 * @returns {boolean}
 */
function isPhilosophical(pedagogicalMeta, textMetrics) {
  const density = clampDensity(pedagogicalMeta.argumentativeDensity);
  return pedagogicalMeta.genre === "philosophical" || density >= 4;
}

/**
 * @param {Record<string, unknown>} pedagogicalMeta
 * @param {Record<string, unknown>} textMetrics
 * @returns {{ primaryModes: StudyMode[], quickModes: StudyMode[], reasoning: string }}
 */
function resolveDecision(pedagogicalMeta, textMetrics) {
  const genre = pedagogicalMeta.genre || "unknown";
  const argumentativeDensity = clampDensity(pedagogicalMeta.argumentativeDensity);
  const conceptualLoad = clampDensity(pedagogicalMeta.conceptualLoad);
  const primaryLearningGoal = pedagogicalMeta.primaryLearningGoal || "understand_argument";
  const sizeCategory = textMetrics.sizeCategory || "short";
  const firstPersonRatio = Number(textMetrics?.contentSignals?.firstPersonRatio) || 0;
  const hasBibliography = Boolean(textMetrics?.contentSignals?.hasBibliography);
  const philosophical = isPhilosophical(
    { ...pedagogicalMeta, argumentativeDensity },
    textMetrics,
  );

  if (argumentativeDensity >= 4 || genre === "philosophical") {
    return {
      primaryModes: ["slow", "cloze", "review"],
      quickModes: ["rsvp", "questions"],
      reasoning:
        "Texto argumentativo denso. La lectura profunda antes de practicar evita memorizar sin comprender.",
    };
  }

  if (genre === "scientific_theoretical" && conceptualLoad >= 3) {
    return {
      primaryModes: ["slow", "cloze", "review"],
      quickModes: ["rsvp", "cloze"],
      reasoning: "Alta carga conceptual. Necesitas construir el mapa antes de practicar.",
    };
  }

  if (genre === "scientific_empirical" || (hasBibliography && !philosophical)) {
    return {
      primaryModes: ["rsvp", "questions", "cloze"],
      quickModes: ["rsvp", "questions"],
      reasoning:
        "Texto empírico estructurado. RSVP es eficiente aquí; Cloze para los conceptos clave.",
    };
  }

  if (genre === "lecture_notes" || firstPersonRatio > 0.03) {
    return {
      primaryModes: ["rsvp", "questions"],
      quickModes: ["questions"],
      reasoning: "Apuntes propios: ya los procesaste una vez. Evaluación directa.",
    };
  }

  if (genre === "textbook_chapter") {
    return {
      primaryModes: ["rsvp", "cloze", "review"],
      quickModes: ["rsvp", "questions"],
      reasoning: "Manual estructurado. Lectura rápida primero, luego recuperación activa.",
    };
  }

  if (sizeCategory === "tiny") {
    return {
      primaryModes: ["questions"],
      quickModes: ["questions"],
      reasoning: "Texto corto. Evaluación directa sin pipeline completo.",
    };
  }

  if (primaryLearningGoal === "learn_procedure") {
    return {
      primaryModes: ["rsvp", "questions"],
      quickModes: ["questions"],
      reasoning:
        "Material procedimental. Revisión estructurada es más eficiente que lectura profunda.",
    };
  }

  return {
    primaryModes: ["rsvp", "questions"],
    quickModes: ["questions"],
    reasoning: "Flujo conservador.",
  };
}

/**
 * @param {Record<string, unknown>} textMetrics
 * @param {Array<Record<string, unknown>>} steps
 * @returns {Array<Record<string, unknown>>}
 */
export function computeStepTimes(textMetrics, steps) {
  const words = Number(textMetrics?.wordCount) || 0;
  const items = estimatedClozeItems(textMetrics);

  return steps.map((step) => {
    const mode = step.mode;
    let estimatedTimeMin = 1;

    if (mode === "rsvp" || mode === "slow" || mode === "questions") {
      const factor = TIME_FACTORS[mode];
      estimatedTimeMin = Math.max(1, factor(words));
    } else if (mode === "cloze" || mode === "review") {
      const factor = TIME_FACTORS[mode];
      estimatedTimeMin = Math.max(1, factor(items));
    }

    return { ...step, estimatedTimeMin };
  });
}

/**
 * @param {Record<string, unknown>} textMetrics
 * @param {Record<string, unknown>} pedagogicalMeta
 * @param {{ method?: 'llm_meta' | 'deterministic' }} [options]
 * @returns {Record<string, unknown>}
 */
export function computeModeRecommendation(textMetrics, pedagogicalMeta, options = {}) {
  const meta = pedagogicalMeta || {};
  const metrics = textMetrics || {};
  const argumentativeDensity = clampDensity(meta.argumentativeDensity);
  const conceptualLoad = clampDensity(meta.conceptualLoad);
  const genre = meta.genre || "unknown";
  const method = options.method === "llm_meta" ? "llm_meta" : "deterministic";

  const { primaryModes, quickModes, reasoning } = resolveDecision(
    { ...meta, argumentativeDensity, conceptualLoad, genre },
    metrics,
  );

  const primaryFlow = computeStepTimes(metrics, buildFlow(primaryModes));
  const quickFlow = computeStepTimes(metrics, buildFlow(quickModes));

  return {
    computedAt: Date.now(),
    method,
    analysis: {
      genre,
      argumentativeDensity,
      conceptualLoad,
      estimatedReadTimeMin: Number(metrics.estimatedReadTimeMin) || 0,
      genreLabel: GENRE_LABEL_ES[genre] || GENRE_LABEL_ES.unknown,
    },
    primaryFlow,
    quickFlow,
    reasoning,
    currentStepIndex: 0,
    completedSteps: [],
    userOverride: false,
  };
}
