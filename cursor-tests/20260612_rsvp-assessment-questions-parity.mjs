/**
 * RSVP Assessment Questions Parity — unit tests (no live LLM)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260612_rsvp-assessment-questions-parity.mjs
 */
import {
  buildPrePackingAssessmentSystemPrompt,
  normalizeAssessmentItems,
  normalizeKnowledgeProfile,
  normalizePrePackingAssessmentQuestions,
  scorePrePackingTestResponses,
} from "../src/js/api.js";
import { shuffleTestQuestionsInList } from "../src/js/shuffle-options.js";
import {
  ASSESSMENT_FLAGS,
  isAssessmentQuestionsUiEnabled,
} from "../src/js/config/flags.js";

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

function assertThrows(fn, msg) {
  try {
    fn();
    failed += 1;
    console.error(`FAIL: ${msg} (did not throw)`);
  } catch {
    passed += 1;
  }
}

const inventory = [
  { id: "c1", label: "Thesis A", type: "THESIS" },
  { id: "c2", label: "Argument B", type: "ARGUMENT" },
  { id: "c3", label: "Term C", type: "TERM" },
];

function validTest(overrides = {}) {
  return {
    type: "test",
    concept_id: "c1",
    question: "Why does A imply B?",
    options: { A: "One", B: "Two", C: "Three", D: "Four" },
    answer: "B",
    feedback: "Option B captures the causal chain because the premise links A to B.",
    ...overrides,
  };
}

function validSocratic(overrides = {}) {
  return {
    type: "socratic",
    concept_id: "c2",
    question: "Explain how B supports the thesis.",
    ...overrides,
  };
}

// --- normalizer (8+) ---
const normalized = normalizePrePackingAssessmentQuestions(
  { questions: [validTest(), validSocratic()] },
  { n_test: 1, n_socratic: 1, inventory },
);
assert(normalized.length === 2, "normalizer: returns 2 questions");
assert(normalized[0].type === "test" && normalized[0].item_id, "normalizer: test has item_id");
assert(normalized[1].type === "socratic", "normalizer: socratic preserved");
assert(
  normalized[0].options.A && normalized[0].answer === "B",
  "normalizer: test options + answer",
);

assertThrows(
  () =>
    normalizePrePackingAssessmentQuestions(
      { questions: [validTest()] },
      { n_test: 2, n_socratic: 0, inventory },
    ),
  "normalizer: wrong test count throws",
);

assertThrows(
  () =>
    normalizePrePackingAssessmentQuestions(
      { questions: [validTest(), validSocratic()] },
      { n_test: 1, n_socratic: 0, inventory },
    ),
  "normalizer: wrong socratic count throws",
);

assertThrows(
  () =>
    normalizePrePackingAssessmentQuestions(
      { questions: [validTest({ concept_id: "missing" })] },
      { n_test: 1, n_socratic: 0, inventory },
    ),
  "normalizer: invalid concept_id throws",
);

assertThrows(
  () =>
    normalizePrePackingAssessmentQuestions(
      { questions: [validTest({ options: { A: "a", B: "b" } })] },
      { n_test: 1, n_socratic: 0, inventory },
    ),
  "normalizer: incomplete options throws",
);

assertThrows(
  () =>
    normalizePrePackingAssessmentQuestions(
      { questions: [validTest({ feedback: "" })] },
      { n_test: 1, n_socratic: 0, inventory },
    ),
  "normalizer: missing feedback throws",
);

const withIds = normalizePrePackingAssessmentQuestions(
  {
    questions: [
      validTest({ item_id: "custom_t1" }),
      validSocratic({ item_id: "custom_s1" }),
    ],
  },
  { n_test: 1, n_socratic: 1, inventory },
);
assert(withIds[0].item_id === "custom_t1", "normalizer: keeps item_id");
assert(!withIds[1].options, "normalizer: strips socratic options");

const assigned = normalizePrePackingAssessmentQuestions(
  { questions: [validTest(), validSocratic()] },
  { n_test: 1, n_socratic: 1, inventory },
);
assert(/^aq_/.test(assigned[0].item_id), "normalizer: assigns item_id when missing");

assertThrows(
  () => normalizePrePackingAssessmentQuestions([], { n_test: 1, n_socratic: 0, inventory }),
  "normalizer: empty array throws",
);

const fromArray = normalizePrePackingAssessmentQuestions(
  [validTest(), validSocratic()],
  { n_test: 1, n_socratic: 1, inventory },
);
assert(fromArray.length === 2, "normalizer: accepts top-level questions array");

const shuffled = shuffleTestQuestionsInList(fromArray);
assert(shuffled[0].type === "test" && shuffled[0]._optionsShuffled, "contract: shuffle marks test items");

// --- legacy rollback contract ---
const legacyItems = normalizeAssessmentItems([
  {
    item_id: "legacy1",
    concept_id: "c1",
    question: "Legacy MCQ?",
    type: "mcq",
    options: ["Alpha", "Beta", "Gamma"],
    correct: "Beta",
  },
]);
assert(legacyItems[0].type === "mcq" && legacyItems[0].correct === "Beta", "legacy: normalizeAssessmentItems unchanged");

assertThrows(
  () => normalizeAssessmentItems([]),
  "legacy: empty mcq array throws",
);

// --- profile integration (consumer contract) ---
const questions = normalizePrePackingAssessmentQuestions(
  { questions: [validTest({ item_id: "t1" }), validSocratic({ item_id: "s1" })] },
  { n_test: 1, n_socratic: 1, inventory },
);
const testRows = scorePrePackingTestResponses(questions, [
  { item_id: "t1", questionType: "test", userAnswer: "B. Two" },
]);
const profile = normalizeKnowledgeProfile(
  { items: testRows },
  { inventory, items: questions, responses: [] },
);
assert(profile && profile.assessed_at, "profile: builds from scored test rows");
assert(profile.coverage > 0, "profile: coverage computed from concept_id");
assert(profile.items[0].mastery === "partial", "profile: preserves test mastery");

// --- prompt builder ---
const prompt = buildPrePackingAssessmentSystemPrompt({
  language: "English",
  n_test: 2,
  n_socratic: 1,
  conceptInventory: inventory,
  edges: [{ from: "c1", to: "c2" }],
  materialExcerpt: "Sample material about A and B.",
});
assert(prompt.includes("MC_OPTION_PARITY_RULES") === false, "prompt: exports rules inline");
assert(prompt.includes("Option parity"), "prompt: includes MC parity rules text");
assert(prompt.includes("concept_id"), "prompt: requires concept_id");
assert(prompt.includes("THESIS"), "prompt: prioritizes thesis/argument");

const longExcerpt = "x".repeat(20000);
const truncatedPrompt = buildPrePackingAssessmentSystemPrompt({
  language: "English",
  n_test: 1,
  n_socratic: 0,
  conceptInventory: inventory,
  edges: [],
  materialExcerpt: longExcerpt,
});
assert(truncatedPrompt.includes("[truncated]"), "prompt: truncates long material excerpt");

// --- scoring (6+) ---
const items = [
  { item_id: "t1", type: "test", concept_id: "c1", answer: "A" },
  { item_id: "t2", type: "test", concept_id: "c2", answer: "C" },
];

const correct = scorePrePackingTestResponses(items, [
  { item_id: "t1", questionType: "test", userAnswer: "A. Correct option" },
]);
assert(correct.length === 1 && correct[0].mastery === "partial", "score: correct → partial");
assert(correct[0].confidence === 0.65, "score: correct confidence 0.65");

const wrong = scorePrePackingTestResponses(items, [
  { item_id: "t1", questionType: "test", userAnswer: "B. Wrong" },
]);
assert(wrong[0].mastery === "none" && wrong[0].confidence === 0.2, "score: wrong → none 0.2");

const dontKnow = scorePrePackingTestResponses(items, [
  { item_id: "t1", questionType: "test", userAnswer: "I don't know" },
]);
assert(dontKnow[0].mastery === "none" && dontKnow[0].confidence === 0.1, "score: dont-know → none 0.1");

const empty = scorePrePackingTestResponses(items, [
  { item_id: "t1", questionType: "test", userAnswer: "" },
]);
assert(empty[0].confidence === 0.1, "score: empty → none 0.1");

const merged = scorePrePackingTestResponses(
  [{ item_id: "t1", type: "test", concept_id: "c1", answer: "A" }],
  [
    { item_id: "t1", questionType: "test", userAnswer: "A" },
    { item_id: "t1", questionType: "test", userAnswer: "B" },
  ],
);
assert(merged[0].mastery === "partial", "score: merge same concept keeps max mastery");

const caseInsensitive = scorePrePackingTestResponses(items, [
  { item_id: "t2", questionType: "test", userAnswer: "c. lower" },
]);
assert(caseInsensitive[0].mastery === "partial", "score: case-insensitive letter");

const ignoresSocratic = scorePrePackingTestResponses(items, [
  { item_id: "t1", questionType: "socratic", userAnswer: "long answer" },
]);
assert(ignoresSocratic.length === 0, "score: ignores socratic responses");

const unknownItem = scorePrePackingTestResponses(items, [
  { item_id: "missing", questionType: "test", userAnswer: "A" },
]);
assert(unknownItem.length === 0, "score: ignores unknown item_id");

const dontKnowEnglish = scorePrePackingTestResponses(items, [
  { item_id: "t1", questionType: "test", userAnswer: "I don't know" },
]);
assert(dontKnowEnglish[0].confidence === 0.1, "score: English dont-know alias");

// --- flags ---
assert(isAssessmentQuestionsUiEnabled() === true, "flags: questions UI on by default");
assert(ASSESSMENT_FLAGS.ASSESSMENT_USE_QUESTIONS_UI === true, "flags: USE_QUESTIONS_UI default");
assert(ASSESSMENT_FLAGS.ASSESSMENT_LEGACY_MCQ_UI === false, "flags: LEGACY_MCQ_UI default off");

console.log(`\n20260612_rsvp-assessment-questions-parity: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
