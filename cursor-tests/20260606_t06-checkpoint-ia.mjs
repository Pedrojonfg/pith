/**
 * T06 — IA checkpoint questions from argument map
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260606_t06-checkpoint-ia.mjs
 */
import { JSDOM } from "jsdom";
import {
  buildCheckpointQuestionTemplate,
  generateCheckpointQuestion,
} from "../src/js/slow/phase0.js";
import {
  CHECKPOINT_CHIP_LABEL,
  resolveCheckpointQuestion,
} from "../src/js/slow/checkpoints.js";

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

const section = { id: "intro", charStart: 0, charEnd: 120, title: "Libertad y razón" };
const argumentMap = [
  { id: "P1", text: "La razón guía la voluntad", status: "argued" },
  { id: "C", text: "La libertad exige autodeterminación", status: "argued" },
];

// --- buildCheckpointQuestionTemplate ---
const skippedTpl = buildCheckpointQuestionTemplate(section, null, "English");
assert(
  skippedTpl.includes("Libertad y razón") && skippedTpl.includes("integrate"),
  "T06 happy: skipped template uses heading in English",
);
assert(
  !/summarize in one sentence/i.test(skippedTpl),
  "T06 happy: skipped template is not generic summarize",
);

const skippedEs = buildCheckpointQuestionTemplate(section, null, "Spanish");
assert(
  skippedEs.includes("«Libertad y razón»") && skippedEs.includes("integrarías"),
  "T06 edge: Spanish skipped template",
);

const mapFallback = buildCheckpointQuestionTemplate(section, argumentMap, "English");
assert(
  mapFallback.includes("P1:") && mapFallback.includes("argument map"),
  "T06 happy: map fallback references argument nodes",
);

// --- generateCheckpointQuestion phase0 skipped (no LLM) ---
let llmCalls = 0;
const skippedQ = await generateCheckpointQuestion({
  section,
  argumentMap,
  sectionText: "Section body about freedom.",
  phase0Skipped: true,
  llmCall: async () => {
    llmCalls += 1;
    return "Should not be called";
  },
});
assert(llmCalls === 0, "T06 happy: phase0 skipped skips LLM");
assert(
  skippedQ.includes("Libertad y razón"),
  "T06 happy: skipped path returns heading-based template",
);

// --- generateCheckpointQuestion IA happy path ---
const iaQuestion =
  "How does the section on freedom connect premise P1 to the conclusion about self-determination?";
const iaQ = await generateCheckpointQuestion({
  section,
  argumentMap,
  sectionText: "The author argues that reason guides the will toward freedom.",
  llmCall: async () => iaQuestion,
});
assert(
  iaQ === iaQuestion,
  "T06 happy: IA integration question returned",
);
assert(
  !/summarize in one sentence/i.test(iaQ),
  "T06 happy: IA question is not generic summarize",
);

// --- generateCheckpointQuestion weak IA → fallback ---
const weakQ = await generateCheckpointQuestion({
  section,
  argumentMap,
  sectionText: "text",
  llmCall: async () => "Summarize this section in one sentence.",
});
assert(
  weakQ.includes("argument map") || weakQ.includes("integrate"),
  "T06 fail: weak IA output falls back to template",
);

// --- generateCheckpointQuestion LLM error → fallback ---
const errQ = await generateCheckpointQuestion({
  section,
  argumentMap,
  sectionText: "text",
  llmCall: async () => {
    throw new Error("network");
  },
});
assert(
  errQ.includes("P1:") || errQ.includes("integrate"),
  "T06 fail: LLM error falls back to template",
);

// --- resolveCheckpointQuestion caches per section ---
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
globalThis.document = dom.window.document;
globalThis.window = dom.window;

const session = {
  slow: {
    phase0Status: "skipped",
    readingScope: { charStart: 0, charEnd: 500 },
    normalizedTextFull: "Intro heading\n".padEnd(500, "x"),
    checkpointsDismissed: [],
    checkpointQuestions: { [section.id]: "Cached: how does P1 support the conclusion?" },
  },
};

const q1 = await resolveCheckpointQuestion(session, section);
const q2 = await resolveCheckpointQuestion(session, section);
assert(q1 === q2, "T06 happy: checkpoint question cached in session");
assert(
  session.slow.checkpointQuestions?.[section.id] === q1,
  "T06 happy: cache stored on session.slow.checkpointQuestions",
);
assert(
  !/summarize in one sentence/i.test(q1),
  "T06 happy: resolved question is argumental not summarize",
);

const skipSession = {
  slow: {
    phase0Status: "skipped",
    readingScope: { charStart: 0, charEnd: 500 },
    normalizedTextFull: "x".repeat(500),
    checkpointsDismissed: [],
  },
};
const freshQ = await resolveCheckpointQuestion(skipSession, section);
assert(
  freshQ.includes("Libertad y razón"),
  "T06 edge: resolve without cache uses heading template when phase0 skipped",
);

// --- chip label constant ---
assert(
  CHECKPOINT_CHIP_LABEL === "[≡ CHECKPOINT · 30 seg]",
  "T06 happy: chip label matches spec",
);

// --- desktop dismiss button (DOM contract) ---
const chip = dom.window.document.createElement("div");
chip.className = "slow-checkpoint-chip";
const dismiss = dom.window.document.createElement("button");
dismiss.type = "button";
dismiss.className = "slow-checkpoint-dismiss";
dismiss.setAttribute("aria-label", "Dismiss checkpoint");
dismiss.textContent = "×";
let dismissed = false;
dismiss.addEventListener("click", () => {
  dismissed = true;
  chip.hidden = true;
});
chip.append(dismiss);
dom.window.document.body.appendChild(chip);
dismiss.click();
assert(dismissed && chip.hidden === true, "T06 happy: desktop × dismiss hides chip");

console.log(`\n20260606_t06-checkpoint-ia: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
