/**
 * T07 — Phase 0 chunks from hierarchy
 */
import { buildMapReduceChunks } from "../src/js/slow/phase0.js";
import { buildDeterministicHierarchy } from "../src/js/normalization/hierarchy.js";

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

const md = `# Intro\n\n${"word ".repeat(100)}\n\n## Part A\n\n${"a ".repeat(50)}\n\n## Part B\n\n${"b ".repeat(50)}`;
const tree = buildDeterministicHierarchy(md);
const docHierarchy = { tree, method: "deterministic", textHash: "x" };

const chunks = buildMapReduceChunks(md, [], 50000, docHierarchy);
assert(chunks.length >= 1, "hierarchy chunks produced");
assert(chunks.every((c) => c.title && c.text), "chunks have title and text");

const joined = chunks.map((c) => c.text).join("");
assert(joined.length === md.length, "chunks cover full scope text");
assert(chunks[0].title.length > 0, "section title on chunk");

console.log(`\n20260609_doc-hierarchy-phase0: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
