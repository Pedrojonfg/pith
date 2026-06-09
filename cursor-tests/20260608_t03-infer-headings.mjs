import assert from "node:assert/strict";
import {
  inferHeadings,
  validateHeadingHierarchy,
  computeBodyFontSize,
  assignLevelsFromFontSizes,
} from "../src/js/normalization/infer-headings.js";
import { createTextBlock, resetBlockIdSequence } from "../src/js/normalization/types.js";

function testNumberedTxtHeading() {
  resetBlockIdSequence();
  const blocks = [
    createTextBlock({ text: "1. Introducción", source: "txt", fontSize: 0 }),
    createTextBlock({
      text: "Párrafo de cuerpo con varias palabras para rellenar el texto.",
      source: "txt",
      fontSize: 0,
    }),
  ];
  const { headings } = inferHeadings(blocks, { format: "txt" });
  assert.ok(headings.length >= 1);
  assert.match(headings[0].label, /Introducción/i);
  assert.ok(headings[0].score >= 35);
}

function testAllCapsHeading() {
  resetBlockIdSequence();
  const blocks = [
    createTextBlock({ text: "ABSTRACT", source: "txt", fontSize: 0 }),
  ];
  const { headings } = inferHeadings(blocks, { format: "txt" });
  assert.equal(headings.length, 1);
}

function testAntiStacking() {
  const headings = validateHeadingHierarchy([
    { label: "A", level: 1, score: 50, source: "pattern", blockId: "a", charStart: 0, charEnd: 1 },
    { label: "B", level: 1, score: 50, source: "pattern", blockId: "b", charStart: 10, charEnd: 11 },
  ]);
  assert.equal(headings[1].level, 2);
}

function testFontHistogram() {
  resetBlockIdSequence();
  const blocks = [
    createTextBlock({
      text: "word ".repeat(25).trim(),
      source: "pdf",
      fontSize: 12,
    }),
    createTextBlock({ text: "Big Title", source: "pdf", fontSize: 24 }),
    createTextBlock({ text: "Section", source: "pdf", fontSize: 18 }),
  ];
  const body = computeBodyFontSize(blocks);
  assert.equal(body, 12);
  const map = assignLevelsFromFontSizes([24, 18]);
  assert.equal(map.get(24), 1);
  assert.equal(map.get(18), 2);
  const { headings } = inferHeadings(blocks, { format: "pdf" });
  const big = headings.find((h) => h.label === "Big Title");
  const sec = headings.find((h) => h.label === "Section");
  assert.ok(big);
  assert.ok(sec);
  assert.equal(big.level, 1);
  assert.equal(sec.level, 2);
}

testNumberedTxtHeading();
testAllCapsHeading();
testAntiStacking();
testFontHistogram();

console.log("20260608_t03-infer-headings: all tests passed");
