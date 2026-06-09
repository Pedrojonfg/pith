/**
 * T01 — hierarchy.js pure functions
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260609_doc-hierarchy-pure.mjs
 */
import {
  buildDeterministicHierarchy,
  buildTrivialHierarchy,
  flattenHierarchy,
  getChunksFromHierarchy,
  hasMarkdownHeadings,
  validateHierarchy,
} from "../src/js/normalization/hierarchy.js";

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${msg}`);
}

const SAMPLE = `# Introduction

Intro body here.

## Methods

Methods detail.

## Results

Results detail.

# Conclusion

Final thoughts.
`;

function testDeterministicOffsets() {
  const tree = buildDeterministicHierarchy(SAMPLE);
  const v = validateHierarchy(tree, SAMPLE.length);
  assert(v.valid, `deterministic tree valid: ${v.errors.join("; ")}`);
  assert(tree.length >= 2, "deterministic: multiple roots");

  const intro = tree.find((n) => n.title === "Introduction");
  assert(intro, "deterministic: Introduction node");
  if (intro) {
    const slice = SAMPLE.slice(intro.startOffset, intro.endOffset);
    assert(slice.includes("Intro body"), "deterministic: intro slice content");
    assert(intro.children.some((c) => c.title === "Methods"), "deterministic: Methods child");
  }
}

function testTrivialHierarchy() {
  const text = "Short note without headings.";
  const tree = buildTrivialHierarchy(text);
  const v = validateHierarchy(tree, text.length);
  assert(v.valid, "trivial tree valid");
  assert(tree.length === 1, "trivial: single root");
  assert(tree[0].startOffset === 0 && tree[0].endOffset === text.length, "trivial: full span");
  assert(!hasMarkdownHeadings(text), "no headings detected");
}

function testValidateRejectsBadTree() {
  const bad = [{ title: "", level: 1, startOffset: 0, endOffset: 5, children: [] }];
  const v = validateHierarchy(bad, 10);
  assert(!v.valid, "validate rejects empty title");
  assert(v.errors.length > 0, "validate returns errors");
}

function testValidateSiblingGap() {
  const gap = [
    { title: "A", level: 1, startOffset: 0, endOffset: 5, children: [] },
    { title: "B", level: 1, startOffset: 7, endOffset: 10, children: [] },
  ];
  const v = validateHierarchy(gap, 10);
  assert(!v.valid, "validate rejects sibling gap");
}

function testFlattenBfs() {
  const tree = buildDeterministicHierarchy(SAMPLE);
  const flat = flattenHierarchy(tree, 2);
  assert(flat.length >= 3, "flatten includes level 1-2 nodes");
  assert(flat.every((n) => n.level <= 2), "flatten respects maxLevel");
  const titles = flat.map((n) => n.title);
  assert(titles.includes("Methods"), "flatten includes Methods");
}

function testChunksCoverFullText() {
  const tree = buildDeterministicHierarchy(SAMPLE);
  const chunks = getChunksFromHierarchy(tree, SAMPLE, 80);
  assert(chunks.length >= 2, "chunks split small max size");

  let cursor = 0;
  for (const ch of chunks) {
    assert(ch.startOffset === cursor, `chunk contiguous at ${cursor}`);
    assert(ch.text === SAMPLE.slice(ch.startOffset, ch.endOffset), "chunk text matches slice");
    assert(ch.title.length > 0, "chunk has title");
    cursor = ch.endOffset;
  }
  assert(cursor === SAMPLE.length, "chunks cover full text");
}

function testChunksMergeSmall() {
  const text = "# A\n\naa\n\n# B\n\nbb";
  const tree = buildDeterministicHierarchy(text);
  const chunks = getChunksFromHierarchy(tree, text, 10_000);
  assert(chunks.length === 1, "small sections merge into one chunk");
  assert(chunks[0].text === text, "merged chunk preserves all text");
}

function testPreambleBeforeFirstHeading() {
  const text = "Preamble text\n\n# Title\n\nBody";
  const tree = buildDeterministicHierarchy(text);
  const v = validateHierarchy(tree, text.length);
  assert(v.valid, "preamble tree valid");
  assert(tree[0].startOffset === 0, "tree starts at 0");
}

testDeterministicOffsets();
testTrivialHierarchy();
testValidateRejectsBadTree();
testValidateSiblingGap();
testFlattenBfs();
testChunksCoverFullText();
testChunksMergeSmall();
testPreambleBeforeFirstHeading();

console.log(`\n20260609_doc-hierarchy-pure: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
