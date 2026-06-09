/**
 * T02 — buildDocumentHierarchy LLM + fallback
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260609_doc-hierarchy-llm.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  buildDocumentHierarchy,
  buildTrivialHierarchy,
  parseLlmHierarchyTree,
} from "../src/js/normalization/hierarchy.js";
import { getCachedHierarchy, hashText } from "../src/js/normalization/hierarchy-cache.js";

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

const PAPER_NO_HEADINGS =
  "The concept of moral luck was introduced by Bernard Williams and Thomas Nagel. ".repeat(80);

function buildFixtureTree(text) {
  return [
    {
      title: "Moral Luck",
      level: 1,
      startOffset: 0,
      endOffset: text.length,
      children: [
        {
          title: "Introduction",
          level: 2,
          startOffset: 0,
          endOffset: Math.floor(text.length / 2),
          children: [],
        },
        {
          title: "Discussion",
          level: 2,
          startOffset: Math.floor(text.length / 2),
          endOffset: text.length,
          children: [],
        },
      ],
    },
  ];
}

async function testLlmModeOffsets() {
  resetStorage();
  const fixture = buildFixtureTree(PAPER_NO_HEADINGS);
  let calls = 0;
  const result = await buildDocumentHierarchy(
    PAPER_NO_HEADINGS,
    async () => {
      calls += 1;
      return JSON.stringify(fixture);
    },
    { useCache: false },
  );
  assert(result?.method === "llm", "LLM mode used");
  assert(calls === 1, "llmFn called once");
  assert(result?.tree?.length === 1, "LLM tree has root");

  const root = result.tree[0];
  const slice = PAPER_NO_HEADINGS.slice(root.startOffset, root.endOffset);
  assert(slice === PAPER_NO_HEADINGS, "root slice matches full text");
}

async function testInvalidJsonFallback() {
  resetStorage();
  const result = await buildDocumentHierarchy(
    PAPER_NO_HEADINGS,
    async () => "not json at all",
    { useCache: false },
  );
  assert(result?.method === "deterministic", "invalid JSON → deterministic fallback");
}

async function testNoLlmFnReturnsNull() {
  const result = await buildDocumentHierarchy(PAPER_NO_HEADINGS, null, { useCache: false });
  assert(result === null, "no llmFn → null for long doc without headings");
}

async function testTrivialShortDoc() {
  const text = "Short note.";
  const result = await buildDocumentHierarchy(text, null);
  assert(result?.method === "trivial", "short doc → trivial");
}

async function testCacheSkipsLlm() {
  resetStorage();
  const fixture = buildFixtureTree(PAPER_NO_HEADINGS);
  const hash = hashText(PAPER_NO_HEADINGS);
  let calls = 0;
  const llmFn = async () => {
    calls += 1;
    return JSON.stringify(fixture);
  };

  await buildDocumentHierarchy(PAPER_NO_HEADINGS, llmFn, { useCache: true, textHash: hash });
  await buildDocumentHierarchy(PAPER_NO_HEADINGS, llmFn, { useCache: true, textHash: hash });
  assert(calls === 1, "cache hit skips second llmFn call");
  assert(getCachedHierarchy(hash) !== null, "cache populated");
}

function testParseAcceptsObjectRoot() {
  const tree = parseLlmHierarchyTree(
    JSON.stringify({ title: "Root", level: 1, startOffset: 0, endOffset: 10, children: [] }),
  );
  assert(Array.isArray(tree) && tree.length === 1, "single object root normalized to array");
}

await testLlmModeOffsets();
await testInvalidJsonFallback();
await testNoLlmFnReturnsNull();
await testTrivialShortDoc();
await testCacheSkipsLlm();
testParseAcceptsObjectRoot();

console.log(`\n20260609_doc-hierarchy-llm: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
