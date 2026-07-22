/**
 * R6 — Adaptive probing integration with pre-packing assessment.
 * @see specs/20260630-adaptive-knowledge-probing/
 */

import {
  buildAssessmentCoveragePlan,
  computeHolisticAssessmentBudget,
  deriveInventoryEdges,
  getConceptId,
} from "../assessment-coverage.js";
import { isAdaptiveProbingEnabled, getAdaptiveProbingFlags } from "../config/flags.js";
import {
  PREPACKING_ALREADY_KNOW_ANSWER,
  PREPACKING_DONT_KNOW_ANSWER,
  computeGraphEntropy,
} from "./belief-propagation.js";
import { buildProbeGraph } from "./probe-graph.js";
import { initializeBeliefState } from "./belief-state.js";
import { selectAdaptiveProbeConcepts } from "./eig-selection.js";
import { updateBeliefs } from "./belief-propagation.js";
import { persistProbeGraphWarnings } from "./belief-persist.js";

/**
 * @param {string} answer
 * @param {object} [item]
 */
export function mapAssessmentAnswerToBeliefResponse(answer, item) {
  const a = String(answer || "").trim();
  if (!a) return "partial";
  if (a === PREPACKING_ALREADY_KNOW_ANSWER) return "knew";
  if (a === PREPACKING_DONT_KNOW_ANSWER) return "missed";

  const correct = String(item?.answer || item?.correct || "").trim();
  const type = String(item?.type || "").trim().toLowerCase();
  if (type === "test" && correct) {
    if (a === correct) return "knew";
    return "missed";
  }
  if (type === "socratic") return "partial";
  return "partial";
}

/**
 * Prepare probe graph + belief state; optionally persist warnings.
 * @param {object} params
 */
export function prepareAdaptiveProbingContext({
  conceptInventory,
  conceptGraph,
  projectId,
  docId,
}) {
  const graph = buildProbeGraph({ conceptInventory, conceptGraph });
  const flags = getAdaptiveProbingFlags();
  const beliefState = initializeBeliefState({ conceptInventory, flags });

  if (graph.warnings?.length && docId) {
    persistProbeGraphWarnings(graph.warnings, { projectId, docId }).catch((err) => {
      console.warn("[adaptive-probing] warning persist failed", err?.message || err);
    });
  }

  return { graph, beliefState, flags, meta: graph.meta };
}

/**
 * Concepts whose seeded prior is at/above HIGH_CONFIDENCE_SKIP_THRESHOLD.
 * Explicit exclusion list for knowledge_profile presumed_known_vault.
 * @param {object[]} conceptInventory
 * @param {Record<string, object>} beliefState
 * @param {object} [flags]
 */
export function collectVaultSkippedConceptIds(
  conceptInventory,
  beliefState,
  flags = getAdaptiveProbingFlags(),
) {
  const hi = Number(flags.HIGH_CONFIDENCE_SKIP_THRESHOLD) || 0.8;
  /** @type {string[]} */
  const out = [];
  for (const c of Array.isArray(conceptInventory) ? conceptInventory : []) {
    const id = getConceptId(c);
    if (!id) continue;
    const b = Number(beliefState?.[id]?.belief);
    if (Number.isFinite(b) && b >= hi) out.push(id);
  }
  return out;
}

/**
 * @param {object} params
 */
export function buildAdaptiveCoveragePlan({
  inventory,
  edges,
  inventoryChunks,
  rawMarkdown,
  budget,
  conceptGraph,
  projectId,
  docId,
}) {
  if (!isAdaptiveProbingEnabled()) {
    return buildAssessmentCoveragePlan({
      inventory,
      edges,
      inventoryChunks,
      rawMarkdown,
      budget,
    });
  }

  const { graph, beliefState } = prepareAdaptiveProbingContext({
    conceptInventory: inventory,
    conceptGraph,
    projectId,
    docId,
  });
  const vaultSkippedIds = collectVaultSkippedConceptIds(inventory, beliefState);

  const probeCount = Math.min(
    Math.max(1, Math.floor(Number(budget?.n_test) || 7)),
    graph.nodes.length,
  );
  const orderedIds = selectAdaptiveProbeConcepts({
    graph,
    state: beliefState,
    n: probeCount,
    inventory,
  });
  const selectedIds = new Set(orderedIds);

  // Preserve EIG selection order (not original inventory order).
  const byId = new Map();
  for (const c of Array.isArray(inventory) ? inventory : []) {
    const id = getConceptId(c);
    if (id && !byId.has(id)) byId.set(id, c);
  }
  const filteredInventory = orderedIds.map((id) => byId.get(id)).filter(Boolean);
  if (!filteredInventory.length) {
    return buildAssessmentCoveragePlan({
      inventory,
      edges,
      inventoryChunks,
      rawMarkdown,
      budget,
    });
  }

  const filteredEdges = (Array.isArray(edges) ? edges : []).filter(
    (e) => selectedIds.has(String(e.from)) && selectedIds.has(String(e.to)),
  );

  const adaptiveBudget = {
    ...budget,
    n_test: Math.min(probeCount, selectedIds.size),
    n_socratic: budget?.n_socratic || 0,
    edgeTestQuota: Math.min(
      budget?.edgeTestQuota || 0,
      filteredEdges.length > 0 ? Math.min(2, filteredEdges.length) : 0,
    ),
    rationale: `adaptive probing: ${selectedIds.size} concepts selected by EIG`,
  };

  const plan = buildAssessmentCoveragePlan({
    inventory: filteredInventory,
    edges: filteredEdges,
    inventoryChunks,
    rawMarkdown,
    budget: adaptiveBudget,
  });

  if (plan) {
    plan.adaptiveProbing = {
      selectedConceptIds: orderedIds,
      vaultSkippedIds,
      probeGraphMeta: graph.meta,
    };
  }

  return {
    plan,
    graph,
    beliefState,
    selectedConceptIds: orderedIds,
    vaultSkippedIds,
  };
}

/**
 * Map adaptive coverage selection to full inventory objects for holistic generation.
 * Hard-excludes vaultSkippedIds (holistic builder does not; see research OQ2).
 * // ponytail: thin id→object map; no second EIG pass
 * @param {object[]} inventory
 * @param {object | null} plan
 * @param {{ selectedConceptIds?: string[], vaultSkippedIds?: string[], adaptiveEnabled?: boolean }} [options]
 * @returns {object[]}
 */
export function resolveAdaptiveCandidateConcepts(inventory, plan, options = {}) {
  const list = Array.isArray(inventory) ? inventory : [];
  if (!list.length) return list;

  const adaptiveEnabled =
    typeof options.adaptiveEnabled === "boolean"
      ? options.adaptiveEnabled
      : isAdaptiveProbingEnabled();
  if (!adaptiveEnabled) return list;

  const selectedRaw = Array.isArray(options.selectedConceptIds)
    ? options.selectedConceptIds
    : Array.isArray(plan?.adaptiveProbing?.selectedConceptIds)
      ? plan.adaptiveProbing.selectedConceptIds
      : [];
  const skipRaw = Array.isArray(options.vaultSkippedIds)
    ? options.vaultSkippedIds
    : Array.isArray(plan?.adaptiveProbing?.vaultSkippedIds)
      ? plan.adaptiveProbing.vaultSkippedIds
      : [];
  const skipSet = new Set(
    skipRaw.map((id) => String(id || "").trim()).filter(Boolean),
  );
  const orderedIds = selectedRaw
    .map((id) => String(id || "").trim())
    .filter((id) => id && !skipSet.has(id));

  const byId = new Map();
  for (const c of list) {
    const id = getConceptId(c);
    if (id && !byId.has(id)) byId.set(id, c);
  }
  const out = orderedIds.map((id) => byId.get(id)).filter(Boolean);
  if (!out.length) {
    console.warn(
      "[resolveAdaptiveCandidateConcepts] empty adaptive selection; falling back to full inventory",
    );
    return list;
  }
  return out;
}

/**
 * Filter inventory for non-holistic adaptive path.
 */
export function filterInventoryForAdaptiveProbing({
  conceptInventory,
  conceptGraph,
  n,
  projectId,
  docId,
}) {
  if (!isAdaptiveProbingEnabled()) {
    return { inventory: conceptInventory, graph: null, beliefState: null, selectedConceptIds: null };
  }

  const { graph, beliefState } = prepareAdaptiveProbingContext({
    conceptInventory,
    conceptGraph,
    projectId,
    docId,
  });
  const selectedConceptIds = selectAdaptiveProbeConcepts({
    graph,
    state: beliefState,
    n,
    inventory: conceptInventory,
  });
  const vaultSkippedIds = collectVaultSkippedConceptIds(conceptInventory, beliefState);
  // Hard exclusion: never reintroduce vault-skipped via empty-batch fallback.
  const skipSet = new Set(vaultSkippedIds);
  const askedIds = selectedConceptIds.filter((id) => !skipSet.has(id));
  // ponytail: rebuild in EIG order instead of filter() which keeps inventory order
  const byId = new Map();
  for (const c of Array.isArray(conceptInventory) ? conceptInventory : []) {
    const id = getConceptId(c);
    if (id && !byId.has(id)) byId.set(id, c);
  }
  let inventory = askedIds.map((id) => byId.get(id)).filter(Boolean);
  if (!inventory.length) {
    // Edge: all vault-skipped — keep a minimal non-empty set from non-green if any, else first concept.
    inventory = (Array.isArray(conceptInventory) ? conceptInventory : [])
      .filter((c) => !skipSet.has(getConceptId(c)))
      .slice(0, Math.max(1, Math.floor(Number(n) || 1)));
    if (!inventory.length && conceptInventory?.length) {
      inventory = [conceptInventory[0]];
    }
  }
  return {
    inventory,
    graph,
    beliefState,
    selectedConceptIds: inventory.map(getConceptId),
    vaultSkippedIds,
  };
}

/**
 * @param {object} flow prePackingFlow slice
 * @param {object} item
 * @param {string} answer
 */
export function applyAdaptiveBeliefUpdate(flow, item, answer) {
  if (!flow?.adaptiveProbing?.graph || !flow.adaptiveProbing.beliefState) return;
  const conceptId = String(item?.concept_id || "").trim();
  if (!conceptId) return;
  const response = mapAssessmentAnswerToBeliefResponse(answer, item);
  updateBeliefs(
    flow.adaptiveProbing.graph,
    flow.adaptiveProbing.beliefState,
    conceptId,
    response,
    getAdaptiveProbingFlags(),
  );
}

/**
 * Concept ids selected for probing that have not yet received an answer.
 * @param {object} flow
 * @returns {string[]}
 */
export function remainingUnaskedConceptIds(flow) {
  const selected = Array.isArray(flow?.adaptiveProbing?.selectedConceptIds)
    ? flow.adaptiveProbing.selectedConceptIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  if (!selected.length) return [];

  const items = Array.isArray(flow?.assessmentItems)
    ? flow.assessmentItems
    : Array.isArray(flow?.assessmentBlock?.questions)
      ? flow.assessmentBlock.questions
      : [];
  const itemById = new Map();
  for (const q of items) {
    const itemId = String(q?.item_id || "").trim();
    if (itemId) itemById.set(itemId, String(q?.concept_id || "").trim());
  }

  const asked = new Set();
  const responses = [
    ...(Array.isArray(flow?.assessmentResponses) ? flow.assessmentResponses : []),
    ...(Array.isArray(flow?.responses) ? flow.responses : []),
  ];
  for (const r of responses) {
    const cid = String(r?.concept_id || "").trim() || itemById.get(String(r?.item_id || "").trim());
    if (cid) asked.add(cid);
  }
  return selected.filter((id) => !asked.has(id));
}

/**
 * Early-stop when mean entropy over remaining unasked concepts is below threshold.
 * Uses existing computeGraphEntropy — no new statistical formula.
 * @param {object} flow
 * @param {object} [flags]
 */
export function shouldEarlyStopAdaptiveAssessment(flow, flags = getAdaptiveProbingFlags()) {
  if (!flags?.ADAPTIVE_PROBING_EARLY_STOP) return false;
  if (!flow?.adaptiveProbing?.beliefState) return false;
  const remaining = remainingUnaskedConceptIds(flow);
  if (!remaining.length) return true;
  const total = computeGraphEntropy(flow.adaptiveProbing.beliefState, remaining);
  const mean = total / remaining.length;
  const threshold = Number(flags.ADAPTIVE_EARLY_STOP_MEAN_ENTROPY_THRESHOLD);
  const cut = Number.isFinite(threshold) ? threshold : 0.35;
  return mean < cut;
}

/**
 * Attach assessmentStatus + inferred rows for early-stopped concepts.
 * @param {object | null} profile
 * @param {object} flow
 */
export function enrichKnowledgeProfileWithAdaptiveStatuses(profile, flow) {
  if (!profile || typeof profile !== "object") return profile;
  const byConceptId =
    profile.byConceptId && typeof profile.byConceptId === "object" ? { ...profile.byConceptId } : {};
  const items = Array.isArray(profile.items) ? [...profile.items] : [];
  const itemIds = new Set(items.map((r) => String(r?.concept_id || "").trim()).filter(Boolean));

  for (const [id, entry] of Object.entries(byConceptId)) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.assessed === true && entry.assessmentStatus == null) {
      byConceptId[id] = { ...entry, assessmentStatus: "tested" };
    }
  }
  for (let i = 0; i < items.length; i += 1) {
    const row = items[i];
    if (!row || typeof row !== "object") continue;
    if (row.assessmentStatus == null) {
      items[i] = { ...row, assessmentStatus: "tested" };
    }
  }

  const belief = flow?.adaptiveProbing?.beliefState || {};
  const remaining = remainingUnaskedConceptIds(flow);
  for (const id of remaining) {
    const b = Number(belief[id]?.belief);
    const confidence = Number.isFinite(b) ? b : 0.55;
    const mastery = confidence >= 0.7 ? "full" : confidence >= 0.4 ? "partial" : "none";
    byConceptId[id] = {
      ...(byConceptId[id] || { assessed: false }),
      assessed: false,
      assessmentStatus: "inferred",
      correct: mastery === "full",
    };
    if (!itemIds.has(id)) {
      items.push({ concept_id: id, mastery, confidence, assessmentStatus: "inferred" });
      itemIds.add(id);
    }
  }

  // Vault-presumed placeholders (filled in Phase C when skippedIds present)
  for (const id of Array.isArray(flow?.adaptiveProbing?.vaultSkippedIds)
    ? flow.adaptiveProbing.vaultSkippedIds
    : []) {
    const sid = String(id || "").trim();
    if (!sid) continue;
    const existing = byConceptId[sid];
    const alreadyTested =
      existing?.assessmentStatus === "tested" ||
      (existing?.assessed === true && existing?.assessmentStatus !== "inferred" && existing?.assessmentStatus !== "presumed_known_vault");
    if (alreadyTested) {
      console.warn(
        `[enrichKnowledgeProfileWithAdaptiveStatuses] invariant: vault-skipped "${sid}" already tested; refusing overwrite`,
      );
      continue;
    }
    byConceptId[sid] = {
      ...(existing || { assessed: false }),
      assessed: false,
      assessmentStatus: "presumed_known_vault",
      correct: true,
    };
    if (!itemIds.has(sid)) {
      items.push({
        concept_id: sid,
        mastery: "full",
        confidence: Number(belief[sid]?.belief) || 0.85,
        assessmentStatus: "presumed_known_vault",
      });
      itemIds.add(sid);
    }
  }

  return { ...profile, byConceptId, items };
}

export { deriveInventoryEdges, computeHolisticAssessmentBudget };
