import assert from "node:assert/strict";
import { extractSneakPeek } from "../src/js/sneakPeek.js";

function testEmptyOrInvalidInput() {
  assert.equal(extractSneakPeek(""), "", "empty string should yield empty sneak peek");
  assert.equal(extractSneakPeek("   \n\t "), "", "whitespace-only string should yield empty sneak peek");
  assert.equal(extractSneakPeek(null), "", "null should yield empty sneak peek");
  assert.equal(extractSneakPeek(undefined), "", "undefined should yield empty sneak peek");
  assert.equal(extractSneakPeek(42), "", "non-string should yield empty sneak peek");
}

function testSingleSentence() {
  const explanation = "This is a single sentence only.";
  const result = extractSneakPeek(explanation);
  assert.equal(result, "This is a single sentence only.");
}

function testThreeSentencesDifferentPunctuation() {
  const explanation =
    "First statement is here. Second one asks a question? Third one is excited!";

  const expected =
    "First statement is here. Second one asks a question? Third one is excited!";

  const result = extractSneakPeek(explanation, 4);
  assert.equal(result, expected, "should return all three sentences when maxSentences >= 3");
}

function testExactlyFourSentences() {
  const explanation =
    "Alpha starts the explanation. Beta continues with more detail. Gamma adds another idea. Delta closes the thought.";

  const expected =
    "Alpha starts the explanation. Beta continues with more detail. Gamma adds another idea. Delta closes the thought.";

  const result = extractSneakPeek(explanation, 4);
  assert.equal(result, expected, "should return exactly the first four sentences");
}

function testMoreThanFourSentences() {
  const explanation =
    "Sentence one explains the hook. Sentence two extends the idea further. Sentence three brings in a contrast. Sentence four gives a concrete example. Sentence five starts a new thread.";

  const expectedFirstFour =
    "Sentence one explains the hook. Sentence two extends the idea further. Sentence three brings in a contrast. Sentence four gives a concrete example.";

  const resultDefault = extractSneakPeek(explanation);
  assert.equal(
    resultDefault,
    expectedFirstFour,
    "default maxSentences should limit to the first four sentences",
  );

  const resultExplicit = extractSneakPeek(explanation, 4);
  assert.equal(
    resultExplicit,
    expectedFirstFour,
    "explicit maxSentences=4 should limit to the first four sentences",
  );
}

function testWhitespaceNormalization() {
  const explanation =
    "First sentence with   extra spaces.\n\nSecond sentence after a blank line.\tThird\t sentence after a tab.";

  const result = extractSneakPeek(explanation, 3);

  // After normalization, all internal whitespace should collapse to single spaces.
  const expected =
    "First sentence with extra spaces. Second sentence after a blank line. Third sentence after a tab.";

  assert.equal(result, expected, "whitespace should be normalized and sentences preserved");
}

function testInlineLatexDoesNotBreakSentences() {
  const explanation = String.raw`The loss is given by \( L = (y - \hat{y})^2. \) This sentence explains its intuition. Another sentence adds context.`;

  const result = extractSneakPeek(explanation, 2);

  const expectedFirstTwo = String.raw`The loss is given by \( L = (y - \hat{y})^2. \) This sentence explains its intuition.`;

  assert.equal(
    result,
    expectedFirstTwo,
    "inline LaTeX punctuation should not introduce extra sentence splits",
  );
}

function testMaxSentencesNeverExceeded() {
  const explanation =
    "One. Two. Three. Four. Five. Six.";

  for (let n = 1; n <= 6; n += 1) {
    const result = extractSneakPeek(explanation, n);
    const sentenceCount = result ? result.split(/(?<=[.!?])\s+/).length : 0;
    assert.ok(
      sentenceCount <= n,
      `sneak peek should never exceed maxSentences (requested ${n}, got ${sentenceCount})`,
    );
  }
}

testEmptyOrInvalidInput();
testSingleSentence();
testThreeSentencesDifferentPunctuation();
testExactlyFourSentences();
testMoreThanFourSentences();
testWhitespaceNormalization();
testInlineLatexDoesNotBreakSentences();
testMaxSentencesNeverExceeded();

console.log("20260527_t14-sneak-peek-extract.mjs: all tests passed");

