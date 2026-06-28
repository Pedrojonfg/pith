/**
 * 20260629 pipeline fixes batch — persist race, large-doc inventory, guard, prep UI
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260629_pipeline-fixes-batch.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildCharFallbackInventoryChunks,
  buildInventoryChunks,
} from "../src/js/api.js";
import {
  isConceptInventoryValid,
  meetsConceptInventoryThreshold,
  resolveCreateSessionPrepStatus,
} from "../src/js/session.js";
import { MIN_CONCEPTS_ABSOLUTE, minViableConcepts } from "../src/js/config/flags.js";
import { normalizePreparationState } from "../src/js/session-types.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const dppSource = readFileSync(join(__dir, "../src/js/document-preparation.js"), "utf8");

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

function mockSession(overrides = {}) {
  return {
    docId: "abc123",
    shared: {
      docMeta: { charCount: 20000 },
      conceptInventory: [{ id: "c1", canonicalId: "c1" }],
      blockRecommendation: { nBlocks: 12 },
      modeRecommendation: { primaryFlow: "rsvp" },
      preparation: normalizePreparationState({ status: "pending" }),
      ...overrides.shared,
    },
    ...overrides,
  };
}

const bigText = "word ".repeat(20000);
const charChunks = buildCharFallbackInventoryChunks(bigText, bigText.length);
assert(charChunks && charChunks.length >= 2, "60k+ word doc → ≥2 char fallback chunks");
assert(buildCharFallbackInventoryChunks("short", 1000) === null, "small doc → no char fallback");

const singleTree = {
  tree: [{ title: "Only", startOffset: 0, endOffset: 500 }],
};
assert(buildInventoryChunks(singleTree, "x".repeat(500)) === null, "single tiny section → null chunks");

const runningValid = mockSession({
  shared: {
    docMeta: { charCount: 20000 },
    conceptInventory: Array.from({ length: 10 }, (_, i) => ({ id: `c${i}` })),
    preparation: { status: "running" },
  },
});
assert(!isConceptInventoryValid(runningValid), "running + inventory → not valid");

const readyValid = mockSession({
  shared: {
    docMeta: { charCount: 20000 },
    conceptInventory: Array.from({ length: 10 }, (_, i) => ({ id: `c${i}` })),
    preparation: { status: "ready" },
  },
});
assert(isConceptInventoryValid(readyValid), "ready + sufficient inventory → valid");

const partialSparse = mockSession({
  shared: {
    docMeta: { charCount: 187086 },
    conceptInventory: Array.from({ length: 11 }, (_, i) => ({ id: `c${i}` })),
    preparation: { status: "partial", failReason: "INVENTORY_TOO_SPARSE" },
    blockRecommendation: { nBlocks: 12 },
    modeRecommendation: { primaryFlow: "rsvp" },
  },
});
assert(
  meetsConceptInventoryThreshold(partialSparse) === false,
  "11 concepts on 187k doc below min 37",
);
assert(
  resolveCreateSessionPrepStatus(partialSparse).includes("reduced"),
  "partial sparse → reduced coverage message",
);

const readyDoc = mockSession({
  shared: {
    docMeta: { charCount: 3000 },
    conceptInventory: Array.from({ length: 8 }, (_, i) => ({ id: `c${i}` })),
    preparation: { status: "ready" },
    blockRecommendation: { nBlocks: 8 },
    modeRecommendation: { primaryFlow: "rsvp" },
  },
});
assert(
  resolveCreateSessionPrepStatus(readyDoc).includes("Document ready"),
  "ready tier1 → document ready message",
);

const mapStart = dppSource.indexOf("runnable.map(async (phaseId)");
const mapEnd = dppSource.indexOf("}),", mapStart);
const mapperSection = mapStart >= 0 ? dppSource.slice(mapStart, mapEnd) : "";
assert(
  mapStart >= 0 && !mapperSection.includes("await persistDoc(doc)"),
  "no persistDoc inside parallel phase mapper",
);
assert(
  dppSource.includes("prep.updatedAt = Date.now()") &&
    dppSource.includes("await persistDoc(doc)"),
  "persistDoc after wave settles",
);

assert(
  dppSource.includes("inventory.length >= MIN_CONCEPTS_ABSOLUTE") &&
    dppSource.includes('setPreparationStatus(prep, "partial")'),
  "T1.2 degraded partial path present",
);
assert(MIN_CONCEPTS_ABSOLUTE === 5, "floor constant");
assert(minViableConcepts(187086) === 37, "187k chars min 37");

console.log(`\n20260629_pipeline-fixes-batch: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
