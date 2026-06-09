import assert from "node:assert/strict";
import {
  normalizeForComparison,
  applyEncodingFixups,
  matchScore,
  matchScoreFallback,
  matchOutlineToBlocks,
  computeOutlineCoverage,
} from "../src/js/normalization/pdf-outline.js";
import { createTextBlock, resetBlockIdSequence } from "../src/js/normalization/types.js";

function testNormalizeEncodingFixup() {
  const norm = normalizeForComparison(applyEncodingFixups("Introducci6n"));
  assert.equal(norm, "introduccion");
  assert.ok(matchScore("Introducción", "Introducci6n") >= 50);
}

function testPrefixFallback() {
  const score = matchScoreFallback(
    "La cuestión de la crueldad animal",
    "La cuestión de la cr",
  );
  assert.equal(score, 60);
}

function testCorruptBlockMatch() {
  resetBlockIdSequence();
  const blocks = [
    createTextBlock({ text: "Introducci6n", source: "pdf", pageIndex: 5 }),
  ];
  const outline = [{ title: "Introducción", pageIndex: 5, level: 1 }];
  const headings = matchOutlineToBlocks(outline, blocks);
  assert.equal(headings.length, 1);
  assert.equal(headings[0].label, "Introducción");
  assert.equal(headings[0].source, "outline");
  assert.ok(headings[0].score >= 50);
}

function testOutlineCoverage() {
  const outline = [{ title: "A" }, { title: "B" }];
  const matches = [{ label: "A" }, { label: "B" }];
  assert.equal(computeOutlineCoverage(matches, outline), 1);
}

testNormalizeEncodingFixup();
testPrefixFallback();
testCorruptBlockMatch();
testOutlineCoverage();

console.log("20260609_t01-outline-normalize: all tests passed");
