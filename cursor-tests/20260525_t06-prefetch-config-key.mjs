/**
 * T06 — Prefetch configKey includes explanation_profile + gap_focus; invalidate on accept
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260525_t06-prefetch-config-key.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  applyAssessmentResults,
  buildBlockConfigKey,
  invalidatePrefetch,
  prefetchState,
  resolveBlockQuestionConfig,
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

// --- buildBlockConfigKey ---
const base = { n_test: 2, n_socratic: 1, explanation_profile: "thorough", gap_focus: [] };
const withGaps = {
  ...base,
  gap_focus: ["Flux confusion", "Boundary"],
};
assert(buildBlockConfigKey(base) === "2|1|thorough|", "key includes profile; empty gaps");
assert(
  buildBlockConfigKey(withGaps) === "2|1|thorough|Flux confusion,Boundary",
  "key joins gap_focus",
);
assert(
  buildBlockConfigKey({ ...base, explanation_profile: "brief_deep" }) !== buildBlockConfigKey(base),
  "brief_deep vs thorough → different keys at same counts",
);
assert(
  buildBlockConfigKey({ n_test: 2, n_socratic: 1 }) === buildBlockConfigKey(base),
  "missing profile/gaps use defaults in key",
);

// --- stale key would match counts-only legacy format ---
assert(
  buildBlockConfigKey(withGaps) !== "3|2|thorough",
  "profile key differs from legacy n_test|n_socratic-only key",
);

// --- resolveBlockQuestionConfig after assessment-shaped _config ---
resetStorage();
const session = {
  n_test: 2,
  n_socratic: 1,
  blocks_list_text: "1. Weak block",
  blocks: [
    {
      _config: {
        n_test: 3,
        n_socratic: 2,
        explanation_profile: "thorough",
        gap_focus: ["Gap A", "Gap B"],
      },
    },
  ],
};
storeActiveSession(session);
state.activeSession = session;
const weakCfg = resolveBlockQuestionConfig(0);
assert(weakCfg.explanation_profile === "thorough", "weak block thorough");
assert(weakCfg.gap_focus.length === 2, "weak block gaps");
assert(
  buildBlockConfigKey(weakCfg) === "3|2|thorough|Gap A,Gap B",
  "resolved weak config key matches contract shape",
);

// --- invalidatePrefetch on applyAssessmentResults ---
prefetchState.blockIndex = 0;
prefetchState.status = "ready";
prefetchState.data = { id: 1, title: "stale" };
prefetchState.configKey = "2|1|thorough|";
localStorage.setItem("block_index", JSON.stringify([{ id: 1, title: "B1" }]));
applyAssessmentResults({
  perBlock: { 1: { classification: "weak" } },
  gapsByBlock: { 1: [{ label: "New gap" }] },
  maxQuestions: 5,
  penalisedTotal: 1,
  rawTotal: 1,
});
assert(prefetchState.status === "idle", "accept clears ready prefetch");
assert(prefetchState.data == null, "accept clears prefetched data");
assert(prefetchState.configKey === "", "accept clears configKey");
const afterAccept = resolveBlockQuestionConfig(0);
assert(afterAccept.gap_focus.includes("New gap"), "accept merged gaps into block _config");
assert(
  buildBlockConfigKey(afterAccept).includes("New gap"),
  "post-accept key includes synthesized gap",
);

// --- triggerPrefetch records profile-aware configKey (sync, before API) ---
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            id: 1,
            title: "Weak",
            explanation: "word ".repeat(200),
            questions: [],
            concepts: [],
          }),
        },
      },
    ],
  }),
});
globalThis.localStorage.setItem("ds_api_key", "test-key");
localStorage.setItem(
  "block_index",
  JSON.stringify([{ id: 1, title: "Weak", chunk: "chunk text" }]),
);
invalidatePrefetch();
triggerPrefetch(0, { force: true });
assert(prefetchState.status === "generating", "prefetch started");
assert(
  prefetchState.configKey === buildBlockConfigKey(afterAccept),
  "triggerPrefetch sets full configKey from resolved profile",
);
invalidatePrefetch();

// --- legacy two-part key must not match profile-aware key ---
const legacyKey = `${afterAccept.n_test}|${afterAccept.n_socratic}`;
const fullKey = buildBlockConfigKey(afterAccept);
assert(legacyKey !== fullKey, "full key extends legacy n_test|n_socratic");
prefetchState.blockIndex = 0;
prefetchState.status = "ready";
prefetchState.data = { stale: true };
prefetchState.configKey = legacyKey;
assert(
  prefetchState.configKey !== fullKey,
  "ready cache with legacy key does not satisfy full profile key",
);

console.log(`\nT06 prefetch configKey: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
