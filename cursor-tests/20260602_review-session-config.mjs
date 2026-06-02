/**
 * Review session — focus prompt, block filter, per-session localStorage draft
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260602_review-session-config.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import { LS_KEY, LS_REVIEW_CONFIG_PREFIX } from "../src/js/config.js";
import { deepSeekGenerateReviewBatch } from "../src/js/api.js";
import {
  buildSessionContentForReview,
  extractSessionContentFromMarkdown,
  loadReviewConfigDraft,
  reviewConfigStorageKey,
  saveReviewConfigDraft,
} from "../src/js/review.js";
import { state } from "../src/js/session.js";

let passed = 0;
let failed = 0;
const originalFetch = globalThis.fetch;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${msg}`);
}

function assertIncludes(haystack, needle, msg) {
  const h = String(haystack || "");
  const n = String(needle || "");
  assert(h.includes(n), `${msg}\n  expected substring: ${JSON.stringify(n)}\n  in: ${h.slice(0, 400)}…`);
}

function assertNotIncludes(haystack, needle, msg) {
  const h = String(haystack || "");
  const n = String(needle || "");
  assert(!h.includes(n), `${msg}\n  should not include: ${JSON.stringify(n)}`);
}

// --- extractSessionContentFromMarkdown: block filter ---
const sampleMd = `## Block 1: Alpha
Expl one

### Questions

## Block 2: Beta
Expl two

### Questions

## Block 3: Gamma
Expl three

### Questions
`;

assertIncludes(
  extractSessionContentFromMarkdown(sampleMd, [0, 2]),
  "Expl one",
  "markdown filter: includes selected block 1",
);
assertIncludes(
  extractSessionContentFromMarkdown(sampleMd, [0, 2]),
  "Expl three",
  "markdown filter: includes selected block 3",
);
assertNotIncludes(
  extractSessionContentFromMarkdown(sampleMd, [0, 2]),
  "Expl two",
  "markdown filter: excludes unselected block 2",
);

assertIncludes(
  extractSessionContentFromMarkdown(sampleMd, null),
  "Expl two",
  "markdown filter: null selection keeps all blocks",
);

// --- buildSessionContentForReview: outline + explanations scoped ---
resetStorage();
state.activeSession = {
  _meta: { session_id: "sess-a" },
  blocks: [
    { id: 1, title: "Alpha", explanation: "Body alpha" },
    { id: 2, title: "Beta", explanation: "Body beta" },
    { id: 3, title: "Gamma", explanation: "Body gamma" },
  ],
};

const scoped = buildSessionContentForReview([1]);
assertIncludes(scoped, "Block 2: Beta", "session content: outline includes selected block");
assertNotIncludes(scoped, "Block 1: Alpha", "session content: outline excludes unselected block");
assertNotIncludes(scoped, "Body alpha", "session content: explanation excludes unselected block");
assertIncludes(scoped, "Body beta", "session content: explanation includes selected block");

// --- per-session localStorage draft ---
resetStorage();
const keyA = reviewConfigStorageKey("sess-a");
const keyB = reviewConfigStorageKey("sess-b");
assert(keyA === `${LS_REVIEW_CONFIG_PREFIX}sess-a`, "storage key is namespaced by session id");
assert(keyA !== keyB, "different sessions get different keys");

saveReviewConfigDraft("sess-a", {
  focus: "Repasar fechas",
  selectedBlocks: [0, 2],
  blockCount: 3,
});
saveReviewConfigDraft("sess-b", {
  focus: "Solo vocabulario",
  selectedBlocks: [1],
  blockCount: 3,
});

const draftA = loadReviewConfigDraft("sess-a", 3);
assert(draftA?.focus === "Repasar fechas", "load draft A: focus text");
assert(
  JSON.stringify(draftA?.selectedBlocks) === "[0,2]",
  "load draft A: selected blocks",
);

const draftB = loadReviewConfigDraft("sess-b", 3);
assert(draftB?.focus === "Solo vocabulario", "load draft B: isolated from session A");
assert(JSON.stringify(draftB?.selectedBlocks) === "[1]", "load draft B: selected blocks");

// stale indices dropped when block count shrinks
saveReviewConfigDraft("sess-a", {
  focus: "x",
  selectedBlocks: [0, 2, 5],
  blockCount: 2,
});
const shrunk = loadReviewConfigDraft("sess-a", 2);
assert(JSON.stringify(shrunk?.selectedBlocks) === "[0]", "load: drops out-of-range block indices");

assert(loadReviewConfigDraft("", 3) === null, "load: empty session id returns null");
assert(loadReviewConfigDraft("unknown", 3) === null, "load: missing key returns null");

// --- deepSeekGenerateReviewBatch: reviewInstructions in user message ---
resetStorage();
localStorage.setItem(LS_KEY, "test-key");
let capturedBody = null;
globalThis.fetch = async (_url, opts) => {
  capturedBody = JSON.parse(String(opts?.body || "{}"));
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: "[]" } }],
    }),
  };
};

await deepSeekGenerateReviewBatch({
  llmModel: "deepseek",
  sessionContent: "SESSION OUTLINE\n- Block 1: X",
  reviewInstructions: "Priorizar causa-efecto",
  type: "test",
  batchSize: 2,
});

const userMsg = capturedBody?.messages?.find((m) => m.role === "user")?.content || "";
assertIncludes(
  userMsg,
  "Student review focus (follow these preferences when generating questions):\nPriorizar causa-efecto",
  "API: review instructions prepended to user message",
);
assertIncludes(userMsg, "SESSION OUTLINE", "API: session content still in user message");

resetStorage();
localStorage.setItem(LS_KEY, "test-key");
capturedBody = null;
await deepSeekGenerateReviewBatch({
  llmModel: "deepseek",
  sessionContent: "Only session",
  reviewInstructions: "",
  type: "test",
  batchSize: 1,
});
const userMsgBare = capturedBody?.messages?.find((m) => m.role === "user")?.content || "";
assert(userMsgBare === "Only session", "API: empty instructions → user message is session content only");

globalThis.fetch = originalFetch;
state.activeSession = null;

console.log(`\nReview session config: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
