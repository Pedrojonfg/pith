/**
 * T06 — deterministic dedup (findDeterministicDuplicateMerges)
 * Contract: specs/20260526-block-split-dedup/contracts/deterministic-dedup.md
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260526_t01-deterministic-dedup.mjs
 */
import {
  findDeterministicDuplicateMerges,
  normalizeBlockTitle,
  signatureOverlapCount,
} from "../src/js/session.js";

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

// --- Happy path: contract synthetic index (overlap ≥ 3) ---
const syntheticIndex = [
  { id: 1, title: "Overview: Test", signature: ["a", "b", "c"], chunk: "ov" },
  { id: 2, title: "Topic A", signature: ["flux", "divergence", "curl", "field"], chunk: "a" },
  { id: 3, title: "Topic B", signature: ["flux", "divergence", "curl", "theorem"], chunk: "b" },
];

assert(
  signatureOverlapCount(syntheticIndex[1].signature, syntheticIndex[2].signature) === 3,
  "T06: fixture overlap count is 3",
);

const overlapMerge = findDeterministicDuplicateMerges(syntheticIndex);
assert(overlapMerge.length === 1, "T06: overlap ≥3 → one merge plan");
assert(overlapMerge[0].keep_id === 2 && overlapMerge[0].absorb_ids[0] === 3, "T06: merge block 3 into 2");
assert(overlapMerge[0].reason === "signature_overlap", "T06: reason signature_overlap");
assert(
  overlapMerge[0].overlap_terms.length >= 3,
  "T06: overlap_terms lists shared signature terms",
);

// --- Edge: exactly 2 shared terms → no merge ---
const overlapTwoOnly = [
  { id: 1, title: "Overview: Test", signature: ["a"], chunk: "" },
  { id: 2, title: "X", signature: ["flux", "divergence", "extra"], chunk: "" },
  { id: 3, title: "Y", signature: ["flux", "divergence", "other"], chunk: "" },
];

assert(
  signatureOverlapCount(overlapTwoOnly[1].signature, overlapTwoOnly[2].signature) === 2,
  "T06: overlap-2 fixture count is 2",
);
assert(
  findDeterministicDuplicateMerges(overlapTwoOnly).length === 0,
  "T06: overlap = 2 only → no merge",
);

// --- Happy path: identical normalized title ---
const titleDupIndex = [
  { id: 1, title: "Overview: Course", signature: ["only", "here"], chunk: "" },
  { id: 2, title: "Stokes Theorem", signature: ["alpha", "beta", "gamma"], chunk: "" },
  { id: 3, title: "stokes theorem", signature: ["delta", "epsilon", "zeta"], chunk: "" },
];

assert(
  normalizeBlockTitle(titleDupIndex[1].title) === normalizeBlockTitle(titleDupIndex[2].title),
  "T06: title fixture normalizes to same string",
);

const titleMerge = findDeterministicDuplicateMerges(titleDupIndex);
assert(titleMerge.length === 1, "T06: title duplicate → one merge plan");
assert(titleMerge[0].keep_id === 2 && titleMerge[0].absorb_ids[0] === 3, "T06: title dup merges 3 into 2");
assert(titleMerge[0].reason === "title_duplicate", "T06: reason title_duplicate");

// --- Edge: overview vs key terms — signature overlap skipped unless title match ---
const overviewVsKeyTerms = [
  { id: 1, title: "Overview: Course", signature: ["flux", "divergence", "curl"], chunk: "" },
  { id: 2, title: "Key terms: Calc", signature: ["flux", "divergence", "curl"], chunk: "" },
];

assert(
  findDeterministicDuplicateMerges(overviewVsKeyTerms).length === 0,
  "T06: overview vs key terms (different titles) → no merge despite overlap ≥3",
);

// --- Failure / guard: empty or single block ---
assert(findDeterministicDuplicateMerges([]).length === 0, "T06: empty index → no plans");
assert(
  findDeterministicDuplicateMerges([{ id: 1, title: "Solo", signature: ["a", "b", "c"], chunk: "" }]).length === 0,
  "T06: single block → no plans",
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
