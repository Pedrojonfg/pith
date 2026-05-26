/**
 * T09 — Dictionary per-block store + aggregate UI
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260527_t09-dictionary-per-block.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  LS_SESSION_CONCEPTS_KEY,
  LS_SESSION_CONCEPTS_BY_BLOCK_KEY,
} from "../src/js/config.js";
import {
  commitSessionConceptsForBlock,
  getSortedSessionConcepts,
  loadConceptsByBlock,
  setBlockConcepts,
  syncConceptsFromBlock,
} from "../src/js/dictionary.js";
import { storeActiveSession, state } from "../src/js/session.js";

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

// --- Happy: setBlockConcepts → aggregate includes term ---
resetStorage();
setBlockConcepts(1, [{ term: "Foo", definition: "Bar" }]);
const sortedFoo = getSortedSessionConcepts();
assert(
  sortedFoo.some((c) => c.term === "Foo" && c.definition === "Bar"),
  "setBlockConcepts(1) → getSortedSessionConcepts includes Foo",
);
const map1 = loadConceptsByBlock();
assert(map1["1"]?.[0]?.term === "Foo", "per-block map stores block 1");

// --- Edge: update block 1 does not erase block 0 ---
setBlockConcepts(0, [{ term: "Alpha", definition: "First" }]);
setBlockConcepts(1, [{ term: "Beta", definition: "Second" }]);
const both = getSortedSessionConcepts();
assert(
  both.some((c) => c.term === "Alpha") && both.some((c) => c.term === "Beta"),
  "blocks 0 and 1 both present after block 1 replace",
);
assert(loadConceptsByBlock()["0"]?.[0]?.term === "Alpha", "block 0 entry preserved");

// --- syncConceptsFromBlock alias ---
resetStorage();
syncConceptsFromBlock(2, [{ term: "SyncTerm", definition: "via sync" }]);
assert(
  getSortedSessionConcepts().some((c) => c.term === "SyncTerm"),
  "syncConceptsFromBlock writes to aggregate",
);

// --- Legacy ∪ per-block dedup (richer definition wins) ---
resetStorage();
localStorage.setItem(
  LS_SESSION_CONCEPTS_KEY,
  JSON.stringify([{ term: "Legacy", definition: "" }]),
);
setBlockConcepts(0, [{ term: "Legacy", definition: "From block" }, { term: "OnlyBlock", definition: "B" }]);
const merged = getSortedSessionConcepts();
const legacyEntry = merged.find((c) => c.term === "Legacy");
assert(legacyEntry?.definition === "From block", "dedup: block definition fills empty legacy");
assert(merged.some((c) => c.term === "OnlyBlock"), "block-only term in aggregate");

// --- commitSessionConceptsForBlock idempotent (legacy path) ---
resetStorage();
const blockConcepts = [{ term: "CommitMe", definition: "once" }];
const sess = {
  n_blocks: 1,
  blocks: [{ explanation: "x", questions: [], concepts: blockConcepts }],
};
storeActiveSession(sess);
state.activeSession = sess;
commitSessionConceptsForBlock(0);
commitSessionConceptsForBlock(0);
const legacyAfter = JSON.parse(localStorage.getItem(LS_SESSION_CONCEPTS_KEY) || "[]");
assert(
  legacyAfter.filter((c) => c.term === "CommitMe").length === 1,
  "commitSessionConceptsForBlock is idempotent in legacy store",
);
assert(
  getSortedSessionConcepts().some((c) => c.term === "CommitMe"),
  "committed term visible in aggregate",
);

// --- Failure-ish: empty concepts clears block slot ---
setBlockConcepts(3, [{ term: "Gone", definition: "x" }]);
setBlockConcepts(3, []);
const mapEmpty = loadConceptsByBlock();
assert(Array.isArray(mapEmpty["3"]) && mapEmpty["3"].length === 0, "empty concepts → [] for block");

// --- Keys use string indices in storage ---
resetStorage();
setBlockConcepts(1, [{ term: "KeyCheck", definition: "x" }]);
assert(
  JSON.parse(localStorage.getItem(LS_SESSION_CONCEPTS_BY_BLOCK_KEY) || "{}")["1"]?.[0]?.term === "KeyCheck",
  "storage keys are stringified block indices",
);

console.log(`\nT09 dictionary per-block: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
