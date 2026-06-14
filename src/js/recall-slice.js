const RECALL_STATUSES = new Set(["not_started", "generating", "ready", "in_progress", "complete"]);
const RECALL_TYPES = new Set(["synthesis", "relational", "argumentative", "applicative"]);
const TUTOR_QUALITIES = new Set(["strong", "adequate", "partial", "insufficient"]);

/**
 * Stable fingerprint of concept inventory + pedagogical meta for recall regeneration.
 * @param {object[]} inventory
 * @param {object | null | undefined} pedagogicalMeta
 * @returns {string}
 */
export function computeInventoryHash(inventory, pedagogicalMeta = null) {
  const items = Array.isArray(inventory) ? inventory : [];
  const parts = items
    .map((c) => {
      if (!c || typeof c !== "object") return "";
      const id = String(c.canonicalId || c.id || c.concept_id || "").trim();
      const label = String(c.label || c.term || c.name || "").trim();
      return `${id}:${label}`;
    })
    .filter(Boolean)
    .sort();
  const meta = pedagogicalMeta && typeof pedagogicalMeta === "object" ? pedagogicalMeta : {};
  const goal = String(meta.primaryLearningGoal || meta.primary_learning_goal || "").trim();
  const densityRaw = meta.argumentativeDensity ?? meta.argumentative_density;
  const density = Number.isFinite(Number(densityRaw)) ? String(Math.floor(Number(densityRaw))) : "";
  const payload = `${parts.join(";")}#${goal}|${density}`;
  let hash = 5381;
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash * 33) ^ payload.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * @param {object | null | undefined} [config]
 * @returns {object}
 */
export function createEmptyRecallSlice(config = null) {
  const cfg = config && typeof config === "object" ? config : {};
  const types = Array.isArray(cfg.types)
    ? cfg.types.map((t) => String(t || "").trim()).filter((t) => RECALL_TYPES.has(t))
    : ["synthesis", "relational", "argumentative"];
  const safeTypes = types.length ? types : ["synthesis", "relational", "argumentative"];
  const slice = {
    status: "not_started",
    questions: [],
    currentIndex: 0,
    config: {
      questionCount: Math.max(1, Math.floor(Number(cfg.questionCount) || 5)),
      types: safeTypes,
      scope: cfg.scope === "section" ? "section" : "full",
    },
    _meta: {},
  };
  if (cfg.sectionScope != null && String(cfg.sectionScope).trim()) {
    slice.config.sectionScope = String(cfg.sectionScope).trim();
  }
  return slice;
}

function normalizeTutorFeedback(raw) {
  if (!raw || typeof raw !== "object") return null;
  const critique = String(raw.critique || "").trim();
  const suggested = String(raw.suggested_answer || raw.suggestedAnswer || "").trim();
  let quality = String(raw.quality || "").trim();
  if (!TUTOR_QUALITIES.has(quality)) quality = "partial";
  if (!critique && !suggested) return null;
  return {
    critique,
    suggested_answer: suggested,
    quality,
  };
}

function normalizeRecallQuestion(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const question = String(raw.question || "").trim();
  if (!question) return null;
  const recallType = String(raw.recall_type || raw.recallType || "").trim();
  if (!RECALL_TYPES.has(recallType)) return null;
  const conceptIds = Array.isArray(raw.concept_ids || raw.conceptIds)
    ? (raw.concept_ids || raw.conceptIds)
        .map((id) => String(id || "").trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];
  if (!conceptIds.length) return null;
  const sourceChunks = Array.isArray(raw.source_chunks || raw.sourceChunks)
    ? (raw.source_chunks || raw.sourceChunks).map((c) => String(c || "").trim()).filter(Boolean)
    : [];
  if (!sourceChunks.length) return null;
  const id = String(raw.id || "").trim() || `rq${index + 1}`;
  const out = {
    id,
    recall_type: recallType,
    question,
    concept_ids: conceptIds,
    source_chunks: sourceChunks,
  };
  const studentAnswer = String(raw.student_answer || raw.studentAnswer || "").trim();
  if (studentAnswer) out.student_answer = studentAnswer;
  const feedback = normalizeTutorFeedback(raw.tutor_feedback || raw.tutorFeedback);
  if (feedback) out.tutor_feedback = feedback;
  return out;
}

/**
 * @param {unknown} raw
 * @returns {object}
 */
export function normalizeRecallSlice(raw) {
  const base = createEmptyRecallSlice();
  if (!raw || typeof raw !== "object") return base;

  const status = String(raw.status || "").trim();
  if (RECALL_STATUSES.has(status)) base.status = status;

  const questionsRaw = Array.isArray(raw.questions) ? raw.questions : [];
  const questions = [];
  for (let i = 0; i < questionsRaw.length; i += 1) {
    const q = normalizeRecallQuestion(questionsRaw[i], i);
    if (q) questions.push(q);
  }
  base.questions = questions;

  const idx = Math.floor(Number(raw.currentIndex));
  base.currentIndex = Number.isFinite(idx) && idx >= 0 ? Math.min(idx, Math.max(0, questions.length - 1)) : 0;

  if (raw.config && typeof raw.config === "object") {
    const merged = createEmptyRecallSlice(raw.config);
    base.config = merged.config;
  }

  if (raw._meta && typeof raw._meta === "object") {
    const meta = {};
    const generatedAt = Number(raw._meta.generatedAt);
    if (Number.isFinite(generatedAt) && generatedAt > 0) meta.generatedAt = generatedAt;
    const hash = String(raw._meta.sourceInventoryHash || "").trim();
    if (hash) meta.sourceInventoryHash = hash;
    if (typeof raw._meta.usedAssessmentSignals === "boolean") {
      meta.usedAssessmentSignals = raw._meta.usedAssessmentSignals;
    }
    base._meta = meta;
  }

  return base;
}
