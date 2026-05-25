/**
 * T08 — quickstart regression (SC-001 timeout budget, SC-004 skip path)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260525_t08-quickstart-regression.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import { GAP_SYNTHESIS_TIMEOUT_MS, buildBlockGenerationSystemPrompt } from "../src/js/api.js";
import {
  applyAssessmentResults,
  buildBlockConfigKey,
  loadActiveSession,
  resolveBlockQuestionConfig,
  state,
  storeActiveSession,
} from "../src/js/session.js";
import { buildMarkdown } from "../src/js/export.js";

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

// --- SC-001: 30s synthesis budget (contract) ---
assert(GAP_SYNTHESIS_TIMEOUT_MS === 30_000, "SC-001: gap synthesis timeout is 30s");

// --- SC-004: skip assessment — no profiles, thorough prompts, session defaults ---
resetStorage();
const preSkipSession = {
  n_test: 2,
  n_socratic: 1,
  n_blocks: 2,
  blocks: [{}, {}],
};
storeActiveSession(preSkipSession);
state.activeSession = preSkipSession;
state.nTest = 2;
state.nSocratic = 1;

const skipResult = applyAssessmentResults({ skipped: true });
assert(skipResult.skipped === true, "SC-004: applyAssessmentResults returns skipped");
assert(skipResult.adjusted === false, "SC-004: skip does not adjust blocks");

const afterSkip = loadActiveSession();
assert(!afterSkip._meta?.assessment, "SC-004: skip does not write _meta.assessment");

const cfg0 = resolveBlockQuestionConfig(0);
const cfg1 = resolveBlockQuestionConfig(1);
assertEqual(
  { n_test: cfg0.n_test, n_socratic: cfg0.n_socratic, explanation_profile: cfg0.explanation_profile, gap_focus: cfg0.gap_focus },
  { n_test: 2, n_socratic: 1, explanation_profile: "thorough", gap_focus: [] },
  "SC-004: block 0 uses session defaults + thorough",
);
assertEqual(cfg1, cfg0, "SC-004: block 1 same defaults");

const skipPrompt = buildBlockGenerationSystemPrompt({
  language: "English",
  n_test: cfg0.n_test,
  n_socratic: cfg0.n_socratic,
  explanation_profile: cfg0.explanation_profile,
  gap_focus: cfg0.gap_focus,
});
assert(skipPrompt.includes("HOOK"), "SC-004: skip path prompt is RSVP thorough");
assert(skipPrompt.includes("200-300 words"), "SC-004: skip path 200-300w cap");
assert(!skipPrompt.includes("Max 120 words"), "SC-004: skip path has no brief_deep band");

// window.assessmentConfig.skipped (UI path) — same early return
globalThis.window = globalThis.window || {};
window.assessmentConfig = { skipped: true };
const skipViaWindow = applyAssessmentResults({
  perBlock: { 1: { classification: "strong" } },
  gapsByBlock: { 1: [{ label: "Should not apply" }] },
});
assert(skipViaWindow.skipped === true, "SC-004: assessmentConfig.skipped blocks apply");
delete window.assessmentConfig;

// --- Happy path after accept: _meta + _config + export (quickstart DevTools / export check) ---
resetStorage();
const happySession = {
  n_test: 2,
  n_socratic: 1,
  blocks: [{}, {}, {}],
};
storeActiveSession(happySession);
state.activeSession = happySession;
localStorage.setItem(
  "block_index",
  JSON.stringify([
    { id: 1, title: "Strong block" },
    { id: 2, title: "Weak block" },
    { id: 3, title: "Ok block" },
  ]),
);

applyAssessmentResults({
  perBlock: { 1: { classification: "strong" }, 2: { classification: "weak" }, 3: { classification: "ok" } },
  gapsByBlock: {
    2: [{ label: "Stokes gap topic" }, { label: "Divergence confusion" }],
  },
  gapsSource: "synthesis",
  synthesisStatus: "ok",
  maxQuestions: 20,
  penalisedTotal: 10,
  rawTotal: 12,
});

const happy = loadActiveSession();
const assessMeta = happy._meta.assessment;
assert(assessMeta.synthesis_status === "ok", "happy path: synthesis_status ok");
assert(assessMeta.gaps_by_block["2"]?.length === 2, "happy path: gaps_by_block persisted");
assert(happy.blocks[0]._config.explanation_profile === "brief_deep", "happy path: strong → brief_deep");
assert(happy.blocks[1]._config.explanation_profile === "thorough", "happy path: weak → thorough");
assert(
  happy.blocks[1]._config.gap_focus.includes("Stokes gap topic"),
  "happy path: weak gap_focus from synthesis",
);

const strongPrompt = buildBlockGenerationSystemPrompt({
  language: "English",
  n_test: 1,
  n_socratic: 0,
  explanation_profile: "brief_deep",
  gap_focus: [],
});
assert(strongPrompt.includes("Max 120 words"), "happy path: strong brief_deep band in prompt");
assert(!strongPrompt.includes("200-300 words"), "happy path: strong omits thorough band");

const weakPrompt = buildBlockGenerationSystemPrompt({
  language: "English",
  n_test: happy.blocks[1]._config.n_test,
  n_socratic: happy.blocks[1]._config.n_socratic,
  explanation_profile: "thorough",
  gap_focus: happy.blocks[1]._config.gap_focus,
});
assert(weakPrompt.includes("HOOK"), "happy path: weak RSVP thorough");
assert(weakPrompt.includes("Gap-focused questions"), "happy path: weak with gaps gets gap section");

const strongKey = buildBlockConfigKey(happy.blocks[0]._config);
const weakKey = buildBlockConfigKey(happy.blocks[1]._config);
assert(strongKey !== weakKey, "happy path: prefetch keys differ by profile/gaps");

state.activeSession = happy;
const md = buildMarkdown(happy);
assert(md.includes("## Initial Assessment"), "export check: Initial Assessment section");
assert(md.includes("Stokes gap topic"), "export check: gap summary in .md");

// --- Failure injection: timeout accept still starts session with profiles ---
resetStorage();
storeActiveSession({ n_test: 2, n_socratic: 1, blocks: [{}, {}] });
state.activeSession = loadActiveSession();
localStorage.setItem("block_index", JSON.stringify([{ id: 1, title: "A" }, { id: 2, title: "B" }]));

applyAssessmentResults({
  perBlock: { 1: { classification: "weak" }, 2: { classification: "strong" } },
  gapsByBlock: {},
  synthesisStatus: "timeout",
  gapsSource: "none",
});

const timeoutSession = loadActiveSession();
assert(timeoutSession._meta.assessment.synthesis_status === "timeout", "timeout: synthesis_status timeout");
assert(timeoutSession.blocks[1]._config.explanation_profile === "brief_deep", "timeout: strong profile still applied");
assert(timeoutSession.blocks[0]._config.explanation_profile === "thorough", "timeout: weak thorough without gaps");

console.log(`\nT08 quickstart regression: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
