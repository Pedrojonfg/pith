/**
 * T05 — study.js wire: splitRunMeta UI copy + twoPhaseConceptSplit progress
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260526_t05-study-split-wire.mjs
 */
import { describeSplitRunMetaForUi } from "../src/js/session.js";

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

// M < N message (SC-003)
const fewerBlocks = describeSplitRunMetaForUi({
  requested_n: 20,
  final_n: 12,
  pipeline: "two_phase",
  dedup_merged_count: 0,
});
assert(
  fewerBlocks.headline.includes("Pediste 20") && fewerBlocks.headline.includes("sustentó 12"),
  "T05: M vs N headline when final < requested",
);
assert(!fewerBlocks.hidden, "T05: summary visible when final_n set");

// Dedup line (SC-004)
const withDedup = describeSplitRunMetaForUi({
  requested_n: 15,
  final_n: 14,
  dedup_merged_count: 1,
  dedup_merges: [
    {
      keep_id: 2,
      absorb_ids: [3],
      reason: "signature_overlap",
      overlap_terms: ["flux", "divergence", "curl"],
    },
  ],
});
assert(
  withDedup.dedupLine.includes("1 bloques fusionados"),
  "T05: dedup merged count line",
);
assert(withDedup.detailRows.length === 1, "T05: dedup detail rows");
assert(withDedup.detailRows[0].reason === "signature_overlap", "T05: dedup reason preserved");

// Fallback pipeline note
const fallback = describeSplitRunMetaForUi({
  requested_n: 15,
  final_n: 15,
  pipeline: "fallback_mono",
});
assert(fallback.headline.includes("fallback"), "T05: fallback_mono message");

// Null / empty hides summary
const hidden = describeSplitRunMetaForUi(null);
assert(hidden.hidden, "T05: null meta hides summary");

// Equal M and N — no "Pediste" line
const exact = describeSplitRunMetaForUi({ requested_n: 10, final_n: 10, pipeline: "two_phase" });
assert(!exact.headline.includes("sustentó"), "T05: no M vs N when counts match");
assert(exact.headline.includes("10 blocks"), "T05: default complete headline");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
