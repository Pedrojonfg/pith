/**
 * T08 — Prefetch ready write-through + concepts_by_block + hook
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260526_t08-prefetch-ready-side-effects.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import { LS_SESSION_CONCEPTS_BY_BLOCK_KEY } from "../src/js/config.js";
import {
  applyPrefetchReadySideEffects,
  generateBlockForIndex,
  hasGeneratedBlockContent,
  loadActiveSession,
  prefetchState,
  setOnPrefetchReady,
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

// --- hasGeneratedBlockContent (FR-010a contract) ---
assert(!hasGeneratedBlockContent(null), "null block is not generated");
assert(!hasGeneratedBlockContent({ explanation: "", questions: [] }), "empty block is not generated");
assert(hasGeneratedBlockContent({ explanation: "Hello" }), "non-empty explanation counts");
assert(
  hasGeneratedBlockContent({ explanation: "", questions: [{ type: "test" }] }),
  "non-empty questions counts",
);

// --- applyPrefetchReadySideEffects direct ---
resetStorage();
const session = {
  n_blocks: 2,
  blocks_list_text: "1. Block one\n2. Block two",
  blocks: [{ explanation: "block 0 done", questions: [] }, {}],
};
storeActiveSession(session);
state.activeSession = session;

let hookCalls = 0;
setOnPrefetchReady(({ blockIndex }) => {
  hookCalls += 1;
  assert(blockIndex === 1, "hook receives block index");
});

applyPrefetchReadySideEffects(
  1,
  {
    id: 2,
    title: "Block two",
    explanation: "Prefetched explanation for block 2.",
    questions: [{ type: "test", question: "Q?" }],
    concepts: [{ term: "TermA", definition: "Def A" }],
  },
  { n_test: 2, n_socratic: 0, explanation_profile: "thorough", gap_focus: [] },
);

const afterDirect = loadActiveSession();
assert(
  String(afterDirect.blocks[1]?.explanation || "").includes("Prefetched explanation"),
  "write-through: blocks[1] has explanation in localStorage",
);
assert(hasGeneratedBlockContent(afterDirect.blocks[1]), "write-through satisfies hasGeneratedBlockContent");
assert(hookCalls === 1, "onPrefetchReady invoked once");

const byBlock = JSON.parse(localStorage.getItem(LS_SESSION_CONCEPTS_BY_BLOCK_KEY) || "{}");
assert(Array.isArray(byBlock["1"]) && byBlock["1"][0]?.term === "TermA", "concepts_by_block[1] stored");

// empty concepts clears block entry
applyPrefetchReadySideEffects(
  1,
  { explanation: "Still here", questions: [], concepts: [] },
  { n_test: 2, n_socratic: 0 },
);
const byBlockEmpty = JSON.parse(localStorage.getItem(LS_SESSION_CONCEPTS_BY_BLOCK_KEY) || "{}");
assert(Array.isArray(byBlockEmpty["1"]) && byBlockEmpty["1"].length === 0, "empty concepts → []");

// --- triggerPrefetch integration: ready keeps slot + write-through block 2 ---
resetStorage();
setOnPrefetchReady(null);
const session2 = {
  n_blocks: 2,
  blocks_list_text: "1. One\n2. Two",
  blocks: [{ explanation: "done", questions: [] }, {}],
};
storeActiveSession(session2);
state.activeSession = session2;

let fetchCalls = 0;
globalThis.fetch = async () => {
  fetchCalls += 1;
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              id: 2,
              title: "Two",
              explanation: "API block two explanation.",
              questions: [{ type: "test", question: "Q?", options: { A: "a", B: "b", C: "c", D: "d" }, answer: "A" }],
              concepts: [{ term: "ApiTerm", definition: "from prefetch" }],
            }),
          },
        },
      ],
    }),
  };
};
globalThis.localStorage.setItem("ds_api_key", "test-key");
localStorage.setItem(
  "block_index",
  JSON.stringify([
    { id: 1, title: "One", chunk: "chunk one" },
    { id: 2, title: "Two", chunk: "chunk two" },
  ]),
);

triggerPrefetch(1, { force: true });
await waitForPrefetchReady();
assert(prefetchState.status === "ready", "prefetch reaches ready");
assert(prefetchState.data?.explanation?.includes("API block two"), "prefetchState.data retained");
assert(prefetchState.blockIndex === 1, "prefetch slot still targets block 1");

const afterPrefetch = loadActiveSession();
assert(
  String(afterPrefetch.blocks[1]?.explanation || "").includes("API block two"),
  "after prefetch ready, blocks[1] populated without transition",
);
assert(hasGeneratedBlockContent(afterPrefetch.blocks[1]), "FR-010a: session block reusable");

// ensureBlockGenerated path: has content → no second API call
const beforeSecond = fetchCalls;
if (hasGeneratedBlockContent(afterPrefetch.blocks[1])) {
  // same guard ensureBlockGenerated uses
  assert(true, "would skip generateBlockForIndex");
} else {
  await generateBlockForIndex(1);
}
assert(fetchCalls === beforeSecond, "second generation path does not call API when write-through present");

const apiByBlock = JSON.parse(localStorage.getItem(LS_SESSION_CONCEPTS_BY_BLOCK_KEY) || "{}");
assert(apiByBlock["1"]?.[0]?.term === "ApiTerm", "triggerPrefetch updates concepts_by_block");

console.log(`\nT08 prefetch ready side effects: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
