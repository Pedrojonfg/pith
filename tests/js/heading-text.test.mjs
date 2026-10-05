import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeHeadingLabel,
  isValidPdfTopLevelLabel,
  parseSectionNumber,
  compareHeadingLabels,
} from "../../src/js/normalization/heading-text.js";

test("normalizeHeadingLabel normalizes quotes, nbsp, dashes and whitespace", () => {
  assert.equal(normalizeHeadingLabel("\u201cHello\u201d\u00a0 world"), '"Hello" world');
  assert.equal(normalizeHeadingLabel("a \u2013  b"), "a - b");
  assert.equal(normalizeHeadingLabel(null), "");
});

test("isValidPdfTopLevelLabel accepts short numbered titles only", () => {
  assert.equal(isValidPdfTopLevelLabel("4. Experiments"), true);
  assert.equal(isValidPdfTopLevelLabel("4.1 Setup"), false);
  assert.equal(isValidPdfTopLevelLabel("4. a lowercase title"), false);
  assert.equal(isValidPdfTopLevelLabel("4. One, two, three"), false);
  assert.equal(isValidPdfTopLevelLabel("4. One Two Three Four Five Six Seven"), false);
});

test("parseSectionNumber and compareHeadingLabels order sections numerically", () => {
  assert.deepEqual(parseSectionNumber("3.10 Foo"), [3, 10]);
  assert.equal(parseSectionNumber("Intro"), null);
  const sorted = ["10 Last", "Abstract", "2.1 B", "2 A", "Appendix"].sort(compareHeadingLabels);
  assert.deepEqual(sorted, ["Abstract", "2 A", "2.1 B", "10 Last", "Appendix"]);
});
