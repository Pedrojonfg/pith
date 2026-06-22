import {
  getActiveSessionLlmModel,
  llmChatCompletions,
  normalizeLlmModel,
} from "./llm.js?v=20260622_9";

const RECALL_TYPES = new Set(["synthesis", "relational", "argumentative", "applicative"]);
const TUTOR_QUALITIES = new Set(["strong", "adequate", "partial", "insufficient"]);

function isRecallDevEnvironment() {
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") return false;
  if (typeof location !== "undefined") {
    const host = String(location.hostname || "");
    if (host && host !== "localhost" && host !== "127.0.0.1") return false;
  }
  return true;
}

const GOAL_TYPE_MIX = {
  understand_argument: ["synthesis", "argumentative", "relational"],
  memorize_facts: ["relational", "applicative"],
  learn_procedure: ["applicative", "synthesis"],
  survey_field: ["synthesis", "relational"],
};

function resolveLlmModelArg(llmModel) {
  return normalizeLlmModel(llmModel ?? getActiveSessionLlmModel());
}

function stripJsonFence(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function extractBalancedJsonText(text, openChar, closeChar) {
  const raw = String(text || "").trim();
  const start = raw.indexOf(openChar);
  if (start < 0) return raw;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return raw.slice(start);
}

function tryParseJsonCandidate(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseModelJsonValue(text) {
  const raw = String(text || "").trim();
  const withoutFence = stripJsonFence(raw);
  const arrText = extractBalancedJsonText(withoutFence, "[", "]");
  const objText = extractBalancedJsonText(withoutFence, "{", "}");
  const candidates = [withoutFence, arrText, objText, raw].filter(Boolean);
  const unique = Array.from(new Set(candidates));
  for (const candidate of unique) {
    const parsed = tryParseJsonCandidate(candidate);
    if (parsed != null) return parsed;
  }
  return null;
}

function recallInventoryIdSet(inventory) {
  const ids = new Set();
  for (const c of Array.isArray(inventory) ? inventory : []) {
    for (const key of ["id", "concept_id", "canonicalId"]) {
      const v = String(c?.[key] || "").trim();
      if (v) ids.add(v);
    }
  }
  return ids;
}

function truncateMaterialExcerpt(text, maxChars = 12000) {
  const s = String(text || "").trim();
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}\nù[truncated]`;
}

/**
 * @param {number} charCount
 * @returns {number}
 */
export function deriveRecallQuestionCount(charCount) {
  const n = Math.max(0, Math.floor(Number(charCount) || 0));
  if (n < 2000) return 4;
  if (n < 8000) return 4;
  if (n < 30000) return 6;
  if (n < 80000) return 8;
  return 10;
}

/**
 * Derive RecallConfig from document size tier and pedagogical meta.
 * @param {string} rawMarkdown
 * @param {object | null | undefined} [pedagogicalMeta]
 * @returns {{ questionCount: number, types: string[], scope: 'full' }}
 */
export function deriveRecallConfig(rawMarkdown, pedagogicalMeta = null) {
  const text = String(rawMarkdown || "");
  const meta = pedagogicalMeta && typeof pedagogicalMeta === "object" ? pedagogicalMeta : {};
  const goalRaw = String(meta.primaryLearningGoal || meta.primary_learning_goal || "").trim();
  const goal = GOAL_TYPE_MIX[goalRaw] ? goalRaw : "understand_argument";
  const types = [...GOAL_TYPE_MIX[goal]];
  if (!types.includes("synthesis")) types.unshift("synthesis");
  return {
    questionCount: Math.min(10, deriveRecallQuestionCount(text.length)),
    types,
    scope: "full",
  };
}

/**
 * @param {string} goal
 * @returns {string[]}
 */
export function recallTypesForGoal(goal) {
  const key = String(goal || "").trim();
  if (GOAL_TYPE_MIX[key]) return [...GOAL_TYPE_MIX[key]];
  return ["synthesis", "relational", "argumentative"];
}

function unwrapRecallQuestionsArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return null;
  for (const key of ["questions", "recall_questions", "items", "data"]) {
    if (Array.isArray(raw[key])) return raw[key];
  }
  return null;
}

function isWeakAssessmentSignal(signal) {
  if (!signal || typeof signal !== "object") return false;
  const weight = Number(signal.weight);
  if (!Number.isFinite(weight) || weight <= 0) return false;
  const wrong = Number(signal.wrongCount) || 0;
  const correct = Number(signal.correctCount) || 0;
  return signal.lastResult === "wrong" || wrong > correct;
}

function extractWeakConceptIdsForRecall(assessmentSignals, inventory) {
  const invIds = recallInventoryIdSet(inventory);
  return (Array.isArray(assessmentSignals) ? assessmentSignals : [])
    .filter(isWeakAssessmentSignal)
    .sort((a, b) => (Number(b.weight) || 0) - (Number(a.weight) || 0))
    .map((s) => String(s.canonicalId || s.concept_id || s.id || "").trim())
    .filter((id) => id && invIds.has(id));
}

/**
 * Build system prompt for Recall open-ended question generation.
 * @param {object} opts
 * @returns {string}
 */
export function buildRecallQuestionsSystemPrompt({
  language,
  questionCount,
  types,
  conceptInventory,
  materialExcerpt,
  weakConceptIds,
  primaryLearningGoal,
}) {
  const lang = String(language || "English").trim() || "English";
  const count = Math.max(1, Math.min(10, Math.floor(Number(questionCount) || 5)));
  const typeList = (Array.isArray(types) ? types : [])
    .map((t) => String(t || "").trim())
    .filter((t) => RECALL_TYPES.has(t));
  const safeTypes = typeList.length ? typeList : ["synthesis", "relational", "argumentative"];
  if (!safeTypes.includes("synthesis")) safeTypes.unshift("synthesis");
  const goal = String(primaryLearningGoal || "understand_argument").trim();
  const inv = Array.isArray(conceptInventory) ? conceptInventory : [];
  const weakIds = Array.isArray(weakConceptIds) ? weakConceptIds.filter(Boolean) : [];
  const excerpt = truncateMaterialExcerpt(materialExcerpt);

  const weakBlock = weakIds.length
    ? `\nWeak concepts (prioritize these in question selection):\n${JSON.stringify(weakIds)}`
    : "";

  return `You generate synthesis-level open-ended recall questions for active retrieval study.
Rules:
- Generate exactly ${count} open-ended questions (NO multiple choice).
- Each question MUST have recall_type: one of synthesis, relational, argumentative, applicative.
- Include at least one synthesis question.
- Distribute recall_type values across: ${safeTypes.join(", ")} (aligned with primary learning goal "${goal}").
- Each question references 1ù3 concept_ids from the inventory below.
- Each question MUST include source_chunks: 1+ verbatim or lightly trimmed excerpts from the source material (non-empty strings).
- Questions must require integration beyond a single definition.
- Use stable ids rq1, rq2, ù in order.
Return a single JSON object:
{"questions":[{"id":"rq1","recall_type":"synthesis","question":"...","concept_ids":["c1"],"source_chunks":["excerpt from source"]}]}
Respond entirely in ${lang}.
Return ONLY valid JSON. No preamble, no backticks, no markdown fences.${weakBlock}

Concept inventory (${inv.length} concepts):
${JSON.stringify(
    inv
      .map((c) => ({
        id: String(c?.id || c?.concept_id || c?.canonicalId || "").trim(),
        label: String(c?.label || c?.title || c?.term || "").trim(),
        type: String(c?.type || "CONCEPT").trim(),
      }))
      .filter((c) => c.id),
  )}

Source material excerpt:
${excerpt || "(none)"}`;
}

/**
 * Normalize and validate LLM recall question output.
 * @param {unknown} raw
 * @param {{ inventory?: object[], config?: object }} [options]
 * @returns {object[]}
 */
export function normalizeRecallQuestions(raw, { inventory = [], config = {} } = {}) {
  const invIds = recallInventoryIdSet(inventory);
  return normalizeRecallQuestionsWithIdSet(raw, invIds, config);
}

/**
 * @param {unknown} raw
 * @param {Set<string>} validConceptIds
 * @param {object} [config]
 * @returns {object[]}
 */
export function parseRecallQuestionsFromModel(raw, validConceptIds, config = {}) {
  const invIds =
    validConceptIds instanceof Set
      ? validConceptIds
      : recallInventoryIdSet(Array.isArray(validConceptIds) ? validConceptIds : []);
  return normalizeRecallQuestionsWithIdSet(raw, invIds, config);
}

function normalizeRecallQuestionsWithIdSet(raw, invIds, config = {}) {
  let parsed = raw;
  if (typeof raw === "string") {
    parsed = parseModelJsonValue(raw);
    if (parsed == null) {
      throw new Error("Recall question JSON parse failed.");
    }
  }

  const arr = unwrapRecallQuestionsArray(parsed);
  if (!Array.isArray(arr) || !arr.length) {
    throw new Error("Recall questions array is empty.");
  }

  const out = [];
  for (let idx = 0; idx < arr.length; idx += 1) {
    const item = arr[idx];
    if (!item || typeof item !== "object") {
      throw new Error(`Recall question ${idx + 1} is not an object.`);
    }

    const question = String(item.question || "").trim();
    if (!question) {
      throw new Error(`Recall question ${idx + 1} missing question text.`);
    }

    const recallType = String(item.recall_type || item.recallType || "").trim();
    if (!RECALL_TYPES.has(recallType)) {
      throw new Error(`Recall question ${idx + 1} has invalid recall_type "${recallType}".`);
    }

    const conceptIds = Array.isArray(item.concept_ids || item.conceptIds)
      ? (item.concept_ids || item.conceptIds)
          .map((id) => String(id || "").trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];
    if (!conceptIds.length) {
      throw new Error(`Recall question ${idx + 1} must include 1ù3 concept_ids.`);
    }
    for (const cid of conceptIds) {
      if (invIds.size && !invIds.has(cid)) {
        throw new Error(`Recall question ${idx + 1} references unknown concept_id "${cid}".`);
      }
    }

    let sourceChunks = Array.isArray(item.source_chunks || item.sourceChunks)
      ? (item.source_chunks || item.sourceChunks).map((c) => String(c || "").trim()).filter(Boolean)
      : [];
    if (!sourceChunks.length) {
      const single = String(item.source_chunk || item.sourceChunk || "").trim();
      if (single) sourceChunks = [single];
    }
    if (!sourceChunks.length) {
      throw new Error(`Recall question ${idx + 1} missing source_chunks.`);
    }

    out.push({
      id: String(item.id || "").trim() || `rq${idx + 1}`,
      recall_type: recallType,
      question,
      concept_ids: conceptIds,
      source_chunks: sourceChunks,
    });
  }

  if (!out.some((q) => q.recall_type === "synthesis")) {
    throw new Error("Recall questions must include at least one synthesis question.");
  }

  const cap = Math.max(1, Math.min(10, Math.floor(Number(config.questionCount) || out.length)));
  return out.slice(0, cap);
}

/**
 * @param {unknown} raw
 * @returns {{ critique: string, suggested_answer: string, quality: string }}
 */
/** Canonical recall tutor JSON parser ù re-exported via api.js for recall mode. */
export function normalizeRecallTutorFeedback(raw) {
  let obj = raw;
  if (typeof raw === "string") {
    obj = parseModelJsonValue(raw);
    if (obj == null) {
      throw new Error("Recall tutor JSON parse failed.");
    }
  }
  if (!obj || typeof obj !== "object") {
    throw new Error("Recall tutor returned invalid feedback.");
  }
  const critique = String(obj.critique || "").trim();
  const suggested = String(obj.suggested_answer || obj.suggestedAnswer || "").trim();
  let quality = String(obj.quality || "").trim();
  if (!TUTOR_QUALITIES.has(quality)) {
    if (isRecallDevEnvironment() && typeof console !== "undefined" && console.warn) {
      console.warn("[recall-api] unknown tutor quality, defaulting to partial:", quality);
    }
    quality = "partial";
  }
  if (!critique && !suggested) {
    throw new Error("Recall tutor feedback missing critique and suggested_answer.");
  }
  return { critique, suggested_answer: suggested, quality };
}

/**
 * @param {object} params
 * @returns {Promise<object[]>}
 */
export async function generateRecallQuestions({
  rawMarkdown,
  conceptInventory,
  pedagogicalMeta,
  assessmentSignals,
  config,
  lang,
  language,
  llmModel,
}) {
  const inventory = Array.isArray(conceptInventory) ? conceptInventory : [];
  if (!inventory.length) {
    throw new Error("Missing concept inventory for Recall question generation.");
  }

  const material = String(rawMarkdown ?? "").trim();
  if (!material) {
    throw new Error("Missing source material for Recall question generation.");
  }

  const meta = pedagogicalMeta && typeof pedagogicalMeta === "object" ? pedagogicalMeta : {};
  const resolvedConfig =
    config && typeof config === "object" ? config : deriveRecallConfig(material, meta);
  const questionCount = Math.max(
    1,
    Math.min(
      10,
      Math.floor(Number(resolvedConfig.questionCount) || deriveRecallConfig(material, meta).questionCount),
    ),
  );
  const types = Array.isArray(resolvedConfig.types)
    ? resolvedConfig.types.map((t) => String(t || "").trim()).filter((t) => RECALL_TYPES.has(t))
    : deriveRecallConfig(material, meta).types;
  const safeTypes = types.length ? [...types] : recallTypesForGoal(meta.primaryLearningGoal);
  if (!safeTypes.includes("synthesis")) safeTypes.unshift("synthesis");

  const goal = String(meta.primaryLearningGoal || meta.primary_learning_goal || "understand_argument").trim();
  const languageStr = String(lang || language || "English").trim() || "English";
  const weakIds = extractWeakConceptIdsForRecall(assessmentSignals, inventory);

  const systemPrompt = buildRecallQuestionsSystemPrompt({
    language: languageStr,
    questionCount,
    types: safeTypes,
    conceptInventory: inventory,
    materialExcerpt: material,
    weakConceptIds: weakIds,
    primaryLearningGoal: goal,
  });

  const content = await llmChatCompletions({
    llmModel: resolveLlmModelArg(llmModel),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: JSON.stringify({ task: "Generate the recall questions JSON object." }),
      },
    ],
    temperature: 0.1,
  });

  const parsed = parseModelJsonValue(content);
  if (parsed == null) {
    throw new Error("Recall question generation returned invalid JSON.");
  }

  return normalizeRecallQuestions(parsed, {
    inventory,
    config: { ...resolvedConfig, questionCount, types: safeTypes },
  });
}

/**
 * @param {object} params
 * @returns {Promise<{ critique: string, suggested_answer: string, quality: string }>}
 */
export async function deepSeekRecallTutor({
  question,
  recall_type,
  student_answer,
  concept_ids,
  concept_definitions,
  source_chunk,
  lang,
  llmModel,
}) {
  const answer = String(student_answer || "").trim();
  if (!answer) throw new Error("Student answer is required before tutor evaluation.");

  const language = String(lang || "English").trim() || "English";
  const concepts = Array.isArray(concept_definitions) ? concept_definitions : [];
  const conceptIds = (Array.isArray(concept_ids) ? concept_ids : [])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  const conceptBlock = concepts
    .map((c) => {
      const term = String(c?.term || c?.label || "").trim();
      const def = String(c?.definition || "").trim();
      return term ? `- ${term}: ${def || "(no definition)"}` : "";
    })
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `You evaluate a student's open-ended recall answer against source material and concept definitions.
recall_type: ${String(recall_type || "synthesis").trim()}
Quality rubric:
- strong: complete, accurate, well-structured synthesis grounded in the source
- adequate: mostly correct with minor gaps or imprecision
- partial: some correct ideas but significant gaps, missing concepts, or weak integration
- insufficient: largely incorrect, off-topic, or lacking substantive content

Return ONLY JSON:
{"critique":"...","suggested_answer":"...","quality":"strong|adequate|partial|insufficient"}
Critique must acknowledge strengths and name gaps or inaccuracies with concept references.
Suggested answer must be a complete model answer grounded in the source excerpt (not generic).
Respond in ${language}.`;

  const userPrompt = `Question: ${String(question || "").trim()}
Concept ids: ${conceptIds.length ? conceptIds.join(", ") : "(none)"}
Concept definitions:
${conceptBlock || "(none)"}
Source excerpt:
${String(source_chunk || "").trim()}
Student answer:
${answer}`;

  const content = await llmChatCompletions({
    llmModel: resolveLlmModelArg(llmModel),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.6,
  });

  return normalizeRecallTutorFeedback(content);
}
