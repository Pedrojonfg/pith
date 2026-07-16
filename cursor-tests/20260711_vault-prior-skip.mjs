/**
 * Phase C — vault-prior hard exclusion + presumed_known_vault profile status.
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260711_vault-prior-skip.mjs
 *
 * Open design (not implemented): hub-centrality exemption from vault-skip.
 */
import assert from "node:assert/strict";
import { resetStorage } from "./setup-dom.mjs";
import { LS_SHARED_ASSESSMENT_GATE_KEY } from "../src/js/config.js";
import {
  getAdaptiveProbingFlags,
  saveSharedAssessmentGatePreference,
} from "../src/js/config/flags.js";
import {
  filterInventoryForAdaptiveProbing,
  enrichKnowledgeProfileWithAdaptiveStatuses,
  collectVaultSkippedConceptIds,
} from "../src/js/adaptive-probing/assessment-integration.js";
import { getConceptId } from "../src/js/assessment-coverage.js";
import { priorBeliefForMaturity } from "../src/js/adaptive-probing/belief-state.js";

resetStorage();
localStorage.removeItem(LS_SHARED_ASSESSMENT_GATE_KEY);
saveSharedAssessmentGatePreference(true);

const flags = getAdaptiveProbingFlags();
assert.ok(flags.HIGH_CONFIDENCE_SKIP_THRESHOLD <= 0.85, "threshold must exclude green prior 0.85");
assert.ok(
  priorBeliefForMaturity("green") >= flags.HIGH_CONFIDENCE_SKIP_THRESHOLD,
  "green prior must sit at/above skip threshold",
);

const inventory = [
  { id: "g1", label: "Green One", maturity: "green" },
  { id: "g2", label: "Green Two", maturity: "green" },
  { id: "y1", label: "Yellow One", maturity: "yellow" },
  { id: "y2", label: "Yellow Two", maturity: "yellow" },
  { id: "x1", label: "Gray One", maturity: "gray" },
  { id: "x2", label: "Gray Two", maturity: "gray" },
  { id: "x3", label: "Gray Three", maturity: "gray" },
];
const conceptGraph = {
  edges: [
    { source_id: "x1", target_id: "x2", type: "prerequisite", weight: 1 },
    { source_id: "x2", target_id: "x3", type: "prerequisite", weight: 1 },
    { source_id: "y1", target_id: "y2", type: "prerequisite", weight: 1 },
    { source_id: "g1", target_id: "x1", type: "prerequisite", weight: 1 },
  ],
};

const filtered = filterInventoryForAdaptiveProbing({
  conceptInventory: inventory,
  conceptGraph,
  n: 10,
  projectId: "p1",
  docId: "d1",
});

const askedIds = new Set(filtered.inventory.map(getConceptId));
const skipped = filtered.vaultSkippedIds || [];
assert.ok(skipped.includes("g1") && skipped.includes("g2"), "greens must be vault-skipped");
assert.ok(!askedIds.has("g1") && !askedIds.has("g2"), "greens must not appear in question set");

const askedCount = askedIds.size;
const skippedCount = skipped.length;
console.log(
  `vault-prior fixture: skipped=${skippedCount} asked=${askedCount} (inventory=${inventory.length})`,
);
assert.ok(askedCount > 0, "still ask some concepts");
assert.ok(skippedCount >= 2, "at least the two greens skipped");

const flow = {
  adaptiveProbing: {
    beliefState: filtered.beliefState,
    selectedConceptIds: filtered.selectedConceptIds,
    vaultSkippedIds: skipped,
  },
  assessmentResponses: [],
  assessmentItems: [],
};
const profile = enrichKnowledgeProfileWithAdaptiveStatuses(
  {
    byConceptId: {},
    items: [],
    assessedCount: 0,
    notAssessedCount: inventory.length,
    correctCount: 0,
    generatedAt: Date.now(),
  },
  flow,
);

for (const id of ["g1", "g2"]) {
  assert.equal(
    profile.byConceptId[id]?.assessmentStatus,
    "presumed_known_vault",
    `${id} profile status`,
  );
}
assert.ok(
  profile.items.some((r) => r.concept_id === "g1" && r.assessmentStatus === "presumed_known_vault"),
);

const collected = collectVaultSkippedConceptIds(inventory, filtered.beliefState, flags);
assert.deepEqual(new Set(collected), new Set(skipped));

console.log("20260711_vault-prior-skip.mjs: OK");
