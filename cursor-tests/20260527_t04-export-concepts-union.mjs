/**
 * T12 / SC-006 — collectExportConcepts union + mid-session export (quickstart §8)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260527_t04-export-concepts-union.mjs
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

globalThis.window = globalThis.window || {};
globalThis.window.guideHistory = [];

// --- dedup across three sources (contract FR-011) ---
resetStorage();
localStorage.setItem(
  LS_SESSION_CONCEPTS_KEY,
  JSON.stringify([{ term: "Shared", definition: "legacy short" }]),
);
localStorage.setItem(
  LS_SESSION_CONCEPTS_BY_BLOCK_KEY,
  JSON.stringify({
    0: [{ term: "shared", definition: "by-block longer definition wins" }],
    1: [{ term: "OnlyByBlock", definition: "from concepts_by_block" }],
  }),
);

const sessionUnion = {
  n_blocks: 2,
  blocks: [
    { concepts: [{ term: "OnlyBlockArray", definition: "from blocks[].concepts" }] },
    {
      explanation: "prefetched block 2",
      concepts: [{ term: "OnlyByBlock", definition: "shorter in block array" }],
    },
  ],
};

const merged = collectExportConcepts(sessionUnion);
assert(merged.length === 3, "union dedupes to three unique terms (Shared, OnlyByBlock, OnlyBlockArray)");
const shared = merged.find((c) => c.term.toLowerCase() === "shared");
assert(
  shared?.definition === "by-block longer definition wins",
  "dedup: longer non-empty definition wins across sources",
);
const onlyByBlock = merged.find((c) => c.term === "OnlyByBlock");
assert(
  onlyByBlock?.definition === "from concepts_by_block",
  "dedup: by-block beats shorter blocks[].concepts entry",
);

// --- SC-006: mid-session export before opening block 2 (quickstart §8) ---
resetStorage();
localStorage.setItem(
  LS_SESSION_CONCEPTS_BY_BLOCK_KEY,
  JSON.stringify({
    1: [{ term: "MidSessionTerm", definition: "Visible in export dictionary." }],
  }),
);

const midSession = {
  n_blocks: 2,
  n_test: 2,
  n_socratic: 0,
  blocks_list_text: "1. First\n2. Second",
  blocks: [
    { explanation: "Block one studied.", questions: [{ type: "test", question: "Q1?" }] },
    {
      explanation: "Prefetched explanation for block 2.",
      questions: [],
      concepts: [{ term: "MidSessionTerm", definition: "Also on block object." }],
    },
  ],
  _responses: { blocks: {} },
};

const md = buildMarkdown(midSession);
assert(md.includes("## Block 2:") || md.includes("## Block 2: Second"), "SC-006: export has Block 2 section");
assert(
  md.includes("Prefetched explanation for block 2."),
  "SC-006: write-through explanation in export without studying block 2",
);
assert(md.includes("## Concept Dictionary"), "SC-006: concept dictionary section present");
assert(md.includes("### MidSessionTerm"), "SC-006: dictionary includes block-2 prefetch term heading");
assert(!md.includes("## Block 3:"), "no phantom block 3");

// Failure-ish: ungenerated block omitted from body
const sparse = {
  n_blocks: 3,
  blocks_list_text: "1. A\n2. B\n3. C",
  blocks: [{ explanation: "Only block 1", questions: [] }, {}, {}],
};
const mdSparse = buildMarkdown(sparse);
assert(mdSparse.includes("## Block 1:"), "sparse: block 1 exported");
assert(!mdSparse.includes("## Block 2:"), "sparse: empty block 2 omitted");

// Edge: prefer non-empty definition over empty legacy
resetStorage();
localStorage.setItem(
  LS_SESSION_CONCEPTS_KEY,
  JSON.stringify([{ term: "EmptyFirst", definition: "" }]),
);
const filled = collectExportConcepts({
  blocks: [{ concepts: [{ term: "EmptyFirst", definition: "filled from block" }] }],
});
assert(filled[0]?.definition === "filled from block", "non-empty block definition fills legacy gap");

console.log(`\nT04 export concepts union (SC-006): ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
