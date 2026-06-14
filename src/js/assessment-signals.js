/** Pure assessment signal extract, merge, and Cloze prioritization. */

const LABEL_TRUNCATE = 80;

/**
 * @param {number} wrongCount
 * @param {number} correctCount
 * @param {'wrong'|'correct'} lastResult
 * @returns {number}
 */
export function computeAssessmentWeight(wrongCount, correctCount, lastResult) {
  let weight = wrongCount - correctCount * 0.5;
  if (lastResult === "wrong") weight += 1;
  if (lastResult === "correct" && correctCount > wrongCount) {
    weight = Math.max(0, weight - 1);
  }
  return weight;
}

function truncateLabel(text, max = LABEL_TRUNCATE) {
  const s = String(text || "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function parseLastAt(response) {
  if (response && typeof response.answered_at === "number" && Number.isFinite(response.answered_at)) {
    return response.answered_at;
  }
  const s = String(response?.answered_at || "").trim();
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function isAnswerCorrect(response) {
  if (!response || typeof response !== "object") return false;
  if (response.is_correct === true) return true;
  if (response.is_correct === false) return false;
  const user = String(response.user_answer || "").trim();
  const correct = String(response.correct_answer || "").trim();
  if (!user || !correct) return false;
  return user.toLowerCase() === correct.toLowerCase();
}

function normalizeConceptRef(raw, block, bi, qi, questionStem) {
  if (raw && typeof raw === "object") {
    const canonicalId = String(raw.canonicalId || raw.id || "").trim();
    const conceptLabel = String(raw.label || raw.text || raw.name || canonicalId).trim();
    if (canonicalId) {
      return { canonicalId, conceptLabel: conceptLabel || canonicalId };
    }
    if (conceptLabel) {
      return { canonicalId: conceptLabel, conceptLabel };
    }
  }
  const s = String(raw || "").trim();
  if (s) return { canonicalId: s, conceptLabel: s };

  const title = String(block?.title || "").trim();
  if (title) return { canonicalId: title, conceptLabel: title };

  return {
    canonicalId: `block_${bi}_q_${qi}`,
    conceptLabel: truncateLabel(questionStem),
  };
}

function resolveConceptRef(block, bi, qi, questionStem) {
  const concepts = Array.isArray(block?.concepts) ? block.concepts : [];
  const conceptIds = Array.isArray(block?.concept_ids) ? block.concept_ids : [];

  if (concepts[qi] != null) {
    return normalizeConceptRef(concepts[qi], block, bi, qi, questionStem);
  }
  if (conceptIds[qi] != null) {
    const id = String(conceptIds[qi]).trim();
    if (id) return { canonicalId: id, conceptLabel: id };
  }

  const title = String(block?.title || "").trim();
  if (title) return { canonicalId: title, conceptLabel: title };

  if (concepts.length > 0) {
    return normalizeConceptRef(concepts[0], block, bi, qi, questionStem);
  }
  if (conceptIds.length > 0) {
    const id = String(conceptIds[0]).trim();
    if (id) return { canonicalId: id, conceptLabel: id };
  }

  return {
    canonicalId: `block_${bi}_q_${qi}`,
    conceptLabel: truncateLabel(questionStem),
  };
}

function signalKey(signal) {
  const id = String(signal?.canonicalId || "").trim();
  if (id) return `id:${id}`;
  const label = String(signal?.conceptLabel || "").trim().toLowerCase();
  return `label:${label}`;
}

function buildMergedSignal(base, incoming) {
  const wrongCount = (base?.wrongCount || 0) + (incoming.wrongCount || 0);
  const correctCount = (base?.correctCount || 0) + (incoming.correctCount || 0);
  const baseAt = base?.lastAt || 0;
  const incomingAt = incoming.lastAt || 0;
  const lastResult = incomingAt >= baseAt ? incoming.lastResult : base.lastResult;
  const lastAt = Math.max(baseAt, incomingAt);
  const canonicalId =
    String(base?.canonicalId || "").trim() || String(incoming.canonicalId || "").trim();
  const conceptLabel =
    String(base?.conceptLabel || "").trim() || String(incoming.conceptLabel || "").trim();

  return {
    canonicalId,
    conceptLabel,
    blockIndex: incomingAt >= baseAt ? incoming.blockIndex : base.blockIndex,
    sourceMode: incomingAt >= baseAt ? incoming.sourceMode : base.sourceMode,
    wrongCount,
    correctCount,
    lastResult,
    lastAt,
    weight: computeAssessmentWeight(wrongCount, correctCount, lastResult),
  };
}

/**
 * @param {object} slice
 * @param {'rsvp'|'questions'} sourceMode
 * @returns {import('./assessment-signals.js').AssessmentSignal[]}
 */
export function extractSignalsFromBlockSession(slice, sourceMode) {
  const safe = slice && typeof slice === "object" ? slice : {};
  const blocks = Array.isArray(safe.blocks) ? safe.blocks : [];
  const respBlocks =
    safe._responses?.blocks && typeof safe._responses.blocks === "object"
      ? safe._responses.blocks
      : {};
  const mode = sourceMode === "questions" ? "questions" : "rsvp";
  const signals = [];

  for (let bi = 0; bi < blocks.length; bi += 1) {
    const block = blocks[bi] && typeof blocks[bi] === "object" ? blocks[bi] : {};
    const questions = Array.isArray(block.questions) ? block.questions : [];
    const qResp =
      respBlocks[String(bi)]?.questions && typeof respBlocks[String(bi)].questions === "object"
        ? respBlocks[String(bi)].questions
        : {};

    const qIndices = new Set([
      ...questions.map((_, qi) => qi),
      ...Object.keys(qResp).map((k) => Number(k)).filter((n) => Number.isFinite(n)),
    ]);

    for (const qi of [...qIndices].sort((a, b) => a - b)) {
      const response = qResp[String(qi)];
      if (!response || typeof response !== "object") continue;
      const userAnswer = String(response.user_answer || "").trim();
      if (!userAnswer) continue;

      const questionStem = String(
        response.question || questions[qi]?.question || "",
      ).trim();
      const { canonicalId, conceptLabel } = resolveConceptRef(block, bi, qi, questionStem);
      const correct = isAnswerCorrect(response);
      const lastResult = correct ? "correct" : "wrong";

      signals.push({
        canonicalId,
        conceptLabel,
        blockIndex: bi,
        sourceMode: mode,
        wrongCount: correct ? 0 : 1,
        correctCount: correct ? 1 : 0,
        lastResult,
        lastAt: parseLastAt(response),
        weight: computeAssessmentWeight(correct ? 0 : 1, correct ? 1 : 0, lastResult),
      });
    }
  }

  return signals;
}

/**
 * @param {object[]} existing
 * @param {object[]} incoming
 * @returns {object[]}
 */
export function mergeAssessmentSignals(existing, incoming) {
  const map = new Map();

  for (const raw of Array.isArray(existing) ? existing : []) {
    if (!raw || typeof raw !== "object") continue;
    const key = signalKey(raw);
    if (!key || key === "label:") continue;
    map.set(key, { ...raw });
  }

  for (const raw of Array.isArray(incoming) ? incoming : []) {
    if (!raw || typeof raw !== "object") continue;
    const key = signalKey(raw);
    if (!key || key === "label:") continue;
    const prev = map.get(key);
    map.set(key, prev ? buildMergedSignal(prev, raw) : { ...raw });
  }

  return [...map.values()];
}

function buildSignalLookup(signals) {
  const byId = new Map();
  const byLabel = new Map();
  for (const s of Array.isArray(signals) ? signals : []) {
    if (!s || typeof s !== "object") continue;
    const id = String(s.canonicalId || "").trim();
    if (id) byId.set(id, s);
    const label = String(s.conceptLabel || "").trim().toLowerCase();
    if (label) byLabel.set(label, s);
  }
  return { byId, byLabel };
}

function matchItemSignal(item, lookup) {
  const id = String(item?.canonicalId || item?.node_id || item?.concept_id || "").trim();
  if (id && lookup.byId.has(id)) return lookup.byId.get(id);

  const label = String(item?.conceptLabel || item?.label || item?.text || "").trim().toLowerCase();
  if (label && lookup.byLabel.has(label)) return lookup.byLabel.get(label);

  return null;
}

function isWeakSignal(signal) {
  if (!signal || signal.weight <= 0) return false;
  return signal.lastResult === "wrong" || signal.wrongCount > signal.correctCount;
}

/**
 * @param {object[]} items
 * @param {object[]} signals
 * @param {{ targetWeakRatio?: number }} [options]
 * @returns {object[]}
 */
export function prioritizeByAssessmentSignals(items, signals, options = {}) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  if (!Array.isArray(signals) || !signals.length) return list.slice();

  const targetWeakRatio =
    typeof options.targetWeakRatio === "number" && Number.isFinite(options.targetWeakRatio)
      ? Math.min(1, Math.max(0, options.targetWeakRatio))
      : 0.6;
  const lookup = buildSignalLookup(signals);

  const annotated = list.map((item, index) => {
    const signal = matchItemSignal(item, lookup);
    return {
      item,
      index,
      signal,
      weak: isWeakSignal(signal),
      weight: signal?.weight || 0,
    };
  });

  const weak = annotated
    .filter((row) => row.weak)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  const strong = annotated.filter((row) => !row.weak);

  const targetWeak = Math.ceil(list.length * targetWeakRatio);
  const frontWeak = weak.slice(0, targetWeak);
  const restWeak = weak.slice(targetWeak);
  const rest = [...restWeak, ...strong].sort((a, b) => a.index - b.index);

  return [...frontWeak, ...rest].map((row) => row.item);
}

/**
 * @param {object} question RecallQuestion with tutor_feedback
 * @returns {object[]}
 */
export function buildRecallAssessmentSignals(question) {
  const q = question && typeof question === "object" ? question : null;
  const quality = String(q?.tutor_feedback?.quality || "").trim();
  const weak = quality === "partial" || quality === "insufficient";
  const strong = quality === "strong" || quality === "adequate";
  if (!weak && !strong) return [];

  const lastResult = weak ? "wrong" : "correct";
  const now = Date.now();
  return (Array.isArray(q?.concept_ids) ? q.concept_ids : [])
    .map((rawId) => {
      const canonicalId = String(rawId || "").trim();
      if (!canonicalId) return null;
      return {
        canonicalId,
        conceptLabel: canonicalId,
        sourceMode: "recall",
        lastResult,
        wrongCount: weak ? 1 : 0,
        correctCount: strong ? 1 : 0,
        weight: computeAssessmentWeight(weak ? 1 : 0, strong ? 1 : 0, lastResult),
        lastAt: now,
      };
    })
    .filter(Boolean);
}

