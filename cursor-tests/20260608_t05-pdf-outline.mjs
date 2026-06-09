import assert from "node:assert/strict";
import { matchOutlineToBlocks } from "../src/js/normalization/pdf-outline.js";
import { createTextBlock, resetBlockIdSequence } from "../src/js/normalization/types.js";

function testMatchOutlineToBlocks() {
  resetBlockIdSequence();
  const blocks = [
    createTextBlock({ text: "Introduction", source: "pdf", pageIndex: 0 }),
    createTextBlock({ text: "Body paragraph here.", source: "pdf", pageIndex: 0 }),
    createTextBlock({ text: "Methods", source: "pdf", pageIndex: 2 }),
  ];
  const outline = [
    { title: "Introduction", pageIndex: 0, level: 1 },
    { title: "Methods", pageIndex: 2, level: 2 },
  ];
  const headings = matchOutlineToBlocks(outline, blocks);
  assert.equal(headings.length, 2);
  assert.equal(headings[0].score, 100);
  assert.equal(headings[0].source, "outline");
  assert.equal(headings[0].level, 1);
  assert.equal(headings[1].blockId, blocks[2].id);
}

testMatchOutlineToBlocks();

console.log("20260608_t05-pdf-outline: all tests passed");
