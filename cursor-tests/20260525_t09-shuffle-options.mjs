/**
 * T09 — shuffle MC options (anti B-bias)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260525_t09-shuffle-options.mjs
 */
import {
  OPTION_LETTERS,
  shuffleInPlace,
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

const sample = {
  type: "test",
  question: "What is flux?",
  options: { A: "wrong1", B: "correct", C: "wrong2", D: "wrong3" },
  answer: "B",
  feedback: "Because…",
};

const shuffled = shuffleTestQuestionOptions(sample);
assert(shuffled._optionsShuffled === true, "marks shuffled");
assert(
  shuffled.options[shuffled.answer] === "correct",
  "answer letter points at same correct text",
);
const texts = OPTION_LETTERS.map((l) => shuffled.options[l]).sort().join("|");
assert(texts === "correct|wrong1|wrong2|wrong3", "same four option texts after shuffle");

const again = shuffleTestQuestionOptions(shuffled);
assert(again === shuffled, "idempotent when already shuffled");

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

console.log(`\nT09 shuffle-options: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
