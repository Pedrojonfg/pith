import assert from "node:assert/strict";
import {
  getFrontMatterPageRange,
  detectFrontMatterPages,
} from "../src/js/normalization/front-matter-detector.js";
import { isArtifact } from "../src/js/normalization/strip-artifacts.js";
import { createTextBlock, resetBlockIdSequence } from "../src/js/normalization/types.js";

function testOutlineFrontMatter() {
  const outline = [
    { title: "Portada", pageIndex: 0, level: 1 },
    { title: "Sumario", pageIndex: 2, level: 1 },
    { title: "Introducción", pageIndex: 9, level: 1 },
  ];
  const range = getFrontMatterPageRange(outline);
  assert.equal(range.skip, 8);
  assert.equal(range.source, "outline");
}

function testSparsePageDetection() {
  resetBlockIdSequence();
  const blocks = [
    createTextBlock({ text: "ATE", source: "pdf", pageIndex: 0 }),
    createTextBlock({ text: "Short", source: "pdf", pageIndex: 1 }),
    createTextBlock({ text: "x".repeat(400), source: "pdf", pageIndex: 2 }),
    createTextBlock({ text: "Body ".repeat(80), source: "pdf", pageIndex: 3 }),
  ];
  const end = detectFrontMatterPages(blocks, 10);
  assert.ok(end >= 0 && end < 3);
}

function testArtifactOrnaments() {
  resetBlockIdSequence();
  const ornament = createTextBlock({ text: "~II~", source: "pdf", pageIndex: 1 });
  const caps = createTextBlock({ text: "PAIDOS", source: "pdf", pageIndex: 2 });
  const ate = createTextBlock({ text: "ATE", source: "pdf", pageIndex: 0 });
  assert.ok(isArtifact(ornament, 5));
  assert.ok(isArtifact(caps, 5));
  assert.ok(isArtifact(ate, 5));
}

testOutlineFrontMatter();
testSparsePageDetection();
testArtifactOrnaments();

console.log("20260609_t02-front-matter: all tests passed");
