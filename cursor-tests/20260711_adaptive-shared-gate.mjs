/**
 * Phase B T03 — shared-gate adaptive filter preserves EIG order; no extra LLM calls.
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260711_adaptive-shared-gate.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resetStorage } from "./setup-dom.mjs";
import { LS_SHARED_ASSESSMENT_GATE_KEY } from "../src/js/config.js";
import {
  isAdaptiveProbingEnabled,
  saveSharedAssessmentGatePreference,
} from "../src/js/config/flags.js";
import {
  filterInventoryForAdaptiveProbing,
  prepareAdaptiveProbingContext,
} from "../src/js/adaptive-probing/assessment-integration.js";
import { nextProbeBatch } from "../src/js/adaptive-probing/eig-selection.js";
import { getConceptId } from "../src/js/assessment-coverage.js";

const __dir = dirname(fileURLToPath(import.meta.url));

function makeInventory(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i + 1}`,
    label: `Concept ${i + 1}`,
    maturity: "gray",
  }));
}

function makeChainGraph(n) {
  const edges = [];
  for (let i = 1; i < n; i += 1) {
    edges.push({
      source_id: `c${i}`,
      target_id: `c${i + 1}`,
      type: "prerequisite",
      weight: 1,
    });
  }
  return { edges };
}

resetStorage();
localStorage.removeItem(LS_SHARED_ASSESSMENT_GATE_KEY);
saveSharedAssessmentGatePreference(true);
assert.equal(isAdaptiveProbingEnabled(), true);

const inventoryForward = makeInventory(10);
// Reverse presentation order so inventory.filter order ≠ EIG order.
const inventory = [...inventoryForward].reverse();
const conceptGraph = makeChainGraph(10);
const n = 5;

const { graph, beliefState } = prepareAdaptiveProbingContext({
  conceptInventory: inventory,
  conceptGraph,
  projectId: "p1",
  docId: "d1",
});
const eigOrder = nextProbeBatch(graph, beliefState, n).map((b) => b.conceptId);
assert.ok(eigOrder.length > 0, "EIG batch non-empty");

const filtered = filterInventoryForAdaptiveProbing({
  conceptInventory: inventory,
  conceptGraph,
  n,
  projectId: "p1",
  docId: "d1",
});
const filteredIds = filtered.inventory.map(getConceptId);
assert.deepEqual(
  filteredIds,
  eigOrder,
  "adaptive filter inventory order must match EIG batch order",
);

const inventoryOrderOfSelected = inventory
  .map(getConceptId)
  .filter((id) => eigOrder.includes(id))
  .slice(0, eigOrder.length);
assert.notDeepEqual(
  eigOrder,
  inventoryOrderOfSelected,
  "fixture must make EIG order differ from inventory appearance order",
);

// Shared-gate path contract: study.js createPrePackingItemsPromise uses adaptive filter.
const studySrc = readFileSync(join(__dir, "../src/js/study.js"), "utf8");
assert.ok(
  studySrc.includes("runnerMode: \"shared_gate\""),
  "shared_gate runner mode exists",
);
assert.ok(
  studySrc.includes("filterInventoryForAdaptiveProbing"),
  "createPrePackingItemsPromise wires adaptive filter",
);
assert.ok(
  /async function startSharedAssessmentFromGate[\s\S]*enterPrePackingAssessmentScreen/.test(
    studySrc,
  ),
  "shared-gate accept enters pre-packing assessment screen",
);

// LLM call count: generation remains a single batch for the filtered inventory.
let llmCalls = 0;
async function fakeGenerate({ conceptInventory: inv }) {
  llmCalls += 1;
  return inv.map((c, i) => ({
    type: "test",
    concept_id: getConceptId(c),
    item_id: `q${i}`,
    question: `Q${i}`,
    options: { A: "a", B: "b", C: "c", D: "d" },
    answer: "A",
  }));
}
const questions = await fakeGenerate({ conceptInventory: filtered.inventory });
assert.equal(llmCalls, 1, "non-holistic assessment stays a single LLM batch");
assert.equal(questions.length, filtered.inventory.length);
assert.deepEqual(
  questions.map((q) => q.concept_id),
  eigOrder,
);

console.log("20260711_adaptive-shared-gate.mjs: OK");
