/**
 * T09 — Typed retrieval + inverse devil's advocate (Module B)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260606_t09-retrieval-devils.mjs
 */
import {
  buildDevilsAdvocateQuestionLocal,
  buildRetrievalQuestionLocal,
  generateDevilsAdvocateQuestions,
  generateRetrievalByType,
  renderPhase3ModuleB,
} from "../src/js/slow/phase3.js";

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

const mixedAnns = [
  { id: "p1", type: "≈", userText: "libertad como autodeterminación", charStart: 10, charEnd: 40 },
  { id: "p2", type: "⊘", userText: "premisa sin evidencia empírica", charStart: 50, charEnd: 90 },
  { id: "p3", type: "↯", userText: "salto de A a B sin puente", charStart: 100, charEnd: 140 },
];

// --- buildRetrievalQuestionLocal: 3 types → 3 distinct spec §7 questions ---
const qApprox = buildRetrievalQuestionLocal(mixedAnns[0], "Spanish");
const qBlock = buildRetrievalQuestionLocal(mixedAnns[1], "Spanish");
const qGap = buildRetrievalQuestionLocal(mixedAnns[2], "Spanish");

assert(qApprox.includes("sin usar las palabras del texto"), "T09 happy: ≈ asks explain without text words");
assert(qBlock.includes("respondería el autor"), "T09 happy: ⊘ asks author reply to objection");
assert(qGap.includes("premisa implícita"), "T09 happy: ↯ asks implicit premise");
assert(qApprox !== qBlock && qBlock !== qGap && qApprox !== qGap, "T09 happy: 3 types → 3 distinct questions");

const userQ = buildRetrievalQuestionLocal(
  { id: "q", type: "?", userText: "¿Por qué el autor distingue libertad negativa?" },
  "Spanish",
);
assert(
  userQ === "¿Por qué el autor distingue libertad negativa?",
  "T09 edge: ? type uses user question verbatim",
);

const emptyQ = buildRetrievalQuestionLocal({ id: "e", type: "≈", userText: "   " }, "English");
assert(emptyQ.includes("without using"), "T09 edge: empty note still yields typed template");

// --- generateRetrievalByType: local fallback without LLM ---
const session = { llmModel: "test-model", slow: { criticalMode: true } };
let llmCalls = 0;
const localShells = await generateRetrievalByType(session, mixedAnns, {
  llmCall: async () => {
    llmCalls += 1;
    throw new Error("LLM unavailable");
  },
});
assert(localShells.length === 3, "T09 happy: one shell per annotation");
assert(localShells.every((s) => s.question && s.kind === "retrieval"), "T09 happy: shells carry question + kind");
assert(llmCalls === 1, "T09 fail: attempted IA once then fell back");

// --- generateRetrievalByType: IA merge ---
const iaShells = await generateRetrievalByType(session, mixedAnns.slice(0, 2), {
  llmCall: async () =>
    JSON.stringify([
      { annotationId: "p1", question: "IA: parafrasea libertad sin copiar." },
      { annotationId: "p2", question: "IA: defiende la premisa del autor." },
    ]),
});
assert(iaShells[0].question.startsWith("IA:"), "T09 happy: IA question merged for ≈");
assert(iaShells[1].question.startsWith("IA:"), "T09 happy: IA question merged for ⊘");

// --- buildDevilsAdvocateQuestionLocal ---
const devilBlock = buildDevilsAdvocateQuestionLocal(mixedAnns[1], "Spanish");
assert(
  devilBlock.includes("mejor defensa") && devilBlock.includes("autor"),
  "T09 happy: ⊘ devil's advocate asks author defense first",
);
const devilGap = buildDevilsAdvocateQuestionLocal(mixedAnns[2], "English");
assert(devilGap.includes("inference gap"), "T09 edge: ↯ devil's advocate in English");

// --- generateDevilsAdvocateQuestions ---
const criticalAnns = mixedAnns.filter((a) => ["⊘", "↯", "⚠"].includes(a.type));
const devils = await generateDevilsAdvocateQuestions(
  { ...session, slow: { ...session.slow, criticalMode: true } },
  criticalAnns,
  {
    llmCall: async () =>
      JSON.stringify([
        { annotationId: "p2", question: "IA socratic: ¿cómo defendería el autor la premisa?" },
        { annotationId: "p3", question: "IA socratic: ¿qué puente ofrecería el autor?" },
      ]),
  },
);
assert(devils.length === 2, "T09 happy: one devil question per critical annotation");
assert(devils[0].kind === "devils-advocate", "T09 happy: devil shell kind tagged");

const noCritical = await generateDevilsAdvocateQuestions(session, mixedAnns.slice(0, 1), {
  llmCall: async () => "[]",
});
assert(noCritical.length === 0, "T09 fail: non-critical types produce no devil questions");

// --- renderPhase3ModuleB: critical mode shows devil section ---
const htmlCritical = renderPhase3ModuleB(localShells, "Spanish", { devilsAdvocate: devils });
assert(htmlCritical.includes("Abogado del diablo inverso"), "T09 happy: critical UI shows devil heading");
assert(htmlCritical.includes("is-devils-advocate"), "T09 happy: devil items styled");

const htmlNormal = renderPhase3ModuleB(localShells, "Spanish", { devilsAdvocate: [] });
assert(!htmlNormal.includes("Abogado del diablo inverso"), "T09 edge: normal mode omits devil block");

console.log(`\nT09 retrieval-devils: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
