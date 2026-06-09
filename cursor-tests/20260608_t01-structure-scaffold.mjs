import assert from "node:assert/strict";
import {
  normalizeDocumentStructure,
  createTextBlock,
  emptyStructureReport,
} from "../src/js/normalization/index.js";
import { aggregateConfidence } from "../src/js/normalization/types.js";

async function testStubPipeline() {
  const result = await normalizeDocumentStructure({
    rawContent: "Hello world",
    format: "txt",
  });
  assert.deepEqual(result.blocks, []);
  assert.deepEqual(result.headings, []);
  assert.equal(result.structure.headingCount, 0);
  assert.equal(result.structure.artifactsRemoved, 0);
}

function testCreateTextBlock() {
  const block = createTextBlock({ text: "Test", source: "txt", fontSize: 12 });
  assert.ok(block.id.startsWith("blk-"));
  assert.equal(block.text, "Test");
  assert.equal(block.fontSize, 12);
  assert.equal(block.kind, "paragraph");
  assert.equal(block.pageIndex, 0);
}

function testEmptyStructureReport() {
  const report = emptyStructureReport();
  assert.equal(report.confidence, "low");
  assert.deepEqual(report.warnings, []);
}

function testAggregateConfidence() {
  assert.equal(aggregateConfidence([], 6000), "low");
  assert.equal(
    aggregateConfidence([{ score: 100, source: "outline" }], 1000),
    "high",
  );
}

testCreateTextBlock();
testEmptyStructureReport();
testAggregateConfidence();
await testStubPipeline();

console.log("20260608_t01-structure-scaffold: all tests passed");
