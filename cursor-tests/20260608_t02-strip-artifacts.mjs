import assert from "node:assert/strict";
import { stripArtifacts } from "../src/js/normalization/strip-artifacts.js";
import { createTextBlock, resetBlockIdSequence } from "../src/js/normalization/types.js";

function footerBlock(text) {
  return createTextBlock({
    text,
    source: "pdf",
    pageIndex: 0,
    bbox: { x: 100, y: 760, width: 20, height: 12 },
  });
}

function bodyBlock(text) {
  return createTextBlock({
    text,
    source: "pdf",
    pageIndex: 0,
    bbox: { x: 72, y: 400, width: 400, height: 14 },
  });
}

function testPageNumberInFooter() {
  resetBlockIdSequence();
  const { blocks, artifactsRemoved } = stripArtifacts(
    [footerBlock("42")],
    { pageHeights: [792] },
  );
  assert.equal(artifactsRemoved, 1);
  assert.equal(blocks[0].kind, "artifact");
}

function testNumberedSectionProtected() {
  resetBlockIdSequence();
  const { blocks, artifactsRemoved } = stripArtifacts(
    [bodyBlock("3.2 Método")],
    { pageHeights: [792] },
  );
  assert.equal(artifactsRemoved, 0);
  assert.notEqual(blocks[0].kind, "artifact");
}

function testPageFractionRegex() {
  resetBlockIdSequence();
  const { artifactsRemoved } = stripArtifacts(
    [createTextBlock({ text: "3 / 12", source: "txt" })],
  );
  assert.equal(artifactsRemoved, 1);
}

function testCentralLongLineProtected() {
  resetBlockIdSequence();
  const { artifactsRemoved } = stripArtifacts(
    [bodyBlock("Esta es una línea central con más de cuatro palabras")],
    { pageHeights: [792] },
  );
  assert.equal(artifactsRemoved, 0);
}

testPageNumberInFooter();
testNumberedSectionProtected();
testPageFractionRegex();
testCentralLongLineProtected();

console.log("20260608_t02-strip-artifacts: all tests passed");
