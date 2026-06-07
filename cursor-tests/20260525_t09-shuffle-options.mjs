/**
 * T09 — shuffle MC options (anti B-bias)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260525_t09-shuffle-options.mjs
 */
import {
  OPTION_LETTERS,
  computeOptionLetterMap,
  normalizeTestOptions,
  normalizeTestQuestion,
  remapFeedbackOptionLetters,
  shuffleInPlace,
  shuffleTestQuestionOptions,
  shuffleTestQuestionsInList,
  stripOptionLetterPrefix,
} from "../src/js/shuffle-options.js";

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

const sample = {
  type: "test",
  question: "What is flux?",
  options: { A: "wrong1", B: "correct", C: "wrong2", D: "wrong3" },
  answer: "B",
  feedback: "Because…",
};

const lower = normalizeTestQuestion({
  type: "test",
  question: "Lower keys?",
  options: { a: "one", b: "two", c: "three", d: "four" },
  answer: "b",
});
assert(lower.options.A === "one" && lower.answer === "B", "lowercase option keys normalized");

const fromArray = normalizeTestQuestion({
  type: "test",
  question: "Array options?",
  options: ["alpha", "beta", "gamma", "delta"],
  answer: "2",
});
assert(
  fromArray.options.C === "gamma" && fromArray.answer === "C",
  "array options and numeric answer normalized",
);

const reviewChoices = shuffleTestQuestionOptions(
  normalizeTestQuestion({
    type: "test",
    question: "Review batch uses choices?",
    choices: { a: "foo", b: "bar", c: "baz", d: "qux" },
    answer: "b",
  }),
);
assert(
  reviewChoices.options[reviewChoices.answer] === "bar" &&
    ["foo", "bar", "baz", "qux"].every((t) =>
      OPTION_LETTERS.some((l) => reviewChoices.options[l] === t),
    ),
  "choices alias normalized (post-session review path)",
);

assert(
  normalizeTestOptions(null) === null,
  "normalizeTestOptions returns null for missing",
);

assert(stripOptionLetterPrefix("C. Imperativo categórico.") === "Imperativo categórico.", "strips letter-dot prefix");
const prefixed = normalizeTestQuestion({
  type: "test",
  question: "Pick one",
  options: {
    A: "C. Imperativo categórico.",
    B: "D. Juicio reflexionante.",
    C: "B. Voluntad general.",
    D: "A. Razón autónoma.",
  },
  answer: "A",
});
assert(
  prefixed.options.A === "Imperativo categórico." &&
    prefixed.options.D === "Razón autónoma.",
  "normalize strips echoed option letters (review MC display)",
);

const shuffled = shuffleTestQuestionOptions(sample);
assert(shuffled._optionsShuffled === true, "marks shuffled");
assert(
  shuffled.options[shuffled.answer] === "correct",
  "answer letter points at same correct text",
);
const texts = OPTION_LETTERS.map((l) => shuffled.options[l]).sort().join("|");
assert(texts === "correct|wrong1|wrong2|wrong3", "same four option texts after shuffle");

const again = shuffleTestQuestionOptions(shuffled);
assert(
  again._optionsShuffled === true &&
    again.options[again.answer] === shuffled.options[shuffled.answer],
  "idempotent when already shuffled",
);

const socratic = shuffleTestQuestionOptions({ type: "socratic", question: "Why?" });
assert(socratic.type === "socratic" && !socratic._optionsShuffled, "socratic unchanged");

const list = shuffleTestQuestionsInList([sample, { type: "socratic", question: "x" }]);
assert(list[0]._optionsShuffled === true, "list shuffle applies to test only");
assert(list[1].type === "socratic", "list leaves socratic");

const counts = { A: 0, B: 0, C: 0, D: 0 };
for (let i = 0; i < 200; i += 1) {
  const q = shuffleTestQuestionOptions({ ...sample, _optionsShuffled: false });
  counts[q.answer] += 1;
}
assert(counts.B < 160, "answer letter not stuck on B after 200 shuffles");
assert(
  Object.values(counts).some((n) => n > 10),
  "at least two answer positions appear with reasonable frequency",
);

const order = [1, 2, 3, 4, 5];
shuffleInPlace(order);
assert(order.length === 5, "shuffleInPlace keeps length");

const beforeOptions = { A: "tA", B: "tB", C: "tC", D: "tD" };
const afterOptions = { A: "tC", B: "tA", C: "tD", D: "tB" };
const letterMap = computeOptionLetterMap(beforeOptions, afterOptions);
assert(letterMap.A === "B" && letterMap.B === "D" && letterMap.C === "A" && letterMap.D === "C", "letter map follows option text");

const remapped = remapFeedbackOptionLetters(
  "Option B fails because x. Option C fails because y. La opción D confunde z.",
  letterMap,
);
assert(
  remapped === "Option D fails because x. Option A fails because y. La opción C confunde z.",
  "feedback option letters remapped (EN + ES)",
);

const withFeedback = shuffleTestQuestionOptions({
  type: "test",
  question: "Pick",
  options: { A: "correct", B: "wrong1", C: "wrong2", D: "wrong3" },
  answer: "A",
  feedback: "Option B fails. Option C fails. Option D fails.",
  _optionsShuffled: false,
});
assert(withFeedback._optionsShuffled === true, "feedback question shuffled");
const bText = withFeedback.options.B;
const cText = withFeedback.options.C;
const dText = withFeedback.options.D;
const origB = "wrong1";
const origC = "wrong2";
const origD = "wrong3";
const expectedBLetter = OPTION_LETTERS.find((l) => withFeedback.options[l] === origB);
const expectedCLetter = OPTION_LETTERS.find((l) => withFeedback.options[l] === origC);
const expectedDLetter = OPTION_LETTERS.find((l) => withFeedback.options[l] === origD);
assert(
  withFeedback.feedback.includes(`Option ${expectedBLetter} fails`) &&
    withFeedback.feedback.includes(`Option ${expectedCLetter} fails`) &&
    withFeedback.feedback.includes(`Option ${expectedDLetter} fails`),
  "shuffled question remaps feedback letters to match displayed options",
);
void bText;
void cText;
void dText;

console.log(`\nT09 shuffle-options: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
