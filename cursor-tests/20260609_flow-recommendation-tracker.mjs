/**
 * T04 — recommendation/tracker.js
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260609_flow-recommendation-tracker.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import { computeModeRecommendation } from "../src/js/recommendation/recommender.js";
import {
  markStepCompleted,
  recordUserOverride,
  updateFlowProgress,
} from "../src/js/recommendation/tracker.js";
import { analyzeText } from "../src/js/recommendation/analyzer.js";
import { createSession, saveActiveSession, updateRecommendation } from "../src/js/session-store.js";

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

const PHILOSOPHICAL = `
La cuestión ontológica del ser plantea un problema fundamental. Por tanto, la coherencia
de un sistema filosófico depende de su capacidad explicativa y de su resistencia ante
la refutación empírica y conceptual. La genealogía de los conceptos revela contingencias
históricas que muchas veces se presentan como necesidades lógicas. En consecuencia, el
filósofo debe interrogar los presupuestos de su propio discurso sin caer en escepticismo.
`.repeat(8).trim();

function makePhilosophicalRecommendation() {
  const metrics = analyzeText(PHILOSOPHICAL);
  return computeModeRecommendation(metrics, {
    genre: "philosophical",
    argumentativeDensity: 5,
    conceptualLoad: 4,
    primaryLearningGoal: "understand_argument",
    genreReasoning: "Texto filosófico denso",
  });
}

function baseSession(overrides = {}) {
  return {
    docId: "tracker-test-doc",
    schemaVersion: 2,
    createdAt: 1,
    updatedAt: 1,
    shared: {
      rawMarkdown: "# Test",
      docMeta: { titleInferred: "Test", charCount: 10, language: "es", estimatedGenre: "unknown" },
      docHierarchy: null,
      conceptInventory: [],
      annotations: [],
      smItems: [],
      modeRecommendation: null,
    },
    modes: { rsvp: null, slow: null, cloze: null, questions: null },
    ...overrides,
  };
}

function testSlowPhase3CompletesFirstStep() {
  const rec = makePhilosophicalRecommendation();
  const session = baseSession({
    modes: {
      rsvp: null,
      slow: { phase: 3, graphEnrichedUnlocked: true },
      cloze: null,
      questions: null,
    },
  });

  const updated = updateFlowProgress(rec, session);
  assert(updated.completedSteps.includes("step_slow_1"), "slow phase3: step_slow_1 completed");
  assert(updated.currentStepIndex === 1, "slow phase3: currentStepIndex 1");
  assert(updated.primaryFlow[0].completedAt != null, "slow phase3: completedAt set");
}

function testSlowNestedSlice() {
  const rec = makePhilosophicalRecommendation();
  const session = baseSession({
    modes: {
      rsvp: null,
      slow: {
        studyMode: "slow",
        slow: { phase: "phase3", graphEnrichedUnlocked: true },
      },
      cloze: null,
      questions: null,
    },
  });

  const updated = updateFlowProgress(rec, session);
  assert(updated.completedSteps.includes("step_slow_1"), "nested slow: step_slow_1 completed");
  assert(updated.currentStepIndex === 1, "nested slow: currentStepIndex 1");
}

function testSlowIncompleteWithoutGraphUnlock() {
  const rec = makePhilosophicalRecommendation();
  const session = baseSession({
    modes: {
      rsvp: null,
      slow: { phase: 3, graphEnrichedUnlocked: false },
      cloze: null,
      questions: null,
    },
  });

  const updated = updateFlowProgress(rec, session);
  assert(updated.completedSteps.length === 0, "slow without unlock: no completed steps");
  assert(updated.currentStepIndex === 0, "slow without unlock: stays at 0");
}

function testImmutability() {
  const rec = makePhilosophicalRecommendation();
  const session = baseSession({
    modes: {
      rsvp: null,
      slow: { phase: 3, graphEnrichedUnlocked: true },
      cloze: null,
      questions: null,
    },
  });

  const recBefore = JSON.stringify(rec);
  const sessionBefore = JSON.stringify(session);
  updateFlowProgress(rec, session);
  assert(JSON.stringify(rec) === recBefore, "immutability: recommendation unchanged");
  assert(JSON.stringify(session) === sessionBefore, "immutability: session unchanged");
}

function testRecordUserOverride() {
  const rec = makePhilosophicalRecommendation();
  const overridden = recordUserOverride(rec, "rsvp");

  assert(overridden.userOverride === true, "override: userOverride true");
  assert(overridden.currentStepIndex === -1, "override: currentStepIndex -1");
  assert(overridden.primaryFlow.length === rec.primaryFlow.length, "override: primaryFlow preserved");
  assert(rec.userOverride === false, "override: original recommendation untouched");
}

function testMarkStepCompleted() {
  const rec = makePhilosophicalRecommendation();
  const marked = markStepCompleted(rec, "step_cloze_1");

  assert(marked.completedSteps.includes("step_cloze_1"), "markStepCompleted: id in completedSteps");
  const clozeStep = marked.primaryFlow.find((s) => s.id === "step_cloze_1");
  assert(clozeStep?.completedAt != null, "markStepCompleted: completedAt set");
  assert(marked.currentStepIndex === 0, "markStepCompleted: slow still first incomplete");
}

function testOutOfOrderClozeCompletion() {
  const rec = makePhilosophicalRecommendation();
  const items = Array.from({ length: 10 }, (_, i) => ({
    id: `item_${i}`,
    times_correct: 1,
  }));
  const session = baseSession({
    modes: {
      rsvp: null,
      slow: null,
      cloze: { studyMode: "cloze", cloze: { items } },
      questions: null,
    },
  });

  const updated = updateFlowProgress(rec, session);
  assert(updated.completedSteps.includes("step_cloze_1"), "out-of-order: cloze marked complete");
  assert(!updated.completedSteps.includes("step_slow_1"), "out-of-order: slow not complete");
  assert(updated.currentStepIndex === 0, "out-of-order: still points to slow");
}

function testClozeStudyProgressField() {
  const rec = makePhilosophicalRecommendation();
  const session = baseSession({
    modes: {
      rsvp: null,
      slow: null,
      cloze: { studyProgress: 0.85 },
      questions: null,
    },
  });

  const updated = updateFlowProgress(rec, session);
  assert(updated.completedSteps.includes("step_cloze_1"), "cloze studyProgress: step completed");
}

function testQuestionsModeOneAnswerPerBlock() {
  const rec = computeModeRecommendation(analyzeText("word ".repeat(500)), {
    genre: "lecture_notes",
    argumentativeDensity: 2,
    conceptualLoad: 2,
    primaryLearningGoal: "memorize_facts",
    genreReasoning: "Apuntes",
  });

  const session = baseSession({
    modes: {
      rsvp: null,
      slow: null,
      cloze: null,
      questions: {
        studyMode: "questions",
        n_blocks: 2,
        blocks: [{ questions: [{ type: "test" }] }, { questions: [{ type: "test" }] }],
        _responses: {
          blocks: {
            "0": { questions: { "0": { user_answer: "a" } } },
            "1": { questions: { "0": { user_answer: "b" } } },
          },
        },
      },
    },
  });

  const updated = updateFlowProgress(rec, session);
  const qStep = rec.primaryFlow.find((s) => s.mode === "questions");
  assert(qStep, "questions fixture: questions step exists");
  assert(updated.completedSteps.includes(qStep.id), "questions: step completed");
}

async function testReviewCompleteWhenNoSmDue() {
  resetStorage();
  const rec = makePhilosophicalRecommendation();
  const session = await createSession("# Review test\n\nTherefore argument.");
  const future = Date.now() + 7 * 24 * 60 * 60 * 1000;
  session.shared.smItems = [
    {
      id: "cloze:item_1",
      sourceMode: "cloze",
      question: "Q",
      answer: "A",
      easeFactor: 2.5,
      interval: 7,
      nextReview: future,
      reviewCount: 1,
    },
  ];
  session.modes = {
    rsvp: null,
    slow: { phase: 3, graphEnrichedUnlocked: true },
    cloze: null,
    questions: null,
  };
  saveActiveSession(session);
  updateRecommendation(session.docId, rec);

  const updated = updateFlowProgress(rec, { ...session, docId: session.docId });
  assert(updated.completedSteps.includes("step_slow_1"), "review path: slow done");
  assert(updated.completedSteps.includes("step_review_1"), "review: no SM due marks review complete");
}

testSlowPhase3CompletesFirstStep();
testSlowNestedSlice();
testSlowIncompleteWithoutGraphUnlock();
testImmutability();
testRecordUserOverride();
testMarkStepCompleted();
testOutOfOrderClozeCompletion();
testClozeStudyProgressField();
testQuestionsModeOneAnswerPerBlock();
await testReviewCompleteWhenNoSmDue();

console.log(`\n20260609_flow-recommendation-tracker: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
