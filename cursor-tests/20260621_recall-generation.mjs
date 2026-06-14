/**
 * Recall Mode T03 — generateRecallQuestions parser + config (no live LLM)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260621_recall-generation.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import { LS_KEY } from "../src/js/config.js";
import {
  buildRecallQuestionsSystemPrompt,
  deriveRecallConfig,
  generateRecallQuestions,
  normalizeRecallQuestions,
} from "../src/js/api.js";

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

function assertThrows(fn, msg) {
  try {
    fn();
    failed += 1;
    console.error(`FAIL: ${msg} (did not throw)`);
  } catch (err) {
    passed += 1;
    if (msg.includes("message") && err?.message) {
      // optional: verify message substring in caller
    }
  }
}

const inventory = [
  { id: "c1", label: "Thesis", type: "THESIS" },
  { id: "c2", label: "Mechanism", type: "ARGUMENT" },
  { canonicalId: "c3", label: "Term", type: "TERM" },
];

function validQuestion(overrides = {}) {
  return {
    id: "rq1",
    recall_type: "synthesis",
    question: "How do the thesis and mechanism relate?",
    concept_ids: ["c1", "c2"],
    source_chunks: ["The thesis drives the mechanism."],
    ...overrides,
  };
}

// --- deriveRecallConfig ---
const tinyCfg = deriveRecallConfig("x".repeat(1000), { primaryLearningGoal: "understand_argument" });
assert(tinyCfg.questionCount === 4, "deriveRecallConfig: tiny doc → 4 questions");
assert(tinyCfg.types.includes("synthesis"), "deriveRecallConfig: synthesis always included");
assert(tinyCfg.types.includes("argumentative"), "deriveRecallConfig: understand_argument mix");

const longCfg = deriveRecallConfig("x".repeat(90000), { primaryLearningGoal: "memorize_facts" });
assert(longCfg.questionCount === 10, "deriveRecallConfig: very_long doc → 10 questions (cap)");
assert(longCfg.types.includes("relational"), "deriveRecallConfig: memorize_facts → relational");
assert(longCfg.types.includes("applicative"), "deriveRecallConfig: memorize_facts → applicative");

const procCfg = deriveRecallConfig("x".repeat(5000), { primaryLearningGoal: "learn_procedure" });
assert(procCfg.types.includes("applicative"), "deriveRecallConfig: learn_procedure → applicative");

// --- normalizeRecallQuestions happy path ---
const normalized = normalizeRecallQuestions(
  { questions: [validQuestion(), validQuestion({ id: "rq2", recall_type: "relational" })] },
  { inventory, config: { questionCount: 6 } },
);
assert(normalized.length === 2, "normalizer: returns 2 questions");
assert(normalized[0].recall_type === "synthesis", "normalizer: synthesis preserved");
assert(normalized[0].source_chunks.length === 1, "normalizer: source_chunks array");

const fromArray = normalizeRecallQuestions([validQuestion()], { inventory });
assert(fromArray[0].id === "rq1", "normalizer: accepts bare array");

const singularChunk = normalizeRecallQuestions(
  [
    validQuestion({
      source_chunks: undefined,
      source_chunk: "Single excerpt.",
    }),
  ],
  { inventory },
);
assert(singularChunk[0].source_chunks[0] === "Single excerpt.", "normalizer: source_chunk → source_chunks");

const canonicalRef = normalizeRecallQuestions(
  [validQuestion({ concept_ids: ["c3"] })],
  { inventory },
);
assert(canonicalRef[0].concept_ids[0] === "c3", "normalizer: accepts canonicalId inventory refs");

// --- failure cases ---
assertThrows(
  () => normalizeRecallQuestions([], { inventory }),
  "empty array throws",
);

assertThrows(
  () => normalizeRecallQuestions({ questions: [validQuestion({ recall_type: "relational" })] }, { inventory }),
  "missing synthesis throws",
);

assertThrows(
  () => normalizeRecallQuestions({ questions: [validQuestion({ concept_ids: ["unknown"] })] }, { inventory }),
  "unknown concept_id throws",
);

assertThrows(
  () => normalizeRecallQuestions({ questions: [validQuestion({ source_chunks: [] })] }, { inventory }),
  "empty source_chunks throws",
);

assertThrows(
  () => normalizeRecallQuestions({ questions: [validQuestion({ recall_type: "mcq" })] }, { inventory }),
  "invalid recall_type throws",
);

assertThrows(
  () => normalizeRecallQuestions({ questions: [validQuestion({ question: "" })] }, { inventory }),
  "empty question throws",
);

// --- buildRecallQuestionsSystemPrompt ---
const prompt = buildRecallQuestionsSystemPrompt({
  language: "English",
  questionCount: 6,
  types: ["synthesis", "relational"],
  conceptInventory: inventory,
  materialExcerpt: "Sample material.",
  weakConceptIds: ["c1"],
  primaryLearningGoal: "understand_argument",
});
assert(prompt.includes("exactly 6"), "prompt: includes question count");
assert(prompt.includes("Weak concepts"), "prompt: includes weak concept weighting");
assert(prompt.includes("c1"), "prompt: lists weak ids");
assert(prompt.includes("NO multiple choice"), "prompt: open-ended only");

const promptNoWeak = buildRecallQuestionsSystemPrompt({
  language: "English",
  questionCount: 4,
  types: ["synthesis"],
  conceptInventory: inventory,
  materialExcerpt: "Short.",
  weakConceptIds: [],
  primaryLearningGoal: "survey_field",
});
assert(!promptNoWeak.includes("Weak concepts (prioritize"), "prompt: omits weak block when no signals");

// --- generateRecallQuestions (mock fetch, no live LLM) ---
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
  try {
    const body = opts?.body ? JSON.parse(opts.body) : null;
    assert(body?.temperature === 0.4, "generateRecallQuestions: temperature 0.4");
  } catch {
    // body shape may vary by provider wrapper
  }
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              questions: [
                validQuestion(),
                validQuestion({
                  id: "rq2",
                  recall_type: "argumentative",
                  concept_ids: ["c2"],
                }),
              ],
            }),
          },
        },
      ],
    }),
  };
};

const generated = await generateRecallQuestions({
  rawMarkdown: "# Doc\n\nThe thesis drives the mechanism.",
  conceptInventory: inventory,
  pedagogicalMeta: { primaryLearningGoal: "understand_argument" },
  assessmentSignals: [
    { canonicalId: "c1", weight: 2, lastResult: "wrong", wrongCount: 2, correctCount: 0 },
  ],
  config: { questionCount: 6, types: ["synthesis", "argumentative", "relational"], scope: "full" },
  lang: "English",
});
assert(fetchCalls === 1, "generateRecallQuestions: single LLM call");
assert(generated.length === 2, "generateRecallQuestions: returns parsed questions");
assert(generated.some((q) => q.recall_type === "synthesis"), "generateRecallQuestions: includes synthesis");

let missingMaterialErr = null;
try {
  await generateRecallQuestions({
    rawMarkdown: "",
    conceptInventory: inventory,
    config: { questionCount: 4, types: ["synthesis"], scope: "full" },
  });
} catch (err) {
  missingMaterialErr = err;
}
assert(missingMaterialErr instanceof Error, "missing material throws");
assert(
  /source material/i.test(String(missingMaterialErr?.message || "")),
  "missing material error message",
);

globalThis.fetch = originalFetch;

console.log(`\n20260621_recall-generation: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
