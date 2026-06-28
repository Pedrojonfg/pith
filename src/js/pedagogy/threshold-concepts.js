/**
 * Threshold concept detection and RSVP scheduling helpers.
 * @see specs/20260703-threshold-generative-pedagogy/
 */

import { getPedagogicalFlags } from "../config/flags.js";

const FOUNDATION_TYPES = new Set(["definition", "argument"]);
const LOW_LEVERAGE_TYPES = new Set(["excursus", "example"]);

/**
 * @param {object} concept
 * @returns {string}
 */
export function conceptIdOf(concept) {
  return String(concept?.id || concept?.canonicalId || concept?.concept_id || "").trim();
}

/**
 * @param {object[]} inventory
 * @returns {Map<string, number>}
 */
export function buildDependentCounts(inventory) {
  const ids = new Set(
    (Array.isArray(inventory) ? inventory : [])
      .map((c) => conceptIdOf(c))
      .filter(Boolean),
  );
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const c of Array.isArray(inventory) ? inventory : []) {
    const cid = conceptIdOf(c);
    if (!cid) continue;
    counts.set(cid, 0);
  }
  for (const c of Array.isArray(inventory) ? inventory : []) {
    const prereqs = Array.isArray(c?.prerequisite_ids) ? c.prerequisite_ids : [];
    const cid = conceptIdOf(c);
    if (!cid) continue;
    for (const p of prereqs) {
      const pid = String(p || "").trim();
      if (!pid || !ids.has(pid)) continue;
      counts.set(pid, (counts.get(pid) || 0) + 1);
    }
  }
  return counts;
}

/**
 * @param {object} concept
 * @param {object[]} inventory
 * @param {Map<string, number>} [dependentCounts]
 * @returns {number}
 */
export function scoreThresholdHeuristic(concept, inventory, dependentCounts) {
  if (!concept || typeof concept !== "object") return 0;
  const inv = Array.isArray(inventory) ? inventory : [];
  const counts = dependentCounts || buildDependentCounts(inv);
  const id = conceptIdOf(concept);
  if (!id) return 0;

  const dependents = counts.get(id) || 0;
  const prereqs = Array.isArray(concept.prerequisite_ids) ? concept.prerequisite_ids : [];
  const ctype = String(concept.concept_type || "").trim().toLowerCase();

  let score = 0;
  score += Math.min(0.45, dependents * 0.08);
  score += prereqs.length === 0 ? 0.2 : Math.max(0, 0.12 - prereqs.length * 0.03);
  if (FOUNDATION_TYPES.has(ctype)) score += 0.18;
  if (LOW_LEVERAGE_TYPES.has(ctype)) score -= 0.25;
  if (String(concept.questionClass || "") === "factual") score -= 0.15;

  return Math.min(1, Math.max(0, score));
}

/**
 * @param {object[]} inventory
 * @param {number} [fraction]
 * @returns {{ thresholdIds: string[], scores: Map<string, number>, count: number }}
 */
export function selectThresholdIds(inventory, fraction) {
  const inv = Array.isArray(inventory) ? inventory : [];
  const flags = getPedagogicalFlags();
  const frac = Number.isFinite(Number(fraction))
    ? Number(fraction)
    : Number(flags.THRESHOLD_TARGET_FRACTION) || 0.12;

  if (inv.length < 5) {
    return { thresholdIds: [], scores: new Map(), count: 0 };
  }

  const dependentCounts = buildDependentCounts(inv);
  const scored = inv
    .map((c) => ({
      id: conceptIdOf(c),
      score: scoreThresholdHeuristic(c, inv, dependentCounts),
    }))
    .filter((row) => row.id);

  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const count = Math.max(1, Math.ceil(inv.length * frac));
  const thresholdIds = scored.slice(0, count).map((r) => r.id);
  const scores = new Map(scored.map((r) => [r.id, r.score]));

  return { thresholdIds, scores, count };
}

/**
 * @param {number} score
 * @param {object} flags
 * @returns {boolean}
 */
export function isBorderlineThresholdScore(score, flags = getPedagogicalFlags()) {
  const lo = Number(flags.THRESHOLD_BORDERLINE_LOW) || 0.35;
  const hi = Number(flags.THRESHOLD_BORDERLINE_HIGH) || 0.65;
  const s = Number(score);
  return Number.isFinite(s) && s >= lo && s <= hi;
}

/**
 * @param {object[]} inventory
 * @param {string[]} thresholdIds
 * @param {"heuristic"|"llm"|"both"} source
 * @param {Map<string, number>} [scores]
 * @returns {object[]}
 */
export function applyThresholdFlags(inventory, thresholdIds, source = "heuristic", scores) {
  const set = new Set((Array.isArray(thresholdIds) ? thresholdIds : []).map((id) => String(id).trim()));
  return (Array.isArray(inventory) ? inventory : []).map((entry) => {
    const id = conceptIdOf(entry);
    const isThreshold = set.has(id);
    const thresholdScore = scores?.get(id) ?? scoreThresholdHeuristic(entry, inventory);
    if (!isThreshold) {
      const next = { ...entry };
      if (next.isThreshold) delete next.isThreshold;
      return next;
    }
    return {
      ...entry,
      isThreshold: true,
      thresholdScore,
      thresholdSource: source,
    };
  });
}

/**
 * @param {object} entry
 * @returns {boolean}
 */
export function isThresholdConcept(entry) {
  return entry?.isThreshold === true;
}

/**
 * @param {object} blockIndexEntry
 * @param {object[]} inventory
 * @returns {boolean}
 */
export function blockIsThreshold(blockIndexEntry, inventory) {
  const ids = new Set(
    (Array.isArray(blockIndexEntry?.concept_ids) ? blockIndexEntry.concept_ids : [])
      .map((c) => String(c || "").trim())
      .filter(Boolean),
  );
  if (!ids.size) return false;
  return (Array.isArray(inventory) ? inventory : []).some((c) => {
    const id = conceptIdOf(c);
    return ids.has(id) && isThresholdConcept(c);
  });
}

/**
 * Stable sort: threshold blocks before blocks that depend on their concepts (by concept_ids overlap).
 * @param {object[]} blockIndex
 * @param {object[]} inventory
 * @returns {object[]}
 */
export function sortBlockIndexForThresholds(blockIndex, inventory) {
  const blocks = Array.isArray(blockIndex) ? [...blockIndex] : [];
  if (blocks.length < 2) return blocks;

  const thresholdIds = new Set(
    (Array.isArray(inventory) ? inventory : [])
      .filter(isThresholdConcept)
      .map((c) => conceptIdOf(c))
      .filter(Boolean),
  );
  if (!thresholdIds.size) return blocks;

  const blockThreshold = blocks.map((b) => blockIsThreshold(b, inventory));
  const blockConcepts = blocks.map((b) =>
    new Set(
      (Array.isArray(b?.concept_ids) ? b.concept_ids : [])
        .map((c) => String(c || "").trim())
        .filter(Boolean),
    ),
  );

  return blocks
    .map((b, i) => ({ b, i, isTh: blockThreshold[i], concepts: blockConcepts[i] }))
    .sort((a, c) => {
      if (a.isTh !== c.isTh) return a.isTh ? -1 : 1;
      const aDependsOnC = [...a.concepts].some((id) => thresholdIds.has(id) && c.isTh);
      const cDependsOnA = [...c.concepts].some((id) => thresholdIds.has(id) && a.isTh);
      if (aDependsOnC && !cDependsOnA) return 1;
      if (cDependsOnA && !aDependsOnC) return -1;
      return a.i - c.i;
    })
    .map((row, idx) => ({
      ...row.b,
      id: idx + 1,
      is_threshold_block: row.isTh,
    }));
}

/**
 * @param {object} cfg
 * @param {boolean} isThresholdBlock
 * @param {object} [flags]
 * @returns {object}
 */
export function mergeThresholdBlockConfig(cfg, isThresholdBlock, flags = getPedagogicalFlags()) {
  if (!isThresholdBlock) return cfg && typeof cfg === "object" ? { ...cfg } : {};
  const base = cfg && typeof cfg === "object" ? { ...cfg } : {};
  const wpmCap = Number(flags.THRESHOLD_RSVP_WPM_CAP) || 250;
  return {
    ...base,
    explanation_profile: "threshold_expanded",
    rsvp_wpm_cap: wpmCap,
    n_socratic: Math.max(Number(base.n_socratic) || 0, 1),
  };
}

/**
 * @param {object} blockIndexEntry
 * @param {object[]} inventory
 * @returns {object}
 */
export function thresholdConfigForBlockEntry(blockIndexEntry, inventory) {
  return mergeThresholdBlockConfig({}, blockIsThreshold(blockIndexEntry, inventory));
}

export function isThresholdConceptsEnabled(flags = getPedagogicalFlags()) {
  return flags.THRESHOLD_CONCEPTS_ENABLED !== false;
}

/**
 * Tag inventory with threshold flags (heuristic + optional LLM refine).
 * @param {object[]} inventory
 * @param {{ llmModel?: string, lang?: string }} [options]
 * @returns {Promise<object[]>}
 */
export async function tagThresholdConceptsInInventory(inventory, options = {}) {
  if (!isThresholdConceptsEnabled()) return Array.isArray(inventory) ? inventory : [];
  const inv = Array.isArray(inventory) ? inventory : [];
  if (inv.length < 5) return inv;
  if (inv.some((c) => c?.thresholdSource)) return inv;

  const { thresholdIds, scores, count } = selectThresholdIds(inv);
  let finalIds = thresholdIds;
  let source = "heuristic";
  const flags = getPedagogicalFlags();

  if (flags.THRESHOLD_LLM_CONFIRM_ENABLED !== false && count > 0) {
    const candidatePool = inv
      .map((c) => ({
        id: conceptIdOf(c),
        label: String(c?.label || c?.title || c?.term || "").trim(),
        heuristicScore: Number((scores.get(conceptIdOf(c)) ?? 0).toFixed(3)),
      }))
      .filter((c) => c.id)
      .sort((a, b) => b.heuristicScore - a.heuristicScore)
      .slice(0, Math.max(count * 2, count));

    try {
      const { classifyThresholdConceptsLLM } = await import("../api.js?v=20260703_01");
      const llm = await classifyThresholdConceptsLLM({
        candidates: candidatePool,
        targetCount: count,
        lang: options.lang || "English",
        llmModel: options.llmModel,
      });
      if (Array.isArray(llm?.threshold_ids) && llm.threshold_ids.length) {
        finalIds = llm.threshold_ids;
        source = "both";
      }
    } catch {
      // keep heuristic
    }
  }

  return applyThresholdFlags(inv, finalIds, source, scores);
}
