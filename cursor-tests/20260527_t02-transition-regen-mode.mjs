/**
 * T07 / T02 — resolveRegenMode matrix (transition overlay regen paths)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260527_t02-transition-regen-mode.mjs
 */
import { buildBlockConfigKey, resolveRegenMode } from "../src/js/session.js";

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

const baseCfg = {
  n_test: 2,
  n_socratic: 1,
  explanation_profile: "thorough",
  gap_focus: [],
};
const baseBlock = {
  id: 2,
  title: "Block 2",
  explanation: "Fixed RSVP explanation text.",
  questions: [{ type: "test", question: "old?" }],
  _config: { ...baseCfg },
};

assert(
  resolveRegenMode(baseCfg, baseBlock, {
    prefetchReady: true,
    prefetchConfigKey: buildBlockConfigKey(baseCfg),
  }) === "consume_prefetch",
  "same config + ready → consume_prefetch",
);

assert(
  resolveRegenMode({ ...baseCfg, n_test: 3 }, baseBlock, {
    prefetchReady: false,
    prefetchConfigKey: buildBlockConfigKey(baseCfg),
    baseCfg,
  }) === "questions_only",
  "counts only + explanation → questions_only",
);

assert(
  resolveRegenMode({ ...baseCfg, explanation_profile: "brief_deep" }, baseBlock, { baseCfg }) ===
    "full_block",
  "profile change → full_block",
);

assert(
  resolveRegenMode({ ...baseCfg, gap_focus: ["New gap"] }, baseBlock, { baseCfg }) === "full_block",
  "gap_focus change → full_block",
);

assert(
  resolveRegenMode(baseCfg, { ...baseBlock, explanation: "" }) === "full_block",
  "empty explanation → full_block",
);
assert(resolveRegenMode(baseCfg, null) === "full_block", "no block → full_block");

assert(
  resolveRegenMode({ ...baseCfg, n_socratic: 2 }, baseBlock, { baseCfg }) === "questions_only",
  "socratic count only → questions_only",
);

console.log(`\nT02 transition regen mode: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
