/**
 * T03 — applyAssessmentResults pedagogical profiles + R8 gap budget
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260525_t03-apply-assessment-profiles.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  adjustQuestionBudgetForGaps,
  applyAssessmentResults,
  loadActiveSession,
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
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${msg}\n  expected: ${e}\n  actual:   ${a}`);
}

// --- R8 helper (unit) ---
assertEqual(adjustQuestionBudgetForGaps(2, 2, 3), { n_test: 2, n_socratic: 2 }, "R8 no-op when gaps <= budget");
assertEqual(adjustQuestionBudgetForGaps(2, 2, 5), { n_test: 3, n_socratic: 2 }, "R8 raises n_test then n_socratic");
assertEqual(adjustQuestionBudgetForGaps(2, 1, 8), { n_test: 5, n_socratic: 3 }, "R8 caps at 8 total for 8 gaps");

// --- applyAssessmentResults profiles ---
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

applyAssessmentResults({
  perBlock: {
    1: { classification: "strong" },
    2: { classification: "weak" },
    3: { classification: "ok" },
  },
  gapsByBlock: {
    2: [
      { label: "Gap one label ok" },
      { label: "Gap two label ok" },
      { label: "Gap three label ok" },
      { label: "Gap four label ok" },
      { label: "Gap five label ok" },
    ],
    3: [{ label: "Ok only gap label" }],
  },
});

const saved = loadActiveSession();
const strong = saved.blocks[0]._config;
const weak = saved.blocks[1]._config;
const ok = saved.blocks[2]._config;

assertEqual(
  { n_test: strong.n_test, n_socratic: strong.n_socratic, explanation_profile: strong.explanation_profile, gap_focus: strong.gap_focus },
  { n_test: 1, n_socratic: 0, explanation_profile: "brief_deep", gap_focus: [] },
  "strong → brief_deep, 1 test, 0 socratic, no gaps",
);

assert(weak.explanation_profile === "thorough", "weak → thorough");
assert(weak.gap_focus.length === 5, "weak carries five gap labels");
assert(weak.n_test + weak.n_socratic >= 5, "weak R8: question budget covers gap count");
assert(weak.n_socratic === 2, "weak bumps n_socratic +1 before R8 (2+1 capped, then R8)");

assertEqual(
  { n_test: ok.n_test, n_socratic: ok.n_socratic, explanation_profile: ok.explanation_profile },
  { n_test: 2, n_socratic: 1, explanation_profile: "thorough" },
  "ok → session defaults + thorough",
);
assertEqual(ok.gap_focus, ["Ok only gap label"], "ok gets gap_focus when gaps present");

// weak with few gaps: bump only, no R8 inflation on n_test
resetStorage();
storeActiveSession({ n_test: 2, n_socratic: 1, blocks: [{}] });
state.activeSession = loadActiveSession();
localStorage.setItem("block_index", JSON.stringify([{ id: 1, title: "B1" }]));
applyAssessmentResults({
  perBlock: { 1: { classification: "weak" } },
  gapsByBlock: { 1: [{ label: "Single weak gap" }] },
});
const weakSmall = loadActiveSession().blocks[0]._config;
assertEqual(
  { n_test: weakSmall.n_test, n_socratic: weakSmall.n_socratic },
  { n_test: 2, n_socratic: 2 },
  "weak +1 socratic only when one gap fits budget",
);

console.log(`\nT03 validation: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
