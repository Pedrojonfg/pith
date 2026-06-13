/**
 * Post A+ T10 — LLM cross-document prerequisite inference
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260619_kv-post-t10.mjs
 */
import { readFileSync } from "node:fs";
import { resetStorage } from "./setup-dom.mjs";
import {
  INFERENCE_COOLDOWN_MS,
  INFERENCE_MIN_DOCS,
  countDocsForTopic,
  maybeInferPrerequisites,
  shouldRunInference,
  acceptPendingInferredEdge,
  rejectPendingInferredEdge,
} from "../src/js/vault/prerequisite-graph.js";
import {
  addManualEntry,
  clearVault,
  loadVault,
  saveVault,
} from "../src/js/vault/vault-store.js";

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

function getEntry(id) {
  return loadVault().entries.find((e) => e.id === id);
}

function seedEntryWithDocs(title, topic, docIds) {
  const entry = addManualEntry({ canonicalTitle: title, topic });
  const vault = loadVault();
  const row = vault.entries.find((e) => e.id === entry.id);
  row.sources = docIds.map((docId, i) => ({
    docId,
    conceptId: `${docId}-c${i}`,
    addedAt: Date.now(),
  }));
  saveVault(vault);
  return entry;
}

resetStorage();
clearVault();

// happy: countDocsForTopic counts unique doc ids
const e1 = seedEntryWithDocs("A", "calculus", ["doc1", "doc2"]);
const e2 = seedEntryWithDocs("B", "calculus", ["doc2", "doc3"]);
assert(countDocsForTopic(loadVault(), "calculus") === 3, "happy: countDocsForTopic dedupes doc ids");
assert(countDocsForTopic(loadVault(), "physics") === 0, "happy: unrelated topic returns 0");

// happy: shouldRunInference false below 5 docs
clearVault();
for (let i = 0; i < 4; i += 1) {
  seedEntryWithDocs(`C${i}`, "biology", [`bio-doc-${i}`]);
}
const vault4 = loadVault();
assert(
  countDocsForTopic(vault4, "biology") === 4,
  "setup: four docs for biology",
);
assert(!shouldRunInference(vault4, "biology"), "happy: inference blocked below 5 docs");

// happy: high-confidence auto-applied, medium queued
clearVault();
const base = seedEntryWithDocs("Limits", "calculus", ["d1"]);
const dep = seedEntryWithDocs("Derivatives", "calculus", ["d2"]);
for (let i = 3; i <= 5; i += 1) {
  seedEntryWithDocs(`Topic filler ${i}`, "calculus", [`d${i}`]);
}
const vault5 = loadVault();
assert(countDocsForTopic(vault5, "calculus") >= INFERENCE_MIN_DOCS, "setup: enough docs");

const mockInfer = async () => [
  { fromId: base.id, toId: dep.id, confidence: 0.9 },
  { fromId: dep.id, toId: base.id, confidence: 0.72 },
];

const results = await maybeInferPrerequisites(vault5, "calculus", {
  inferFn: mockInfer,
  now: Date.now(),
});
assert(results.some((r) => r.status === "applied" && r.confidence >= 0.85), "happy: high confidence auto-applied");
assert(results.some((r) => r.status === "queued"), "happy: medium confidence queued");
assert(
  getEntry(dep.id).prerequisites.includes(base.id),
  "happy: auto-applied edge stored as prerequisite",
);

const afterInfer = loadVault();
assert(
  (afterInfer.pendingInferredEdges || []).length === 1,
  "happy: one pending edge in vault meta",
);
assert(
  afterInfer.pendingInferredEdges[0].fromId === dep.id
    && afterInfer.pendingInferredEdges[0].toId === base.id,
  "happy: pending edge matches medium-confidence suggestion",
);

// edge: 7-day cooldown prevents re-run
assert(
  !shouldRunInference(afterInfer, "calculus", Date.now()),
  "edge: cooldown blocks immediate re-run",
);
assert(
  shouldRunInference(afterInfer, "calculus", Date.now() + INFERENCE_COOLDOWN_MS),
  "edge: cooldown expires after 7 days",
);

const cooldownResults = await maybeInferPrerequisites(afterInfer, "calculus", {
  inferFn: async () => [{ fromId: base.id, toId: dep.id, confidence: 0.95 }],
  now: Date.now(),
});
assert(cooldownResults.length === 0, "edge: maybeInferPrerequisites skips during cooldown");

// contract: accept / reject pending edges
clearVault();
const pFrom = addManualEntry({ canonicalTitle: "PFrom", topic: "logic" });
const pTo = addManualEntry({ canonicalTitle: "PTo", topic: "logic" });
let vPending = loadVault();
vPending.pendingInferredEdges = [{
  id: "pending-test-1",
  fromId: pFrom.id,
  toId: pTo.id,
  confidence: 0.7,
  topic: "logic",
  inferredAt: Date.now(),
}];
saveVault(vPending);

vPending = loadVault();
const accepted = await acceptPendingInferredEdge(vPending, "pending-test-1");
assert(accepted, "contract: acceptPendingInferredEdge succeeds");
assert(
  getEntry(pTo.id).prerequisites.includes(pFrom.id),
  "contract: accepted edge becomes prerequisite",
);
assert(
  (loadVault().pendingInferredEdges || []).length === 0,
  "contract: pending queue cleared after accept",
);

vPending = loadVault();
vPending.pendingInferredEdges = [{
  id: "pending-test-2",
  fromId: pFrom.id,
  toId: pTo.id,
  confidence: 0.65,
  topic: "logic",
  inferredAt: Date.now(),
}];
saveVault(vPending);
const rejected = await rejectPendingInferredEdge(loadVault(), "pending-test-2");
assert(rejected, "contract: rejectPendingInferredEdge succeeds");
assert(
  (loadVault().pendingInferredEdges || []).length === 0,
  "contract: pending queue cleared after reject",
);

// failure: low confidence discarded
clearVault();
seedEntryWithDocs("LowA", "stats", ["s1"]);
seedEntryWithDocs("LowB", "stats", ["s2"]);
for (let i = 3; i <= 5; i += 1) seedEntryWithDocs(`S${i}`, "stats", [`s${i}`]);
const vLow = loadVault();
const lowResults = await maybeInferPrerequisites(vLow, "stats", {
  inferFn: async () => [{ fromId: vLow.entries[0].id, toId: vLow.entries[1].id, confidence: 0.4 }],
  now: Date.now() + INFERENCE_COOLDOWN_MS + 1,
  persist: true,
});
assert(lowResults.length === 0, "failure: confidence below 0.6 discarded");
assert(
  (loadVault().pendingInferredEdges || []).length === 0,
  "failure: no pending row for low confidence",
);

// contract: debug-ui pending queue + api export
const debugUiSrc = readFileSync(new URL("../src/js/vault/debug-ui.js", import.meta.url), "utf8");
assert(debugUiSrc.includes("vault-pending-inference"), "contract: debug-ui renders pending section");
assert(debugUiSrc.includes("Accept") && debugUiSrc.includes("Reject"), "contract: debug-ui Accept/Reject actions");

const apiSrc = readFileSync(new URL("../src/js/api.js", import.meta.url), "utf8");
assert(apiSrc.includes("inferCrossDocumentPrerequisites"), "contract: api.js exports batch inference");

const sessionCloseSrc = readFileSync(new URL("../src/js/vault/session-close.js", import.meta.url), "utf8");
assert(sessionCloseSrc.includes("maybeInferPrerequisites"), "contract: session-close triggers inference");

console.log(`\nPost A+ T10: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
