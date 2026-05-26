/**
 * T12 / SC-005 — Prefetch write-through populates blocks[1] + dictionary aggregate
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260527_t03-prefetch-write-through.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import { LS_SESSION_CONCEPTS_BY_BLOCK_KEY } from "../src/js/config.js";
import { getSortedSessionConcepts } from "../src/js/dictionary.js";
import { collectExportConcepts } from "../src/js/export.js";
import {
  applyPrefetchReadySideEffects,
  hasGeneratedBlockContent,
  loadActiveSession,
  prefetchState,
  state,
  storeActiveSession,
  triggerPrefetch,
} from "../src/js/session.js";

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

async function waitForPrefetchReady(timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (prefetchState.status === "ready" || prefetchState.status === "failed") return;
    await new Promise((r) => setTimeout(r, 25));
  }
}

// --- SC-005: during block 1 study, prefetch block 2 ready grows export/dictionary ---
resetStorage();
const session = {
  n_blocks: 2,
  blocks_list_text: "1. Block one\n2. Block two",
  blocks: [{ explanation: "Studied block 1.", questions: [{ type: "test", question: "Q?" }] }, {}],
};
storeActiveSession(session);
state.activeSession = session;

assert(!hasGeneratedBlockContent(session.blocks[1]), "block 2 empty before prefetch");
const conceptsBefore = collectExportConcepts(session).length;
const sortedBefore = getSortedSessionConcepts().length;

applyPrefetchReadySideEffects(
  1,
  {
    id: 2,
    title: "Block two",
    explanation: "Prefetched explanation for block 2.",
    questions: [{ type: "test", question: "Q2?" }],
    concepts: [{ term: "Block2Term", definition: "From prefetch ready." }],
  },
  { n_test: 2, n_socratic: 0, explanation_profile: "thorough", gap_focus: [] },
);

const after = loadActiveSession();
assert(
  String(after.blocks[1]?.explanation || "").includes("Prefetched explanation"),
  "applyPrefetchReadySideEffects: blocks[1] write-through in session",
);
assert(hasGeneratedBlockContent(after.blocks[1]), "blocks[1] exportable before studying block 2");

const conceptsAfter = collectExportConcepts(after);
assert(conceptsAfter.length > conceptsBefore, "SC-005: collectExportConcepts grows after prefetch ready");
assert(
  conceptsAfter.some((c) => c.term === "Block2Term"),
  "SC-005: export union includes prefetched block-2 term",
);
assert(
  getSortedSessionConcepts().length > sortedBefore,
  "SC-005: session dictionary aggregate grows without advancing block",
);
assert(
  getSortedSessionConcepts().some((c) => c.term === "Block2Term"),
  "getSortedSessionConcepts lists prefetched term",
);

const byBlock = JSON.parse(localStorage.getItem(LS_SESSION_CONCEPTS_BY_BLOCK_KEY) || "{}");
assert(byBlock["1"]?.[0]?.term === "Block2Term", "concepts_by_block[1] mirrors prefetch");

// Edge: prefetch without concepts still write-through block body
resetStorage();
const sessionNoConcepts = {
  n_blocks: 2,
  blocks: [{ explanation: "done" }, {}],
};
storeActiveSession(sessionNoConcepts);
state.activeSession = sessionNoConcepts;
applyPrefetchReadySideEffects(
  1,
  { explanation: "Body only prefetch.", questions: [], concepts: [] },
  { n_test: 1, n_socratic: 0 },
);
const afterNoConcepts = loadActiveSession();
assert(
  hasGeneratedBlockContent(afterNoConcepts.blocks[1]),
  "prefetch without concepts still populates blocks[1]",
);
const byBlockEmpty = JSON.parse(localStorage.getItem(LS_SESSION_CONCEPTS_BY_BLOCK_KEY) || "{}");
assert(Array.isArray(byBlockEmpty["1"]) && byBlockEmpty["1"].length === 0, "empty concepts clears block slot");

// --- triggerPrefetch integration (mock API) ---
resetStorage();
const session2 = {
  n_blocks: 2,
  blocks_list_text: "1. One\n2. Two",
  blocks: [{ explanation: "block 0", questions: [] }, {}],
};
storeActiveSession(session2);
state.activeSession = session2;

globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            id: 2,
            title: "Two",
            explanation: "API write-through block 2.",
            questions: [{ type: "test", question: "?", options: { A: "a", B: "b", C: "c", D: "d" }, answer: "A" }],
            concepts: [{ term: "ApiPrefetch", definition: "via triggerPrefetch" }],
          }),
        },
      },
    ],
  }),
});
globalThis.localStorage.setItem("ds_api_key", "test-key");
localStorage.setItem(
  "block_index",
  JSON.stringify([
    { id: 1, title: "One", chunk: "one" },
    { id: 2, title: "Two", chunk: "two" },
  ]),
);

triggerPrefetch(1, { force: true });
await waitForPrefetchReady();
assert(prefetchState.status === "ready", "triggerPrefetch reaches ready");
const afterApi = loadActiveSession();
assert(
  String(afterApi.blocks[1]?.explanation || "").includes("API write-through"),
  "triggerPrefetch: blocks[1] populated without transition",
);

console.log(`\nT03 prefetch write-through (SC-005): ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
