/**
 * Mode flow recommender (pure, deterministic).
 * @see specs/20260609-flow-recommendation/contracts/recommender-api.md
 */

/** @type {Record<string, (n: number) => number>} */
export const TIME_FACTORS = {
  rsvp: (words) => Math.ceil(words / 400),
  slow: (words) => Math.ceil(words / 120),
  recall: (words) => Math.ceil(words / 600),
  cloze: (items) => Math.ceil(items * 0.5),
  questions: (words) => Math.ceil(words / 800),
  review: (items) => Math.ceil(items * 0.3),
};

/** @type {Record<string, string>} */
export const GENRE_LABEL_EN = {
  philosophical: "Argumentative philosophy text",
  scientific_theoretical: "Theoretical science text",
  scientific_empirical: "Empirical science text",
  essay: "Essay",
  lecture_notes: "Lecture notes",
  textbook_chapter: "Textbook chapter",
  unknown: "Academic text",
};

/** @deprecated Use GENRE_LABEL_EN */
export const GENRE_LABEL_ES = GENRE_LABEL_EN;

/** @type {Record<string, { label: string, description: string }>} */
const MODE_TEMPLATES = {
  slow: {
    label: "Deep reading with annotations",
    description: "Mark what you do not understand and trace key arguments",
  },
  rsvp: {
    label: "RSVP speed reading",
    description: "Skim the text at a steady pace before self-testing",
  },
  cloze: {
    label: "Cloze practice",
    description: "Fill gaps to consolidate key concepts",
  },
  questions: {
    label: "Comprehension questions",
    description: "Answer questions to check what you remember",
  },
  recall: {
    label: "Recall synthesis",
    description: "Open-ended questions to reconstruct arguments and relationships",
  },
  review: {
    label: "Spaced review",
    description: "Revisit material with SM-2 spaced repetition",
  },
};

/** @typedef {'rsvp'|'slow'|'cloze'|'questions'|'recall'|'review'} StudyMode */

const MIN_RECALL_SIGNALS = 2;

/**
 * @param {{ doc?: object, completedModes?: string[], pedagogicalMeta?: object, assessmentSignals?: object[] }} ctx
 * @returns {boolean}
 */
export function shouldSuggestRecall(ctx = {}) {
  const completed = new Set(Array.isArray(ctx.completedModes) ? ctx.completedModes : []);
  const meta = ctx.pedagogicalMeta || ctx.doc?.shared?.docHierarchy?.pedagogical_meta || {};
  const density = Number(meta.argumentativeDensity) || 0;
  if (completed.has("slow")) return true;
  if (completed.has("rsvp") && density >= 3) return true;
  const signals =
    Array.isArray(ctx.assessmentSignals) ? ctx.assessmentSignals : ctx.doc?.shared?.assessmentSignals || [];
  return signals.length < MIN_RECALL_SIGNALS;
}

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
      primaryModes: ["slow", "recall", "cloze", "review"],
      quickModes: ["rsvp", "questions"],
      reasoning:
        "Dense argumentative text. Deep reading, then recall synthesis, before cloze practice.",
    };
  }

  if (genre === "scientific_theoretical" && conceptualLoad >= 3) {
    return {
      primaryModes: ["slow", "recall", "cloze", "review"],
      quickModes: ["rsvp", "cloze"],
      reasoning: "High conceptual load. Build the mental map before active practice.",
    };
  }

  if (genre === "scientific_empirical" || (hasBibliography && !philosophical)) {
    return {
      primaryModes: ["rsvp", "questions", "cloze"],
      quickModes: ["rsvp", "questions"],
      reasoning:
        "Structured empirical text. RSVP works well here; use Cloze for the key concepts.",
    };
  }

  if (genre === "lecture_notes" || firstPersonRatio > 0.03) {
    return {
      primaryModes: ["rsvp", "questions"],
      quickModes: ["questions"],
      reasoning: "Personal notes: you already processed this once. Go straight to retrieval.",
    };
  }

  if (genre === "textbook_chapter") {
    return {
      primaryModes: ["rsvp", "cloze", "questions"],
      quickModes: ["rsvp", "questions"],
      reasoning:
        "Structured textbook material. Skim first, practice with cloze, then check comprehension with questions.",
    };
  }

  if (sizeCategory === "tiny") {
    return {
      primaryModes: ["questions"],
      quickModes: ["questions"],
      reasoning: "Short text. Direct assessment without a full multi-mode pipeline.",
    };
  }

  if (primaryLearningGoal === "learn_procedure") {
    return {
      primaryModes: ["rsvp", "questions"],
      quickModes: ["questions"],
      reasoning:
        "Procedural material. Structured review is more efficient than deep reading.",
    };
  }

  return {
    primaryModes: ["rsvp", "questions"],
    quickModes: ["questions"],
    reasoning: "Conservative default flow.",
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

    if (mode === "rsvp" || mode === "slow" || mode === "questions" || mode === "recall") {
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
      genreLabel: GENRE_LABEL_EN[genre] || GENRE_LABEL_EN.unknown,
    },
    primaryFlow,
    quickFlow,
    reasoning,
    currentStepIndex: 0,
    completedSteps: [],
    userOverride: false,
  };
}
