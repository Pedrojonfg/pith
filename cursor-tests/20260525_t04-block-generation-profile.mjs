/**
 * T04 — deepSeekGenerateBlockJson pedagogical profiles (prompts + wiring)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260525_t04-block-generation-profile.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  buildBlockGenerationSystemPrompt,
  buildBlockGenerationUserContent,
} from "../src/js/api.js";
import {
  generateBlockForIndex,
  resolveBlockQuestionConfig,
  state,
  warnBlockGenerationProfileMismatch,
  countExplanationWords,
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

// --- prompt: thorough vs brief_deep ---
const thorough = buildBlockGenerationSystemPrompt({
  language: "English",
  n_test: 2,
  n_socratic: 1,
  explanation_profile: "thorough",
  gap_focus: [],
});
const brief = buildBlockGenerationSystemPrompt({
  language: "English",
  n_test: 1,
  n_socratic: 0,
  explanation_profile: "brief_deep",
  gap_focus: [],
});
assert(thorough.includes("Option parity"), "test questions include option parity rules");
assert(thorough.includes("400-600 words"), "thorough asks 400-600 words");
assert(!thorough.includes("150-220"), "thorough omits brief word band");
assert(brief.includes("150-220 words"), "brief_deep asks 150-220 words");
assert(brief.includes("Do NOT re-teach the full block linearly"), "brief_deep no linear re-teach");
assert(!brief.includes("400-600"), "brief_deep omits thorough band");

// --- prompt: gap_focus ---
const withGaps = buildBlockGenerationSystemPrompt({
  language: "English",
  n_test: 2,
  n_socratic: 1,
  explanation_profile: "thorough",
  gap_focus: ["Flux confusion", "Boundary conditions"],
});
assert(withGaps.includes("at least 2 gap-targeted question"), "gap_focus requires ≥1 per gap in system");
assert(withGaps.includes("prioritize gaps in the numbered order"), "gap budget prioritization hint");

const userGaps = buildBlockGenerationUserContent({
  blocksListText: "1. Block A",
  materialText: "chunk",
  blockIndex: 0,
  blockTitle: "Block A",
  gap_focus: ["Gap A", "Gap B"],
});
assert(userGaps.includes("1. Gap A") && userGaps.includes("2. Gap B"), "user lists numbered gaps");
assert(userGaps.includes("≥1 question per gap"), "user gap instruction");

// --- resolveBlockQuestionConfig → generateBlockForIndex request shape ---
resetStorage();
state.activeSession = {
  blocks_list_text: "1. Strong\n2. Weak",
  blocks: [
    { _config: { explanation_profile: "brief_deep", n_test: 1, n_socratic: 0, gap_focus: [] } },
    {
      _config: {
        explanation_profile: "thorough",
        n_test: 2,
        n_socratic: 1,
        gap_focus: ["Laguna X", "Laguna Y"],
      },
    },
  ],
};
const strongCfg = resolveBlockQuestionConfig(0);
const weakCfg = resolveBlockQuestionConfig(1);
assert(strongCfg.explanation_profile === "brief_deep", "strong block brief_deep");
assert(weakCfg.gap_focus.length === 2, "weak block two gaps");

// --- warnBlockGenerationProfileMismatch ---
let warned = 0;
const origWarn = console.warn;
console.warn = () => {
  warned += 1;
};
warnBlockGenerationProfileMismatch(
  { explanation: "one two three", questions: [{ type: "test" }] },
  { explanation_profile: "brief_deep", gap_focus: [] },
);
warnBlockGenerationProfileMismatch(
  { explanation: "x ".repeat(130), questions: [{ type: "test" }] },
  { explanation_profile: "brief_deep", gap_focus: ["G1", "G2"] },
);
console.warn = origWarn;
assert(warned >= 2, "dev warnings for short brief_deep and gap/question mismatch");
assert(countExplanationWords("  alpha   beta  ") === 2, "word count helper");

// --- generateBlockForIndex passes profile (fetch stub) ---
let capturedBody = null;
globalThis.fetch = async (_url, init) => {
  capturedBody = JSON.parse(init.body);
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              id: 1,
              title: "Strong",
              explanation: "word ".repeat(180),
              questions: [{ type: "test", question: "Q?", options: { A: "a", B: "b", C: "c", D: "d" }, answer: "A" }],
              concepts: [],
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
  JSON.stringify([{ id: 1, title: "Strong", chunk: "chunk text for block" }]),
);

await generateBlockForIndex(0);
const system = capturedBody?.messages?.[0]?.content || "";
const user = capturedBody?.messages?.[1]?.content || "";
assert(system.includes("150-220"), "live call uses brief_deep system prompt for strong");
assert(!system.includes("400-600"), "live call omits thorough band for strong");

resetStorage();
state.activeSession = {
  blocks_list_text: "1. Weak",
  blocks: [
    {
      _config: {
        explanation_profile: "thorough",
        n_test: 2,
        n_socratic: 0,
        gap_focus: ["Gap one", "Gap two"],
      },
    },
  ],
};
globalThis.localStorage.setItem("ds_api_key", "test-key");
localStorage.setItem(
  "block_index",
  JSON.stringify([{ id: 1, title: "Weak", chunk: "weak chunk text" }]),
);
await generateBlockForIndex(0);
const system2 = capturedBody?.messages?.[0]?.content || "";
const user2 = capturedBody?.messages?.[1]?.content || "";
assert(system2.includes("400-600"), "weak uses thorough");
assert(system2.includes("2 gap-targeted"), "weak system mentions gap count");
assert(user2.includes("1. Gap one") && user2.includes("2. Gap two"), "weak user lists gaps");

console.log(`\nT04 block-generation-profile: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
