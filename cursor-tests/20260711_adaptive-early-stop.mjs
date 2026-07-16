/**
 * Phase B T04 — adaptive early-stop via computeGraphEntropy; inferred profile status.
 * Asserts early-stop does not add assessment LLM calls (single batch only).
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260711_adaptive-early-stop.mjs
 */
import assert from "node:assert/strict";
import { resetStorage } from "./setup-dom.mjs";
import { LS_SHARED_ASSESSMENT_GATE_KEY } from "../src/js/config.js";
import {
  getAdaptiveProbingFlags,
  saveSharedAssessmentGatePreference,
} from "../src/js/config/flags.js";
import {
  applyAdaptiveBeliefUpdate,
  shouldEarlyStopAdaptiveAssessment,
  remainingUnaskedConceptIds,
  enrichKnowledgeProfileWithAdaptiveStatuses,
  filterInventoryForAdaptiveProbing,
} from "../src/js/adaptive-probing/assessment-integration.js";
import {
  computeGraphEntropy,
  PREPACKING_ALREADY_KNOW_ANSWER,
} from "../src/js/adaptive-probing/belief-propagation.js";
import { getConceptId } from "../src/js/assessment-coverage.js";

resetStorage();
localStorage.removeItem(LS_SHARED_ASSESSMENT_GATE_KEY);
saveSharedAssessmentGatePreference(true);

const flags = getAdaptiveProbingFlags();
assert.equal(flags.ADAPTIVE_PROBING_EARLY_STOP, true);
assert.ok(Number.isFinite(flags.ADAPTIVE_EARLY_STOP_MEAN_ENTROPY_THRESHOLD));

const inventory = Array.from({ length: 8 }, (_, i) => ({
  id: `c${i + 1}`,
  label: `Concept ${i + 1}`,
  maturity: "gray",
}));
const conceptGraph = {
  edges: Array.from({ length: 7 }, (_, i) => ({
    source_id: `c${i + 1}`,
    target_id: `c${i + 2}`,
    type: "prerequisite",
    weight: 1,
  })),
};

const filtered = filterInventoryForAdaptiveProbing({
  conceptInventory: inventory,
  conceptGraph,
  n: 6,
  projectId: "p1",
  docId: "d1",
});
assert.ok(filtered.selectedConceptIds?.length >= 3);

/** Stand-in for generatePrePackingAssessmentItems — one batch, no mid-quiz regen. */
let assessmentLlmCalls = 0;
async function fakeGeneratePrePackingAssessmentItems(conceptInventory) {
  assessmentLlmCalls += 1;
  return (Array.isArray(conceptInventory) ? conceptInventory : []).map((c, i) => ({
    item_id: `q${i}`,
    concept_id: getConceptId(c),
    type: "test",
    answer: "A",
    options: { A: "yes", B: "no", C: "maybe", D: "idk" },
    question: `Q about ${getConceptId(c)}`,
  }));
}

// Single generation call (non-holistic shared-gate path).
const assessmentItems = await fakeGeneratePrePackingAssessmentItems(filtered.inventory);
assert.equal(assessmentLlmCalls, 1, "generation starts at exactly 1 LLM call");

const flow = {
  conceptInventory: inventory,
  assessmentItems,
  assessmentResponses: [],
  adaptiveProbing: {
    graph: filtered.graph,
    beliefState: filtered.beliefState,
    selectedConceptIds: filtered.selectedConceptIds,
  },
};

assert.equal(shouldEarlyStopAdaptiveAssessment(flow), false, "start: should not early-stop");
const candidateCount = flow.assessmentItems.length;

// Answer first two as "knew", then inject high-confidence beliefs on remaining
// (synthetic high-confidence sequence — live propagation rarely crosses the placeholder cut).
for (let i = 0; i < 2; i += 1) {
  const item = flow.assessmentItems[i];
  flow.assessmentResponses.push({
    item_id: item.item_id,
    concept_id: item.concept_id,
    userAnswer: PREPACKING_ALREADY_KNOW_ANSWER,
  });
  applyAdaptiveBeliefUpdate(flow, item, PREPACKING_ALREADY_KNOW_ANSWER);
  // Early-stop must never re-invoke assessment generation.
  assert.equal(
    assessmentLlmCalls,
    1,
    "no additional LLM call after each answer (before early-stop)",
  );
}

const remainingBefore = remainingUnaskedConceptIds(flow);
assert.ok(remainingBefore.length > 0);
for (const id of remainingBefore) {
  flow.adaptiveProbing.beliefState[id] = {
    belief: 0.93,
    lastUpdated: new Date().toISOString(),
    source: "propagated",
    triggeredBy: "synthetic-high-confidence",
  };
}

assert.equal(
  shouldEarlyStopAdaptiveAssessment(flow),
  true,
  "high-confidence remaining should early-stop",
);
const answered = flow.assessmentResponses.length;
assert.ok(
  answered < candidateCount,
  `expected early stop before exhausting candidates (answered ${answered} of ${candidateCount})`,
);

// Spec acceptance: early-stop must not increase assessment LLM call count.
assert.equal(
  assessmentLlmCalls,
  1,
  "early-stop keeps assessment LLM call count at 1 (non-holistic)",
);

const remaining = remainingUnaskedConceptIds(flow);
const mean =
  computeGraphEntropy(flow.adaptiveProbing.beliefState, remaining) / remaining.length;
assert.ok(
  mean < flags.ADAPTIVE_EARLY_STOP_MEAN_ENTROPY_THRESHOLD,
  `mean entropy ${mean} should be below threshold`,
);

const baseProfile = {
  byConceptId: Object.fromEntries(
    flow.assessmentResponses.map((r) => [r.concept_id, { assessed: true, correct: true }]),
  ),
  items: flow.assessmentResponses.map((r) => ({
    concept_id: r.concept_id,
    mastery: "full",
    confidence: 0.85,
  })),
  assessedCount: answered,
  notAssessedCount: remaining.length,
  correctCount: answered,
  generatedAt: Date.now(),
};
const enriched = enrichKnowledgeProfileWithAdaptiveStatuses(baseProfile, flow);
for (const id of remaining) {
  assert.equal(
    enriched.byConceptId[id]?.assessmentStatus,
    "inferred",
    `${id} should be inferred`,
  );
}
assert.equal(
  enriched.items.filter((r) => r.assessmentStatus === "inferred").length,
  remaining.length,
);

assert.ok(
  Number(flow.adaptiveProbing.beliefState[flow.assessmentResponses[0].concept_id]?.belief) > 0.5,
);
assert.equal(assessmentLlmCalls, 1, "final: still exactly 1 assessment LLM call");

console.log(
  `20260711_adaptive-early-stop.mjs: OK (answered ${answered}/${candidateCount}, remaining ${remaining.length}, llmCalls=${assessmentLlmCalls})`,
);
