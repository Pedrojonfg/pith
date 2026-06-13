/**
 * Post A+ T08 — optional BKT path at ≥15 observations per entry
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260619_kv-post-t08.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  BKT_OBSERVATION_THRESHOLD,
  DECLARATIVE_WEIGHT,
  DEFAULT_BKT_PARAMS,
  PROCEDURAL_WEIGHT,
  bktMastery,
  getCurrentMastery,
  maybeEnableBkt,
  updateMastery,
} from "../src/js/vault/mastery-model.js";

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

function assertClose(actual, expected, msg, eps = 0.02) {
  assert(Math.abs(actual - expected) <= eps, `${msg} (expected ~${expected}, got ${actual})`);
}

function makeEntry(overrides = {}) {
  const now = Date.now();
  return {
    id: "e1",
    canonicalTitle: "Concept",
    aliases: [],
    topic: "math",
    masteryBase: 0.5,
    masteryLastUpdated: now,
    masteryDeclarativeBase: 0.5,
    masteryProceduralBase: 0.5,
    masteryDeclarativeLastUpdated: now,
    masteryProceduralLastUpdated: now,
    lastSeen: now,
    sources: [],
    prerequisites: [],
    dependents: [],
    observations: [],
    ...overrides,
  };
}

function makeObservations(count, type = "mcq_correct") {
  const ts = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    type,
    rawSignal: 0.6,
    timestamp: ts + i,
    docId: "d1",
    taskKind: "declarative",
  }));
}

resetStorage();

assert(BKT_OBSERVATION_THRESHOLD === 15, "contract: BKT gate at 15 observations");

// --- maybeEnableBkt (happy / edge / failure) ---

const sparse = makeEntry({ observations: makeObservations(14) });
maybeEnableBkt(sparse);
assert(sparse.useBkt !== true, "happy: 14 obs does not enable BKT");

const dense = makeEntry({ observations: makeObservations(15) });
maybeEnableBkt(dense);
assert(dense.useBkt === true, "happy: 15 obs enables BKT");
assert(dense.bktParams?.pL0 === DEFAULT_BKT_PARAMS.pL0, "happy: default bktParams seeded on enable");

maybeEnableBkt(dense);
assert(dense.useBkt === true, "edge: maybeEnableBkt is idempotent");

maybeEnableBkt(null);
assert(true, "failure: maybeEnableBkt ignores null entry");

// --- getCurrentMastery routing (happy / edge) ---

const weightedEntry = makeEntry({
  masteryDeclarativeBase: 0.8,
  masteryProceduralBase: 0.2,
  observations: makeObservations(14),
});
const expectedWeighted = DECLARATIVE_WEIGHT * 0.8 + PROCEDURAL_WEIGHT * 0.2;
assertClose(
  getCurrentMastery(weightedEntry),
  expectedWeighted,
  "happy: 14 obs uses weighted average, not BKT",
);

const bktEntry = makeEntry({
  useBkt: true,
  bktParams: { ...DEFAULT_BKT_PARAMS },
  observations: [{ type: "mcq_correct", rawSignal: 0.6, timestamp: Date.now() }],
});
assertClose(
  getCurrentMastery(bktEntry),
  bktMastery(bktEntry, bktEntry.observations),
  "happy: useBkt routes to bktMastery",
);

const legacySparse = {
  masteryBase: 0.55,
  masteryLastUpdated: Date.now(),
  observations: makeObservations(3),
};
assertClose(getCurrentMastery(legacySparse), 0.55, "edge: sparse legacy entry unchanged");

// --- bktMastery replay (happy / failure) ---

const allCorrect = makeEntry({
  observations: makeObservations(5, "mcq_correct"),
});
const allCorrectMastery = bktMastery(allCorrect, allCorrect.observations);
assert(allCorrectMastery > DEFAULT_BKT_PARAMS.pL0, "happy: repeated correct obs raises BKT mastery");

const mixed = makeEntry({
  observations: [
    { type: "mcq_correct", rawSignal: 0.6, timestamp: 1 },
    { type: "mcq_wrong", rawSignal: -0.3, timestamp: 2 },
    { type: "mcq_correct", rawSignal: 0.6, timestamp: 3 },
  ],
});
const mixedMastery = bktMastery(mixed, mixed.observations);
assert(mixedMastery >= 0 && mixedMastery <= 1, "happy: mixed obs stays in [0,1]");
assert(mixedMastery < allCorrectMastery, "happy: wrong answers lower BKT vs all correct");

assertClose(bktMastery({ bktParams: DEFAULT_BKT_PARAMS }, []), DEFAULT_BKT_PARAMS.pL0, "edge: empty obs → pL0");

// --- updateMastery gate (happy) ---

const growing = makeEntry({
  masteryDeclarativeBase: 0.4,
  masteryProceduralBase: 0.6,
  observations: makeObservations(14),
});
const beforeFifteenth = getCurrentMastery(growing);
assert(growing.useBkt !== true, "happy: 14 stored obs before 15th update");

updateMastery(growing, { type: "mcq_correct", timestamp: Date.now(), docId: "d1" });
assert(growing.observations.length === 15, "happy: 15th observation appended");
assert(growing.useBkt === true, "happy: 15th updateMastery enables BKT");
assertClose(
  getCurrentMastery(growing),
  bktMastery(growing, growing.observations),
  "happy: mastery after enable uses BKT replay",
);
assert(
  Math.abs(getCurrentMastery(growing) - beforeFifteenth) > 0.001 ||
    getCurrentMastery(growing) !== DECLARATIVE_WEIGHT * 0.4 + PROCEDURAL_WEIGHT * 0.6,
  "happy: post-BKT mastery no longer pure weighted blend of stale bases",
);

const stillSparse = makeEntry();
for (let i = 0; i < 5; i += 1) {
  updateMastery(stillSparse, { type: "mcq_correct", timestamp: Date.now() + i, docId: "d1" });
}
assert(stillSparse.useBkt !== true, "edge: 5 obs stays on weighted path");
assert(stillSparse.observations.length === 5, "edge: sparse entry accumulates observations");
assert(
  stillSparse.masteryDeclarativeBase > 0.5,
  "edge: sparse entry still updates declarative mastery",
);

console.log(`\n20260619_kv-post-t08: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
