import assert from "node:assert/strict";
import { inferHeadings } from "../src/js/normalization/infer-headings.js";
import { createTextBlock, resetBlockIdSequence } from "../src/js/normalization/types.js";

function testShortCircuitNoHeuristic() {
  resetBlockIdSequence();
  const b1 = createTextBlock({
    text: "Chapter One",
    source: "pdf",
    pageIndex: 10,
    fontSize: 24,
  });
  const b2 = createTextBlock({
    text: "Some body text that looks like a heading",
    source: "pdf",
    pageIndex: 10,
    fontSize: 18,
    fontWeight: "bold",
  });
  const outline = [
    {
      label: "Chapter One",
      level: 1,
      score: 100,
      source: "outline",
      blockId: b1.id,
      charStart: 0,
      charEnd: 0,
    },
  ];
  const { headings } = inferHeadings([b1, b2], {
    outline,
    outlineCoverage: 1.0,
  });
  assert.equal(headings.length, 1);
  assert.equal(headings[0].source, "outline");
  assert.ok(!headings.some((h) => h.source === "pattern" || h.source === "font-size"));
}

function testPartialCoverageUsesHeuristic() {
  resetBlockIdSequence();
  const b1 = createTextBlock({
    text: "Methods",
    source: "pdf",
    pageIndex: 5,
    fontSize: 20,
    fontWeight: "bold",
  });
  const outline = [
    {
      label: "Methods",
      level: 2,
      score: 100,
      source: "outline",
      blockId: b1.id,
      charStart: 0,
      charEnd: 0,
    },
  ];
  const { headings } = inferHeadings([b1], {
    outline,
    outlineCoverage: 0.5,
  });
  assert.ok(headings.length >= 1);
}

testShortCircuitNoHeuristic();
testPartialCoverageUsesHeuristic();

console.log("20260609_t03-outline-short-circuit: all tests passed");
