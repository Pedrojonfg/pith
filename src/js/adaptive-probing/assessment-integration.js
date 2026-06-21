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

  const probeCount = Math.min(
    Math.max(1, Math.floor(Number(budget?.n_test) || 7)),
    graph.nodes.length,
  );
  const selectedIds = new Set(
    selectAdaptiveProbeConcepts({
      graph,
      state: beliefState,
      n: probeCount,
      inventory,
    }),
  );

  const filteredInventory = (Array.isArray(inventory) ? inventory : []).filter((c) =>
    selectedIds.has(getConceptId(c)),
  );
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
      selectedConceptIds: [...selectedIds],
      probeGraphMeta: graph.meta,
    };
  }

  return {
    plan,
    graph,
    beliefState,
    selectedConceptIds: [...selectedIds],
  };
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
  const idSet = new Set(selectedConceptIds);
  const inventory = (Array.isArray(conceptInventory) ? conceptInventory : []).filter((c) =>
    idSet.has(getConceptId(c)),
  );
  return { inventory, graph, beliefState, selectedConceptIds };
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

export { deriveInventoryEdges, computeHolisticAssessmentBudget };
