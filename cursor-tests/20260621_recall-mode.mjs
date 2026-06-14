/**
 * Recall Mode — cursor tests
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260621_recall-mode.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resetStorage } from "./setup-dom.mjs";
import {
  computeInventoryHash,
  createEmptyRecallSlice,
  normalizeRecallSlice,
} from "../src/js/recall-slice.js";
import {
  deepSeekRecallTutor,
  normalizeRecallTutorFeedback,
  parseRecallTutorFeedbackFromModelResponse,
} from "../src/js/api.js";
import {
  parseRecallQuestionsFromModel,
  deriveRecallQuestionCount,
  recallTypesForGoal,
} from "../src/js/recall-api.js";
import { normalizeStudyMode } from "../src/js/session.js";
import {
  createSession,
  getSession,
  saveActiveSession,
  setActiveSession,
} from "../src/js/session-store.js";
import { buildRecallAssessmentSignals, computeAssessmentWeight } from "../src/js/assessment-signals.js";
import { RECALL_QUALITY_TO_SM2 } from "../src/js/sm2-ingest.js";
import { resolveModeEntryState } from "../src/js/mode-bootstrap.js";
import { shouldSuggestRecall } from "../src/js/recommendation/recommender.js";
import { validateDocumentSession } from "../src/js/session-types.js";
import { SW_VERSION } from "../src/js/sw-update.js";
import { resolveChromeVisibility } from "../src/js/ui.js?realui=1";

const __dirname = dirname(fileURLToPath(import.meta.url));
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

// --- T01 recall slice ---

assert(normalizeStudyMode("recall") === "recall", "normalizeStudyMode accepts recall");

const empty = createEmptyRecallSlice();
assert(empty.status === "not_started", "empty slice status not_started");
assert(Array.isArray(empty.questions) && empty.questions.length === 0, "empty questions array");
assert(empty.currentIndex === 0, "empty currentIndex 0");
assert(empty.config.scope === "full", "default scope full");
assert(empty.config.types.includes("synthesis"), "default types include synthesis");

const legacy = normalizeRecallSlice(null);
assert(legacy.status === "not_started", "null raw normalizes without throw");

const corrupt = normalizeRecallSlice({
  status: "bogus",
  questions: [{ question: "no type" }],
  currentIndex: 99,
});
assert(corrupt.status === "not_started", "invalid status falls back");
assert(corrupt.questions.length === 0, "invalid questions stripped");
assert(corrupt.currentIndex === 0, "currentIndex clamped when no questions");

const validQ = normalizeRecallSlice({
  status: "in_progress",
  currentIndex: 1,
  questions: [
    {
      id: "rq1",
      recall_type: "synthesis",
      question: "Explain the thesis.",
      concept_ids: ["c1"],
      source_chunks: ["The thesis is central."],
      student_answer: "It argues X.",
      tutor_feedback: {
        critique: "Good start.",
        suggested_answer: "Full answer.",
        quality: "adequate",
      },
    },
    { question: "bad" },
  ],
  config: { questionCount: 6, types: ["synthesis", "relational"] },
  _meta: { generatedAt: 1000, sourceInventoryHash: "abc123", usedAssessmentSignals: true },
});
assert(validQ.status === "in_progress", "valid status preserved");
assert(validQ.questions.length === 1, "only valid questions kept");
assert(validQ.questions[0].tutor_feedback.quality === "adequate", "tutor feedback normalized");
assert(validQ.currentIndex === 0, "currentIndex clamped to last question index");
assert(validQ.config.questionCount === 6, "config questionCount preserved");
assert(validQ._meta.sourceInventoryHash === "abc123", "meta hash preserved");

const invA = [{ canonicalId: "c1", label: "Alpha" }];
const invB = [...invA, { canonicalId: "c2", label: "Beta" }];
const metaA = { primaryLearningGoal: "understand_argument" };
const metaB = { primaryLearningGoal: "memorize_facts", argumentativeDensity: 3 };
const hash1 = computeInventoryHash(invA, metaA);
const hash2 = computeInventoryHash(invB, metaA);
const hash3 = computeInventoryHash(invA, metaB);
assert(hash1 !== hash2, "hash changes when inventory changes");
assert(hash1 !== hash3, "hash changes when pedagogical meta changes");
assert(computeInventoryHash(invA, metaA) === hash1, "hash is stable for same inputs");

resetStorage();
const doc = await createSession("# Recall test\n\nParagraph one.");
assert(doc.modes.recall === null, "new session has recall slot null");
const v = validateDocumentSession(doc);
assert(v.ok, `createSession validates with recall key: ${v.errors.join("; ")}`);

doc.modes.recall = normalizeRecallSlice({
  status: "ready",
  questions: [
    {
      id: "rq1",
      recall_type: "synthesis",
      question: "Summarize.",
      concept_ids: ["c1"],
      source_chunks: ["Paragraph one."],
    },
  ],
});
saveActiveSession(doc);
setActiveSession(doc.docId);
const loaded = getSession(doc.docId);
assert(loaded.modes.recall.status === "ready", "recall slice round-trips through store");
assert(loaded.modes.recall.questions.length === 1, "recall questions round-trip");

// --- T02 entry resolution ---

function docFixture(overrides = {}) {
  return {
    docId: "test-doc",
    schemaVersion: 2,
    createdAt: 1,
    updatedAt: 1,
    shared: {
      rawMarkdown: "# Title\n\nBody text.",
      docMeta: { titleInferred: "Title" },
      conceptInventory: [],
      annotations: [],
      smItems: [],
      assessmentSignals: [],
      docTopics: [],
      ...overrides.shared,
    },
    modes: {
      rsvp: null,
      slow: null,
      cloze: null,
      questions: null,
      recall: null,
      ...overrides.modes,
    },
  };
}

assert(resolveModeEntryState(null, "recall").kind === "upload_required", "recall: no doc → upload_required");

const noMaterial = docFixture({ shared: { rawMarkdown: "", docMeta: { titleInferred: "T" } } });
delete noMaterial.shared.rawMarkdownRef;
assert(resolveModeEntryState(noMaterial, "recall").kind === "upload_required", "recall: empty material → upload_required");

const fresh = docFixture();
assert(resolveModeEntryState(fresh, "recall").kind === "generate_fresh", "recall: material no inventory → generate_fresh");

const boot = docFixture({
  shared: { conceptInventory: [{ canonicalId: "c1", label: "Alpha" }] },
});
assert(resolveModeEntryState(boot, "recall").kind === "bootstrap", "recall: inventory → bootstrap");

const resumeDoc = docFixture({
  shared: { conceptInventory: [{ canonicalId: "c1", label: "Alpha" }] },
  modes: {
    recall: { status: "in_progress", questions: [], currentIndex: 0, config: {}, _meta: {} },
  },
});
assert(resolveModeEntryState(resumeDoc, "recall").kind === "resume", "recall: in_progress → resume");

assert(resolveModeEntryState(fresh, "rsvp").kind === "bootstrap", "regression: rsvp still bootstrap");

// --- T03 generation parser ---

const validIds = new Set(["c1", "c2"]);
const fixtureJson = JSON.stringify([
  {
    id: "rq1",
    recall_type: "synthesis",
    question: "Explain the main thesis.",
    concept_ids: ["c1", "c2"],
    source_chunks: ["The thesis argues X."],
  },
  {
    id: "rq2",
    recall_type: "relational",
    question: "How do c1 and c2 relate?",
    concept_ids: ["c1"],
    source_chunks: ["Relation excerpt."],
  },
]);
const parsed = parseRecallQuestionsFromModel(fixtureJson, validIds);
assert(parsed.length === 2, "parser accepts valid array");
assert(parsed[0].recall_type === "synthesis", "parser preserves synthesis type");

let parserFailed = false;
try {
  parseRecallQuestionsFromModel(
    JSON.stringify([{ recall_type: "relational", question: "Q?", concept_ids: ["c1"], source_chunks: ["x"] }]),
    validIds,
  );
} catch (err) {
  parserFailed = err?.message?.includes("synthesis");
}
assert(parserFailed, "parser rejects set without synthesis");

assert(deriveRecallQuestionCount(1000) === 4, "tiny doc → 4 questions");
assert(recallTypesForGoal("memorize_facts").includes("applicative"), "goal drives type mix");

// --- T04 tutor parser ---

const tutorFixture = {
  critique: "Good structure; you linked the thesis to supporting evidence.",
  suggested_answer: "The thesis argues X because Y, as shown in the source excerpt.",
  quality: "adequate",
};
const tutor = parseRecallTutorFeedbackFromModelResponse(tutorFixture);
assert(tutor.quality === "adequate", "tutor normalizes adequate quality");
assert(tutor.critique.includes("Good structure"), "tutor preserves critique");
assert(tutor.suggested_answer.includes("thesis"), "tutor preserves suggested_answer");

const fenced = parseRecallTutorFeedbackFromModelResponse(
  '```json\n{"critique":"OK.","suggested_answer":"Model.","quality":"strong"}\n```',
);
assert(fenced.quality === "strong", "parser handles fenced JSON");

const camelCase = parseRecallTutorFeedbackFromModelResponse({
  critique: "Partial grasp.",
  suggestedAnswer: "Complete answer.",
  quality: "partial",
});
assert(camelCase.suggested_answer === "Complete answer.", "parser accepts suggestedAnswer alias");

const tutorPartial = parseRecallTutorFeedbackFromModelResponse({
  critique: "Weak.",
  suggested_answer: "Better.",
  quality: "bogus",
});
assert(tutorPartial.quality === "partial", "unknown quality → partial");
const viaAlias = normalizeRecallTutorFeedback({ critique: "OK.", suggested_answer: "Model.", quality: "strong" });
assert(viaAlias.quality === "strong" && viaAlias.suggested_answer === "Model.", "normalizeRecallTutorFeedback alias works");

let tutorReject = false;
try {
  parseRecallTutorFeedbackFromModelResponse({ critique: "", suggested_answer: "" });
} catch {
  tutorReject = true;
}
assert(tutorReject, "empty tutor feedback rejected");

let badJson = false;
try {
  parseRecallTutorFeedbackFromModelResponse("not json");
} catch {
  badJson = true;
}
assert(badJson, "invalid JSON string rejected");

let emptyAnswerReject = false;
try {
  await deepSeekRecallTutor({
    question: "Explain the thesis.",
    recall_type: "synthesis",
    student_answer: "   ",
    concept_ids: ["c1"],
    concept_definitions: [{ term: "Thesis", definition: "Central claim." }],
    source_chunk: "The thesis is central.",
    lang: "English",
  });
} catch (err) {
  emptyAnswerReject = /student answer/i.test(String(err?.message || ""));
}
assert(emptyAnswerReject, "empty student_answer rejected before LLM call");

// --- T05 screenRecall UI contract ---

const indexHtml = readFileSync(join(__dirname, "../index.html"), "utf8");
const recallCss = readFileSync(join(__dirname, "../src/css/recall-mode.css"), "utf8");

assert(indexHtml.includes('id="screenRecall"'), "T05: screenRecall section exists");
assert(indexHtml.includes('id="recallAnswer"'), "T05: recallAnswer textarea exists");
assert(indexHtml.includes('id="recallProgress"'), "T05: recallProgress element exists");
assert(indexHtml.includes('id="recallFeedbackPanel"'), "T05: recallFeedbackPanel exists");
assert(indexHtml.includes('id="recallNextBtn"'), "T05: recallNextBtn exists");
assert(indexHtml.includes('value="recall"'), "T05: recall mode radio value exists");
assert(indexHtml.includes("recall-mode.css"), "T05: recall-mode.css linked");
assert(!indexHtml.includes('id="recallTimer"'), "T05: no timer element");
assert(recallCss.includes("recall-answer-textarea"), "T05: generous textarea styles");
assert(recallCss.includes("min-height: 200px"), "T05: textarea min-height generous");
assert(indexHtml.includes(`main.js?v=${SW_VERSION}`), "T05: index.html main.js version synced");

const recallChrome = resolveChromeVisibility({
  screenId: "recall",
  studyMode: "recall",
  blockReadWanted: false,
  hasConcepts: true,
  offline: false,
  assessmentActive: false,
});
assert(recallChrome.showGuideFab === true, "T05: guide FAB visible on recall screen when online");

// --- T07 downstream ---

assert(RECALL_QUALITY_TO_SM2.strong === 5, "RECALL_QUALITY_TO_SM2 strong");
assert(RECALL_QUALITY_TO_SM2.partial === 2, "RECALL_QUALITY_TO_SM2 partial");
assert(RECALL_QUALITY_TO_SM2.insufficient === 1, "RECALL_QUALITY_TO_SM2 insufficient");

const weakSignals = buildRecallAssessmentSignals({
  id: "rq1",
  concept_ids: ["c1"],
  tutor_feedback: { quality: "partial", critique: "x", suggested_answer: "y" },
});
assert(weakSignals.length === 1, "partial recall builds signal");
assert(weakSignals[0].sourceMode === "recall", "recall sourceMode");
assert(weakSignals[0].lastResult === "wrong", "partial → wrong");

const strongSignals = buildRecallAssessmentSignals({
  id: "rq2",
  concept_ids: ["c2"],
  tutor_feedback: { quality: "adequate", critique: "x", suggested_answer: "y" },
});
assert(strongSignals[0].lastResult === "correct", "adequate → correct");

// --- T08 recommender ---

assert(
  shouldSuggestRecall({ completedModes: ["slow"], pedagogicalMeta: {} }),
  "slow complete suggests recall",
);
assert(
  shouldSuggestRecall({ completedModes: ["rsvp"], pedagogicalMeta: { argumentativeDensity: 4 } }),
  "rsvp + high density suggests recall",
);

console.log(`\n20260621_recall-mode: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
