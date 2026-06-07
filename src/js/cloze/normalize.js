/** Validation and normalization for Cloze Detection data shapes. */

const CONCEPT_TYPES = new Set([
  "CONCEPT",
  "THESIS",
  "TERM",
  "AUTHOR",
  "CAUSE",
  "EFFECT",
]);
const RELATION_TYPES = new Set([
  "implies",
  "causes",
  "supports",
  "contradicts",
  "defines",
  "exemplifies",
  "is_a",
  "part_of",
  "prerequisite_of",
]);
const NODE_ITEM_TYPES = new Set(["NODE-DEF", "NODE-APP", "NODE-COND", "NODE-CONTRAST"]);
const EDGE_ITEM_TYPES = new Set(["EDGE-SOURCE", "EDGE-TARGET", "EDGE-RELATION"]);
const ITEM_TYPES = new Set([...NODE_ITEM_TYPES, ...EDGE_ITEM_TYPES]);
const QA_STATUSES = new Set(["valid", "weak", "rejected"]);
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const PLAUSIBILITY = new Set(["high", "medium", "low"]);

function clampImportance(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function parseModelJsonObject(raw) {
  const text = String(raw || "")
    .trim()
    .replace(/^```json?\s*|\s*```$/gi, "");
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function normalizeEpistemicNode(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || `node_${String(index + 1).padStart(3, "0")}`).trim();
  const text = String(raw.text || "").trim();
  if (!id || !text) return null;
  const type = CONCEPT_TYPES.has(String(raw.type || "").trim())
    ? String(raw.type).trim()
    : "CONCEPT";
  return {
    id,
    text,
    type,
    importance: clampImportance(raw.importance),
    semantic_cluster: String(raw.semantic_cluster || "general").trim() || "general",
    aliases: Array.isArray(raw.aliases)
      ? raw.aliases.map((a) => String(a || "").trim()).filter(Boolean)
      : [],
  };
}

export function normalizeEpistemicEdge(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || `edge_${String(index + 1).padStart(3, "0")}`).trim();
  const source_id = String(raw.source_id || "").trim();
  const target_id = String(raw.target_id || "").trim();
  if (!id || !source_id || !target_id) return null;
  const type = RELATION_TYPES.has(String(raw.type || raw.relation_type || "").trim())
    ? String(raw.type || raw.relation_type).trim()
    : "implies";
  return {
    id,
    source_id,
    target_id,
    type,
    sentence_context: String(raw.sentence_context || "").trim(),
  };
}

export function normalizeEpistemicGraph(raw) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const nodes = (Array.isArray(obj.nodes) ? obj.nodes : [])
    .map((n, i) => normalizeEpistemicNode(n, i))
    .filter(Boolean);
  const edges = (Array.isArray(obj.edges) ? obj.edges : [])
    .map((e, i) => normalizeEpistemicEdge(e, i))
    .filter(Boolean);
  if (!nodes.length) return null;
  return { nodes, edges };
}

export function normalizeSemanticAnalysis(raw) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const node_candidates = (Array.isArray(obj.node_candidates) ? obj.node_candidates : [])
    .map((c) => {
      if (!c || typeof c !== "object") return null;
      const node_id = String(c.node_id || "").trim();
      if (!node_id) return null;
      return {
        node_id,
        text: String(c.text || "").trim(),
        importance: clampImportance(c.importance),
        semantic_cluster: String(c.semantic_cluster || "general").trim() || "general",
        perspectives_available: Array.isArray(c.perspectives_available)
          ? c.perspectives_available.filter((p) => NODE_ITEM_TYPES.has(String(p)))
          : [],
        occurrences: Array.isArray(c.occurrences) ? c.occurrences : [],
      };
    })
    .filter(Boolean)
    .filter((c) => c.importance >= 3);
  const edge_candidates = (Array.isArray(obj.edge_candidates) ? obj.edge_candidates : [])
    .map((c) => {
      if (!c || typeof c !== "object") return null;
      const edge_id = String(c.edge_id || "").trim();
      if (!edge_id) return null;
      return {
        edge_id,
        source_id: String(c.source_id || "").trim(),
        target_id: String(c.target_id || "").trim(),
        relation_type: String(c.relation_type || c.type || "implies").trim(),
        aptitude_score: clampImportance(c.aptitude_score),
        items_possible: Array.isArray(c.items_possible)
          ? c.items_possible.filter((p) => EDGE_ITEM_TYPES.has(String(p)))
          : [],
        sentence_context: String(c.sentence_context || "").trim(),
      };
    })
    .filter(Boolean);
  return { node_candidates, edge_candidates };
}

export function normalizeClozeOption(raw, isCorrect = false) {
  if (!raw || typeof raw !== "object") return null;
  const text = String(raw.text || "").trim();
  if (!text) return null;
  const plausibilityRaw = raw.plausibility != null ? String(raw.plausibility).trim() : null;
  const plausibility =
    isCorrect || plausibilityRaw == null
      ? null
      : PLAUSIBILITY.has(plausibilityRaw)
        ? plausibilityRaw
        : "medium";
  const sourceRaw = raw.source != null ? String(raw.source).trim() : null;
  const source = isCorrect ? null : sourceRaw === "L1" || sourceRaw === "L3" ? sourceRaw : "L3";
  return {
    text,
    is_correct: Boolean(isCorrect),
    plausibility,
    source,
    rationale: raw.rationale != null ? String(raw.rationale).trim() : undefined,
  };
}

export function normalizeClozeItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const item_type = String(raw.item_type || "").trim();
  if (!ITEM_TYPES.has(item_type)) return null;
  const sentence_original = String(raw.sentence_original || "").trim();
  const sentence_with_blank = String(raw.sentence_with_blank || "").trim();
  const blank_text = String(raw.blank_text || "").trim();
  if (!sentence_with_blank || !blank_text) return null;
  const optionsRaw = Array.isArray(raw.options) ? raw.options : [];
  let options = null;
  if (optionsRaw.length >= 4) {
    options = optionsRaw
      .slice(0, 4)
      .map((o) => normalizeClozeOption(o, Boolean(o?.is_correct)))
      .filter(Boolean);
    const correctCount = options.filter((o) => o.is_correct).length;
    if (options.length !== 4 || correctCount !== 1) options = null;
  }
  const difficultyRaw = String(raw.difficulty || "medium").trim();
  const difficulty = DIFFICULTIES.has(difficultyRaw) ? difficultyRaw : "medium";
  const qaRaw = String(raw.qa_status || "valid").trim();
  const qa_status = QA_STATUSES.has(qaRaw) ? qaRaw : "valid";
  return {
    id: String(raw.id || `item_${Math.random().toString(36).slice(2, 9)}`).trim(),
    item_type,
    sentence_original: sentence_original || sentence_with_blank.replace("_____", blank_text),
    sentence_with_blank,
    blank_text,
    blank_char_start: Number(raw.blank_char_start) || 0,
    blank_char_end: Number(raw.blank_char_end) || blank_text.length,
    is_synthetic: Boolean(raw.is_synthetic),
    importance: clampImportance(raw.importance),
    semantic_cluster: String(raw.semantic_cluster || "general").trim() || "general",
    node_id: raw.node_id != null ? String(raw.node_id).trim() : undefined,
    edge_id: raw.edge_id != null ? String(raw.edge_id).trim() : undefined,
    source_node_id: raw.source_node_id != null ? String(raw.source_node_id).trim() : undefined,
    target_node_id: raw.target_node_id != null ? String(raw.target_node_id).trim() : undefined,
    relation_type: raw.relation_type != null ? String(raw.relation_type).trim() : undefined,
    options,
    difficulty,
    qa_status,
    qa_notes: raw.qa_notes != null ? String(raw.qa_notes).trim() : undefined,
    times_shown: Number(raw.times_shown) || 0,
    times_correct: Number(raw.times_correct) || 0,
  };
}

/** Only items passing QA with four options are served in MC study. */
export function getValidItems(items) {
  return (Array.isArray(items) ? items : [])
    .map(normalizeClozeItem)
    .filter(Boolean)
    .filter((item) => item.qa_status === "valid" && Array.isArray(item.options) && item.options.length === 4);
}

export function mergeItemOptions(item, distractors) {
  const base = normalizeClozeItem(item);
  if (!base) return null;
  const correct = normalizeClozeOption({ text: base.blank_text, is_correct: true }, true);
  const dist = (Array.isArray(distractors) ? distractors : [])
    .map((d) => normalizeClozeOption(d, false))
    .filter(Boolean)
    .slice(0, 3);
  if (dist.length < 3) return null;
  return normalizeClozeItem({ ...base, options: [correct, ...dist] });
}
