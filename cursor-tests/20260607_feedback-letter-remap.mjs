/**
 * Feedback letter remap — RSVP fast mode MC feedback stays aligned after option shuffle
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260607_feedback-letter-remap.mjs
 */
import {
  OPTION_LETTERS,
  computeOptionLetterMap,
  remapFeedbackOptionLetters,
  shuffleTestQuestionOptions,
  shuffleTestQuestionsInList,
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

function assertEq(actual, expected, msg) {
  assert(actual === expected, `${msg} — got "${actual}", expected "${expected}"`);
}

const before = { A: "correct", B: "wrong1", C: "wrong2", D: "wrong3" };

// --- Happy path ---

const letterMap = computeOptionLetterMap(before, {
  A: "wrong2",
  B: "correct",
  C: "wrong3",
  D: "wrong1",
});
assertEq(letterMap.A, "B", "happy: correct text A→B");
assertEq(letterMap.B, "D", "happy: wrong1 text B→D");
assertEq(letterMap.C, "A", "happy: wrong2 text C→A");
assertEq(letterMap.D, "C", "happy: wrong3 text D→C");

const enEs = remapFeedbackOptionLetters(
  "Option B fails because it confuses X. Option C fails too. La opción D confunde Y.",
  letterMap,
);
assert(
  enEs.includes("Option D fails") &&
    enEs.includes("Option A fails") &&
    enEs.includes("La opción C confunde"),
  "happy: EN Option + ES opción patterns remapped",
);

const shuffled = shuffleTestQuestionOptions({
  type: "test",
  question: "Q?",
  options: { ...before },
  answer: "A",
  feedback: "Option B fails. Option C fails. Option D fails.",
  _optionsShuffled: false,
});
for (const origLetter of ["B", "C", "D"]) {
  const origText = before[origLetter];
  const displayLetter = OPTION_LETTERS.find((l) => shuffled.options[l] === origText);
  assert(
    shuffled.feedback.includes(`Option ${displayLetter} fails`),
    `happy: shuffle integrates remap — orig ${origLetter} text now letter ${displayLetter}`,
  );
}
assert(
  shuffled.options[shuffled.answer] === "correct",
  "happy: shuffle still points answer at same correct text",
);

// --- Edge cases ---

assertEq(remapFeedbackOptionLetters("", letterMap), "", "edge: empty feedback unchanged");
assertEq(remapFeedbackOptionLetters(null, letterMap), null, "edge: null feedback unchanged");

const identity = { A: "A", B: "B", C: "C", D: "D" };
const raw = "Option B fails. Do not touch LaTeX \\(x_B\\) here.";
assertEq(
  remapFeedbackOptionLetters(raw, identity),
  raw,
  "edge: identity letterMap is idempotent",
);

const latexFeedback =
  "Option B is wrong. Formula \\(F = m \\cdot a\\) explains why option C fails.";
const latexRemapped = remapFeedbackOptionLetters(latexFeedback, letterMap);
assert(
  latexRemapped.includes("\\(F = m \\cdot a\\)") && !latexRemapped.includes("\\(F = m \\cdot c\\)"),
  "edge: LaTeX subscripts inside \\( \\) are not remapped",
);
assert(latexRemapped.includes("Option D is wrong"), "edge: prose letters remapped alongside LaTeX");

assertEq(
  remapFeedbackOptionLetters("B, C y D fallan.", letterMap),
  "D, A y C fallan.",
  "edge: Spanish letter lists remapped",
);

assertEq(
  remapFeedbackOptionLetters("Unlike B, the rule applies here.", letterMap),
  "Unlike D, the rule applies here.",
  "edge: Unlike + bare letter remapped",
);

assertEq(
  remapFeedbackOptionLetters("(B) and [C] are distractors.", letterMap),
  "(D) and [A] are distractors.",
  "edge: parenthetical/bracket letters remapped",
);

const lowerCase = remapFeedbackOptionLetters("option b fails", letterMap);
assert(lowerCase.includes("option d fails"), "edge: lowercase option letter preserved case mapping");

const twice = shuffleTestQuestionOptions({
  type: "test",
  question: "Q?",
  options: { ...before },
  answer: "A",
  feedback: "Option B fails. Option C fails.",
  _optionsShuffled: false,
});
const twiceAgain = shuffleTestQuestionOptions({ ...twice, _optionsShuffled: true });
assertEq(twiceAgain.feedback, twice.feedback, "edge: reshuffle skipped — feedback not double-remapped");

assert(Object.keys(computeOptionLetterMap(null, null)).length === 0, "failure: null options → empty map");

const noFeedback = shuffleTestQuestionOptions({
  type: "test",
  question: "Q",
  options: { ...before },
  answer: "A",
  _optionsShuffled: false,
});
assert(noFeedback.feedback == null || noFeedback.feedback === "", "failure: missing feedback stays absent");

const already = shuffleTestQuestionOptions({
  ...shuffled,
  _optionsShuffled: true,
});
assertEq(
  already.feedback,
  shuffled.feedback,
  "failure: second shuffle is idempotent — feedback not corrupted",
);

const socratic = shuffleTestQuestionOptions({
  type: "socratic",
  question: "Why?",
  feedback: "Option B fails.",
});
assert(
  socratic.feedback === "Option B fails." && !socratic._optionsShuffled,
  "failure: socratic questions skip shuffle and feedback remap",
);

// Conceptual text with standalone A should not remap (English article "A rule")
const article = remapFeedbackOptionLetters("A rule explains flux. Option B fails.", letterMap);
assert(
  article.startsWith("A rule") && article.includes("Option D fails"),
  "failure: English indefinite article A not treated as option letter",
);

// Batch path
const list = shuffleTestQuestionsInList([
  {
    type: "test",
    question: "Batch",
    options: { ...before },
    answer: "A",
    feedback: "Option B fails.",
    _optionsShuffled: false,
  },
]);
const batchBLetter = OPTION_LETTERS.find((l) => list[0].options[l] === "wrong1");
assert(
  list[0].feedback.includes(`Option ${batchBLetter} fails`),
  "happy: shuffleTestQuestionsInList remaps feedback in batch",
);

console.log(`\n20260607 feedback-letter-remap: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
