/**
 * T06 — Cloze reads shared (skip phase 0 + SM-2)
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  createSession,
  getActiveSession,
  setActiveSession,
  upsertSmItem,
  getSession,
} from "../src/js/session-store.js";
import { epistemicGraphFromShared } from "../src/js/cloze/pipeline.js";

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${msg}`);
}

resetStorage();

// Happy: epistemicGraphFromShared seeds nodes with canonicalId
const concepts = [
  { canonicalId: "abc123def456", label: "Episteme", definition: "Knowledge" },
  { canonicalId: "def456abc123", label: "Doxa", definition: "Opinion" },
];
const graph = epistemicGraphFromShared({ conceptInventory: concepts });
assert(graph.nodes.length === 2, "fromShared: two nodes");
assert(graph.nodes.some((n) => n.id === "abc123def456"), "fromShared: uses canonicalId");

// Edge: empty inventory
assert(epistemicGraphFromShared({ conceptInventory: [] }).nodes.length === 0, "fromShared: empty");

// Skip phase 0 condition: >= 5 concepts in shared
resetStorage();
const doc = await createSession("# Paper\n\n".repeat(50));
doc.shared.conceptInventory = Array.from({ length: 5 }, (_, i) => ({
  canonicalId: `c${i}`.padEnd(12, "0"),
  label: `Concept ${i}`,
  definition: "",
  detectedBy: "slow",
}));
const { saveActiveSession } = await import("../src/js/session-store.js");
saveActiveSession(doc);
setActiveSession(doc.docId);
const seeded = epistemicGraphFromShared(getActiveSession().shared);
assert(seeded.nodes.length === 5, "skip phase0: graph from 5 shared concepts");

// SM-2 upsert via shared pool
upsertSmItem(doc.docId, {
  id: "cloze:item1",
  sourceMode: "cloze",
  question: "Blank?",
  answer: "Fill",
  easeFactor: 2.5,
  interval: 0,
  nextReview: Date.now(),
  reviewCount: 0,
});
assert(getSession(doc.docId).shared.smItems.length === 1, "smItems in shared");

// Failure: upsert without id throws
let threw = false;
try {
  upsertSmItem(doc.docId, { sourceMode: "cloze" });
} catch (e) {
  threw = /requires id/i.test(String(e.message));
}
assert(threw, "upsertSmItem rejects missing id");

console.log(`\nT06 cloze-shared: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
