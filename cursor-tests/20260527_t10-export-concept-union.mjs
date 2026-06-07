/**
 * T10 — collectExportConcepts union + buildMarkdown block gating
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260527_t10-export-concept-union.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  LS_SESSION_CONCEPTS_BY_BLOCK_KEY,
  LS_SESSION_CONCEPTS_KEY,
} from "../src/js/config.js";
import { buildMarkdown, collectExportConcepts } from "../src/js/export.js";

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

resetStorage();
globalThis.window = globalThis.window || {};
globalThis.window.guideHistory = [];

// --- dedup: longer definition wins ---
localStorage.setItem(
  LS_SESSION_CONCEPTS_KEY,
  JSON.stringify([{ term: "Alpha", definition: "short" }]),
);
localStorage.setItem(
  LS_SESSION_CONCEPTS_BY_BLOCK_KEY,
  JSON.stringify({
    0: [{ term: "alpha", definition: "longer definition wins" }],
    1: [{ term: "Beta", definition: "from by-block" }],
  }),
);

const sessionDedup = {
  n_blocks: 2,
  blocks: [
    { concepts: [{ term: "Gamma", definition: "from block 0" }] },
    {
      explanation: "prefetched",
      concepts: [{ term: "Beta", definition: "shorter" }],
    },
  ],
};

const merged = collectExportConcepts(sessionDedup);
assert(merged.length === 3, "union yields three unique terms");
const alpha = merged.find((c) => c.term.toLowerCase() === "alpha");
assert(alpha?.definition === "longer definition wins", "longer definition wins on dedup");
const beta = merged.find((c) => c.term === "Beta");
assert(beta?.definition === "from by-block", "non-empty by-block beats shorter block concept");

// --- SC-006: write-through block 2 in export without answers ---
resetStorage();
localStorage.setItem(
  LS_SESSION_CONCEPTS_BY_BLOCK_KEY,
  JSON.stringify({
    1: [{ term: "Flux", definition: "Rate of flow through a surface." }],
  }),
);

const sessionWriteThrough = {
  n_blocks: 2,
  n_test: 2,
  n_socratic: 0,
  blocks_list_text: "1. First\n2. Second",
  blocks: [
    { explanation: "Block one studied.", questions: [{ type: "test", question: "Q1?" }] },
    {
      explanation: "Prefetched explanation for block 2.",
      questions: [],
      concepts: [{ term: "Flux", definition: "From block array." }],
    },
  ],
  _responses: { blocks: {} },
};

const md = buildMarkdown(sessionWriteThrough);
assert(md.includes("## Block 2: Second") || md.includes("## Block 2:"), "export includes Block 2 section");
assert(
  md.includes("Prefetched explanation for block 2."),
  "write-through explanation appears in export",
);
assert(md.includes("## Block 1:"), "block 1 section present");
assert(md.includes("## Concept Dictionary"), "concept dictionary section present");
assert(md.includes("### Flux"), "concept dictionary has Flux heading");
assert(md.includes("Rate of flow through a surface."), "concept dictionary includes Flux definition body");

// ungenerated block omitted
const sessionSparse = {
  n_blocks: 3,
  blocks_list_text: "1. A\n2. B\n3. C",
  blocks: [
    { explanation: "Only block 1", questions: [] },
    {},
    {},
  ],
};
const mdSparse = buildMarkdown(sessionSparse);
assert(md.includes("## Block 1:"), "generated block 1 exported");
assert(!mdSparse.includes("## Block 2:"), "empty block 2 omitted");
assert(!mdSparse.includes("## Block 3:"), "empty block 3 omitted");

// prefer non-empty over empty
resetStorage();
localStorage.setItem(
  LS_SESSION_CONCEPTS_KEY,
  JSON.stringify([{ term: "EmptyFirst", definition: "" }]),
);
const withBetter = collectExportConcepts({
  blocks: [{ concepts: [{ term: "EmptyFirst", definition: "filled in block" }] }],
});
assert(withBetter[0]?.definition === "filled in block", "non-empty definition preferred");

console.log(`\nT10 export concept union: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
