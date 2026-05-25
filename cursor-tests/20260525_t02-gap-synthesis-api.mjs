/**
 * T02 — synthesizeAssessmentGaps + mergeGapLists
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260525_t02-gap-synthesis-api.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import { LS_KEY } from "../src/js/config.js";
import { GapSynthesisError, synthesizeAssessmentGaps } from "../src/js/api.js";
import { mergeGapLists, normalizeGapsByBlock } from "../src/js/session.js";

let passed = 0;
let failed = 0;
const originalFetch = globalThis.fetch;

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

const mockAssessment = {
  perBlock: {
    "1": { classification: "weak", score: 0.2 },
    "2": { classification: "strong", score: 0.9 },
  },
};
const mockBlockIndex = [
  { id: 1, title: "Flux" },
  { id: 2, title: "Circulation" },
];
const mockQuestions = [
  { block_id: 1, question: "What does flux measure?", answer: "B", options: { A: "a", B: "b", C: "c", D: "d" } },
  { block_id: 2, question: "Green's theorem links?", answer: "A", options: { A: "a", B: "b", C: "c", D: "d" } },
];
const mockResponses = [
  { block_id: 1, correct: false, skipped: false, chosen: "A" },
  { block_id: 2, correct: true, skipped: false },
];

// --- mergeGapLists ---
assertEqual(
  mergeGapLists(
    { gaps_by_block: { 1: [{ label: "Gap from synthesis" }] } },
    { 2: [{ label: "User gap label" }] },
  ),
  {
    1: [{ label: "Gap from synthesis" }],
    2: [{ label: "User gap label" }],
  },
  "merge: synthesis base + user block override",
);

assertEqual(
  mergeGapLists({ "1": [{ label: "Only synthesis gap here" }] }, {}),
  { 1: [{ label: "Only synthesis gap here" }] },
  "merge: empty user edits keeps synthesis",
);

assertEqual(mergeGapLists({ 1: [{ label: "Synth gap label" }] }, { 1: [] }), {}, "merge: user clears block removes gaps");

// --- missing API key ---
resetStorage();
let missingKeyErr = null;
try {
  await synthesizeAssessmentGaps({
    assessmentResults: mockAssessment,
    questions: mockQuestions,
    responses: mockResponses,
    blockIndex: mockBlockIndex,
  });
} catch (err) {
  missingKeyErr = err;
}
assert(missingKeyErr instanceof GapSynthesisError, "throws GapSynthesisError without API key");
assert(missingKeyErr?.code === "missing_api_key", "missing_api_key code");

// --- happy path (mock fetch) ---
resetStorage();
localStorage.setItem(LS_KEY, "test-key");
let fetchCalls = 0;
globalThis.fetch = async (_url, opts) => {
  if (opts?.signal?.aborted) {
    const err = new Error("aborted");
    err.name = "AbortError";
    throw err;
  }
  fetchCalls += 1;
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              gaps_by_block: {
                1: [{ label: "Flux through closed surface", evidence: "Confused divergence" }],
              },
            }),
          },
        },
      ],
    }),
  };
};

const result = await synthesizeAssessmentGaps({
  assessmentResults: mockAssessment,
  questions: mockQuestions,
  responses: mockResponses,
  blockIndex: mockBlockIndex,
  language: "English",
});
assert(fetchCalls === 1, "single fetch on valid JSON");
assert(
  result?.gaps_by_block?.["1"]?.[0]?.label === "Flux through closed surface",
  "returns parseable gaps_by_block",
);
assert(
  normalizeGapsByBlock(result.gaps_by_block)["1"]?.length === 1,
  "normalized gaps pass session rules",
);

// --- invalid JSON retries then error ---
fetchCalls = 0;
globalThis.fetch = async () => {
  fetchCalls += 1;
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: "not json at all" } }],
    }),
  };
};
let invalidErr = null;
try {
  await synthesizeAssessmentGaps({
    assessmentResults: mockAssessment,
    questions: mockQuestions,
    responses: mockResponses,
    blockIndex: mockBlockIndex,
  });
} catch (err) {
  invalidErr = err;
}
assert(fetchCalls === 2, "retries once on invalid JSON");
assert(invalidErr?.code === "invalid_json", "invalid_json after retry");

// --- abort / timeout ---
const ac = new AbortController();
ac.abort();
let timeoutErr = null;
try {
  await synthesizeAssessmentGaps({
    assessmentResults: mockAssessment,
    questions: mockQuestions,
    responses: mockResponses,
    blockIndex: mockBlockIndex,
    signal: ac.signal,
  });
} catch (err) {
  timeoutErr = err;
}
assert(timeoutErr?.code === "timeout", "pre-aborted signal → timeout error");

globalThis.fetch = originalFetch;

console.log(`\nT02 gap synthesis: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
