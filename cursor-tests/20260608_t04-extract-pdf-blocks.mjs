import assert from "node:assert/strict";
import {
  clusterTextItemsToBlocks,
  fontHeightFromTransform,
} from "../src/js/normalization/extract-pdf-blocks.js";

function testFontHeight() {
  const h = fontHeightFromTransform([1, 0, 0, 12, 50, 700]);
  assert.equal(h, 12);
}

function testClusterMockItems() {
  const items = [
    { str: "Hello", transform: [12, 0, 0, 12, 72, 700], fontName: "Arial" },
    { str: "World", transform: [12, 0, 0, 12, 120, 700], fontName: "Arial-Bold" },
    { str: "Next line", transform: [12, 0, 0, 12, 72, 680], fontName: "Arial" },
  ];
  const blocks = clusterTextItemsToBlocks(items, 0, 792);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].text, "Hello World");
  assert.ok(blocks[0].fontSize > 0);
  assert.equal(blocks[0].pageIndex, 0);
  assert.equal(blocks[1].text, "Next line");
  assert.ok(blocks[0].bbox);
}

testFontHeight();
testClusterMockItems();

console.log("20260608_t04-extract-pdf-blocks: all tests passed");
