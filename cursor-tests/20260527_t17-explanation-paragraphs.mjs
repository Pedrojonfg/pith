import assert from "node:assert/strict";
import {
  countExplanationParagraphs,
  enforceExplanationParagraphs,
  getMinExplanationParagraphs,
  hasValidExplanationParagraphs,
  splitExplanationParagraphs,
} from "../src/js/explanationParagraphs.js";

function testSplitPreservesParagraphs() {
  const text = "First para end.\n\nSecond para start.";
  assert.deepEqual(splitExplanationParagraphs(text), [
    "First para end.",
    "Second para start.",
  ]);
}

function testEnforceSplitsWallOfText() {
  const wall =
    "Hook sentence here. Core definition follows next. Technical layer adds terms. Example shows a case. Contrast clarifies limits. Connection links forward.";
  const out = enforceExplanationParagraphs(wall, { explanation_profile: "thorough" });
  assert.ok(
    countExplanationParagraphs(out) >= 6,
    `thorough block should reach 6 paragraphs, got ${countExplanationParagraphs(out)}`,
  );
}

function testVocabularySplitOnTerms() {
  const vocab =
    "**Alpha** — First term.\n\n**Beta** — Second term.\n\n**Gamma** — Third.\n\n**Delta** — Fourth.\n\n**Epsilon** — Fifth.\n\n**Zeta** — Sixth.";
  const out = enforceExplanationParagraphs(vocab, {
    blockTitle: "Key terms: Module 1",
    isVocabularyBlock: true,
  });
  assert.ok(countExplanationParagraphs(out) >= 6);
}

function testBriefDeepMinimum() {
  const wall = "One. Two. Three. Four. Five.";
  const out = enforceExplanationParagraphs(wall, { explanation_profile: "brief_deep" });
  assert.ok(countExplanationParagraphs(out) >= 4);
}

function testHasValidRejectsSingleParagraph() {
  const single = "Only one paragraph with many sentences. Still one block. No breaks.";
  assert.equal(
    hasValidExplanationParagraphs(single, { explanation_profile: "thorough" }),
    false,
  );
  const fixed = enforceExplanationParagraphs(single, { explanation_profile: "thorough" });
  assert.equal(
    hasValidExplanationParagraphs(fixed, { explanation_profile: "thorough" }),
    true,
  );
}

function testMinCountsByProfile() {
  assert.equal(getMinExplanationParagraphs({ blockTitle: "Key terms: X" }), 6);
  assert.equal(getMinExplanationParagraphs({ explanation_profile: "brief_deep" }), 4);
  assert.equal(getMinExplanationParagraphs({ explanation_profile: "thorough" }), 6);
}

testSplitPreservesParagraphs();
testEnforceSplitsWallOfText();
testVocabularySplitOnTerms();
testBriefDeepMinimum();
testHasValidRejectsSingleParagraph();
testMinCountsByProfile();

console.log("20260527_t17-explanation-paragraphs.mjs: all tests passed");
