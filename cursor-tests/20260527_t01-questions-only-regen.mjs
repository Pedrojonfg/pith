/**
 * T07 / T01 — Questions-only regen: API prompts + merge preserves explanation
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260527_t01-questions-only-regen.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  buildQuestionsOnlySystemPrompt,
  buildQuestionsOnlyUserContent,
} from "../src/js/api.js";
import { generateQuestionsOnlyForIndex, state, storeActiveSession } from "../src/js/session.js";

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

const sys = buildQuestionsOnlySystemPrompt({
  language: "English",
  n_test: 2,
  n_socratic: 1,
  gap_focus: ["Gap A"],
  blockTitle: "Intro",
});

assert(sys.includes("Generate exactly 2 test"), "system prompt requests n_test");
assert(sys.includes("1 socratic"), "system prompt requests n_socratic");
assert(sys.toLowerCase().includes("do not modify"), "system forbids rewriting explanation");
assert(sys.includes('MUST NOT include "explanation"'), "system forbids explanation field in JSON");
assert(sys.includes("MC_OPTION_PARITY") === false, "parity rules inlined not by name");
assert(sys.includes("Option parity"), "includes MC parity rules text");

const user = buildQuestionsOnlyUserContent({
  blockTitle: "Block 2",
  explanation: "## Fixed text\n\nCore idea.",
  materialText: "chunk",
  gap_focus: ["Gap A"],
});
assert(user.includes("do not rewrite"), "user content says do not rewrite");
assert(user.includes("## Fixed text"), "user includes fixed explanation");
assert(user.includes("Gap A"), "user includes gaps");

const baseBlock = {
  id: 2,
  title: "Block 2",
  explanation: "Fixed RSVP explanation text.",
  questions: [{ type: "test", question: "old?" }],
  _config: { n_test: 2, n_socratic: 1, explanation_profile: "thorough", gap_focus: [] },
};

resetStorage();
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            questions: [
              {
                type: "test",
                question: "Q1?",
                options: { A: "a", B: "b", C: "c", D: "d" },
                answer: "A",
                feedback: "f",
              },
              {
                type: "test",
                question: "Q2?",
                options: { A: "a", B: "b", C: "c", D: "d" },
                answer: "B",
                feedback: "f",
              },
              { type: "socratic", question: "Why?" },
            ],
          }),
        },
      },
    ],
  }),
});
localStorage.setItem("ds_api_key", "test-key");
localStorage.setItem(
  "block_index",
  JSON.stringify([{ id: 1, title: "B1" }, { id: 2, title: "Block 2", chunk: "material chunk" }]),
);
const session = {
  blocks_list_text: "1. B1\n2. Block 2",
  blocks: [{}, {}],
};
storeActiveSession(session);
state.activeSession = session;

const merged = await generateQuestionsOnlyForIndex(1, {
  n_test: 2,
  n_socratic: 1,
  baseBlock,
});
assert(merged.explanation === baseBlock.explanation, "merge keeps explanation");
assert(merged.questions.length === 3, "merge gets new questions length");
assert(merged.title === baseBlock.title, "merge keeps title");

console.log(`\nT01 questions-only regen: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
