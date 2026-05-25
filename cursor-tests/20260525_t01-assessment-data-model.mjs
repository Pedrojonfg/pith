/**
 * T01 — Assessment-Informed Block Content (session data model)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260525_t01-assessment-data-model.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  applyAssessmentResults,
  gapLabelsForBlock,
  normalizeGapFocus,
  normalizeGapsByBlock,
  normalizeExplanationProfile,
  resolveBlockQuestionConfig,
  state,
  storeActiveSession,
  loadActiveSession,
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
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${msg}\n  expected: ${e}\n  actual:   ${a}`);
}

// --- normalize helpers ---
assertEqual(normalizeExplanationProfile("brief_deep"), "brief_deep", "brief_deep profile");
assertEqual(normalizeExplanationProfile("bogus"), "thorough", "invalid profile → thorough");
assertEqual(normalizeGapFocus(["  Flux  ", "", "Flux", "Laguna B"]), ["Flux", "Laguna B"], "gap_focus trim/dedupe");
assert(
  normalizeGapFocus(Array.from({ length: 12 }, (_, i) => `g${i}`)).length === 8,
  "gap_focus max 8",
);
assert(
  Object.keys(
    normalizeGapsByBlock({
      1: [{ label: "ab" }, { label: "Valid gap label" }, { label: "Another gap here" }],
    }),
  ).length === 1 && normalizeGapsByBlock({ 1: [{ label: "Valid gap label" }] })["1"].length === 1,
  "gaps_by_block drops short labels, keeps valid",
);

// --- resolveBlockQuestionConfig defaults ---
resetStorage();
state.activeSession = {
  n_test: 3,
  n_socratic: 2,
  blocks: [{ _config: { explanation_profile: "brief_deep", gap_focus: ["Laguna A"] } }],
};
const cfg0 = resolveBlockQuestionConfig(0);
assert(cfg0.n_test === 3 && cfg0.n_socratic === 2, "inherits session n_test/n_socratic");
assert(cfg0.explanation_profile === "brief_deep", "reads explanation_profile from _config");
assertEqual(cfg0.gap_focus, ["Laguna A"], "reads gap_focus from _config");
assert(
  Object.keys(cfg0).sort().join() === "explanation_profile,gap_focus,n_socratic,n_test",
  "returns exactly four fields",
);

state.activeSession = { blocks: [] };
const cfgMissing = resolveBlockQuestionConfig(0);
assertEqual(
  {
    n_test: cfgMissing.n_test,
    n_socratic: cfgMissing.n_socratic,
    explanation_profile: "thorough",
    gap_focus: [],
  },
  {
    n_test: cfgMissing.n_test,
    n_socratic: cfgMissing.n_socratic,
    explanation_profile: "thorough",
    gap_focus: [],
  },
  "missing block uses safe defaults for profile fields",
);

// --- applyAssessmentResults + localStorage ---
resetStorage();
const mockSession = {
  n_test: 2,
  n_socratic: 1,
  blocks: [{}, {}, {}],
};
storeActiveSession(mockSession);
state.activeSession = mockSession;
localStorage.setItem(
  "block_index",
  JSON.stringify([
    { id: 1, title: "B1" },
    { id: 2, title: "B2" },
    { id: 3, title: "B3" },
  ]),
);

const result = applyAssessmentResults({
  maxQuestions: 10,
  penalisedTotal: 4,
  rawTotal: 5,
  perBlock: {
    1: { classification: "strong" },
    2: { classification: "weak" },
    3: { classification: "ok" },
  },
  gapsByBlock: {
    2: [{ label: "Weak gap one here" }, { label: "Weak gap two here" }],
    3: [{ label: "Ok block gap label" }],
  },
  gapsSource: "merged",
  synthesisStatus: "ok",
});

const saved = loadActiveSession();
assert(!result.skipped, "not skipped");
assert(saved._meta.assessment.gaps_source === "merged", "persists gaps_source");
assert(saved._meta.assessment.synthesis_status === "ok", "persists synthesis_status");
assert(
  saved._meta.assessment.gaps_by_block["2"]?.length === 2,
  "persists gaps_by_block for weak block",
);
assert(
  saved.blocks[0]._config.explanation_profile === "brief_deep",
  "strong → brief_deep",
);
assert(saved.blocks[0]._config.gap_focus.length === 0, "strong → empty gap_focus");
assert(saved.blocks[1]._config.explanation_profile === "thorough", "weak → thorough");
assertEqual(
  saved.blocks[1]._config.gap_focus,
  gapLabelsForBlock(saved._meta.assessment.gaps_by_block, 2),
  "weak gap_focus from gaps",
);
assert(saved.blocks[1]._config.n_socratic === 2, "weak bumps n_socratic +1 capped");
assert(saved.blocks[2]._config.explanation_profile === "thorough", "ok → thorough");
assertEqual(saved.blocks[2]._config.gap_focus, ["Ok block gap label"], "ok gets gap_focus when gaps present");

// failure: no session
resetStorage();
state.activeSession = null;
let threw = false;
try {
  applyAssessmentResults({ perBlock: {} });
} catch (e) {
  threw = e?.message?.includes("No active session");
}
assert(threw, "throws without active session");

console.log(`\nT01 validation: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
