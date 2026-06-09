/**
 * T08 — integration closure
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  buildDocumentHierarchy,
  buildDeterministicHierarchy,
  getChunksFromHierarchy,
  hasMarkdownHeadings,
} from "../src/js/normalization/hierarchy.js";
import { buildScopeOptions } from "../src/js/slow/headings.js";
import { snapPageEndToSection } from "../src/js/slow/pagination.js";

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

const HEADING_DOC = "# One\n\nbody\n\n# Two\n\nmore";
const LONG_PLAIN = "x".repeat(3500);

async function run() {
  resetStorage();

  const det = await buildDocumentHierarchy(HEADING_DOC, null);
  assert(det?.method === "deterministic", "headings → deterministic");

  const trivial = await buildDocumentHierarchy("hi", null);
  assert(trivial?.method === "trivial", "<3k → trivial");

  const fixture = [
    { title: "Root", level: 1, startOffset: 0, endOffset: LONG_PLAIN.length, children: [] },
  ];
  let calls = 0;
  const llm = await buildDocumentHierarchy(
    LONG_PLAIN,
    async () => {
      calls += 1;
      return JSON.stringify(fixture);
    },
    { useCache: true },
  );
  assert(llm?.method === "llm", "no headings → LLM");
  await buildDocumentHierarchy(
    LONG_PLAIN,
    async () => {
      calls += 1;
      return JSON.stringify(fixture);
    },
    { useCache: true },
  );
  assert(calls === 1, "cache prevents second LLM call");

  const bad = await buildDocumentHierarchy(LONG_PLAIN, async () => "bad", { useCache: false });
  assert(bad?.method === "deterministic", "invalid → fallback");

  const tree = buildDeterministicHierarchy(HEADING_DOC);
  const chunks = getChunksFromHierarchy(tree, HEADING_DOC, 10000);
  assert(chunks.length >= 1, "chunks from tree");

  const scopes = buildScopeOptions(HEADING_DOC, "markdown", {
    docHierarchy: det,
    minScopeChars: 1,
  });
  assert(scopes.length >= 2, "scope picker from hierarchy");

  assert(snapPageEndToSection(10, [{ charStart: 50, charEnd: 100 }], 200, 200) === 50, "pagination snap");

  assert(!hasMarkdownHeadings(LONG_PLAIN), "plain doc has no headings");
}

await run();

console.log(`\n20260609_doc-hierarchy-integration: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
