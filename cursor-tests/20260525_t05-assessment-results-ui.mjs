/**
 * T05 — assessment accept payload: parallel C merge + applyAssessmentResults
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260525_t05-assessment-results-ui.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  applyAssessmentResults,
  gapLabelsForBlock,
  loadActiveSession,
  mergeGapLists,
  state,
  storeActiveSession,
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

function assertEqual(actual, expected, msg) {
  assert(actual === expected, `${msg}\n  expected: ${expected}\n  actual:   ${actual}`);
}

function resolveGapsSourceForTest({ userTouched, synthesisStatus, synthesisDraft, merged }) {
  const hasGaps = merged && typeof merged === "object" && Object.keys(merged).length > 0;
  if (!hasGaps) return "none";
  const hadSynthesis =
    synthesisStatus === "ok" &&
    synthesisDraft &&
    typeof synthesisDraft === "object" &&
    Object.keys(synthesisDraft).length > 0;
  if (userTouched && hadSynthesis) return "merged";
  if (userTouched) return "user";
  return "synthesis";
}

// --- accept merge: synthesis only ---
const synthesisOnly = mergeGapLists(
  { gaps_by_block: { 1: [{ label: "Flux through surface" }] } },
  {},
);
assert(
  gapLabelsForBlock(synthesisOnly, 1).includes("Flux through surface"),
  "accept path: synthesis gaps available for block 1",
);
assertEqual(
  resolveGapsSourceForTest({
    userTouched: false,
    synthesisStatus: "ok",
    synthesisDraft: synthesisOnly,
    merged: synthesisOnly,
  }),
  "synthesis",
  "gaps_source synthesis when user did not edit",
);

// --- accept merge: user override ---
const userOverride = mergeGapLists(
  { gaps_by_block: { 1: [{ label: "Synth gap label here" }] } },
  { 1: [{ label: "User edited gap label" }] },
);
assertEqual(
  resolveGapsSourceForTest({
    userTouched: true,
    synthesisStatus: "ok",
    synthesisDraft: { 1: [{ label: "Synth gap label here" }] },
    merged: userOverride,
  }),
  "merged",
  "gaps_source merged when user edited and synthesis succeeded",
);

// --- timeout fallback: apply still works ---
resetStorage();
const session = {
  n_test: 2,
  n_socratic: 1,
  blocks: [{}, {}],
};
storeActiveSession(session);
state.activeSession = session;
localStorage.setItem(
  "block_index",
  JSON.stringify([
    { id: 1, title: "A" },
    { id: 2, title: "B" },
  ]),
);

applyAssessmentResults({
  perBlock: { 1: { classification: "weak" }, 2: { classification: "strong" } },
  maxQuestions: 10,
  penalisedTotal: 3,
  rawTotal: 4,
  gapsByBlock: {},
  synthesisStatus: "timeout",
  gapsSource: "none",
});

const saved = loadActiveSession();
assert(saved._meta.assessment.synthesis_status === "timeout", "persists synthesis_status timeout on accept");
assert(
  saved.blocks[0]._config.explanation_profile === "thorough",
  "weak block still thorough after timeout (no gaps)",
);
assert(
  saved.blocks[1]._config.explanation_profile === "brief_deep",
  "strong block brief_deep after timeout accept",
);

console.log(`\nT05 validation: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
