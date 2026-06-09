import assert from "node:assert/strict";
import { dehyphenate } from "../src/js/normalization/emit-markdown.js";
import { detectColumnLayout, clusterTextItemsToBlocks } from "../src/js/normalization/extract-pdf-blocks.js";

function testDehyphenateWordJoin() {
  const input = "Es intrinseca-\nmente posible.";
  const out = dehyphenate(input);
  assert.equal(out, "Es intrinsecamente posible.");
  assert.ok(!/\w-\n[a-záéíóúüñ]/u.test(out));
}

function testDehyphenatePreservesName() {
  const input = "Korsgaard-\nMueller argues.";
  const out = dehyphenate(input);
  assert.equal(out, "Korsgaard-\nMueller argues.");
}

function testBicolumnPartition() {
  const items = [];
  for (let y = 700; y >= 600; y -= 20) {
    items.push({
      str: "LeftCol",
      transform: [12, 0, 0, 12, 80, y],
      height: 12,
      fontName: "Arial",
    });
    items.push({
      str: "RightCol",
      transform: [12, 0, 0, 12, 380, y],
      height: 12,
      fontName: "Arial",
    });
  }
  const blocks = clusterTextItemsToBlocks(items, 0, 792, 612);
  const joined = blocks.map((b) => b.text).join("|");
  assert.ok(!joined.includes("LeftCol RightCol"), "should not merge columns");
  assert.ok(joined.includes("LeftCol"));
  assert.ok(joined.includes("RightCol"));
}

function testColumnLayoutDetect() {
  const glyphs = [
    { x: 100 },
    { x: 110 },
    { x: 400 },
    { x: 410 },
  ];
  const layout = detectColumnLayout(glyphs, 612);
  assert.ok(layout);
  assert.ok(layout.splitX > 200);
}

testDehyphenateWordJoin();
testDehyphenatePreservesName();
testBicolumnPartition();
testColumnLayoutDetect();

console.log("20260609_t05-dehyphenate: all tests passed");
