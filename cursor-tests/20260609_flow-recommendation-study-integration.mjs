/**
 * T06 — study.js flow recommendation orchestration
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260609_flow-recommendation-study-integration.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resetStorage } from "./setup-dom.mjs";
import {
  createSession,
  getSession,
  setActiveSession,
  updateRecommendation,
} from "../src/js/session-store.js";
import { analyzeText } from "../src/js/recommendation/analyzer.js";
import { computeModeRecommendation } from "../src/js/recommendation/recommender.js";
import { buildDeterministicPedagogicalMeta } from "../src/js/normalization/hierarchy.js";
import {
  recordUserOverride,
  updateFlowProgress,
} from "../src/js/recommendation/tracker.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studySrc = readFileSync(join(__dirname, "../src/js/study.js"), "utf8");

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

function getRecommendedStep(recommendation) {
  if (!recommendation || typeof recommendation !== "object") return null;
  const flow = recommendation.primaryFlow;
  if (!Array.isArray(flow) || !flow.length) return null;
  const idx = recommendation.currentStepIndex;
  if (typeof idx !== "number" || idx < 0 || idx >= flow.length) return null;
  return flow[idx] ?? null;
}

function computeAndPersistModeRecommendation(doc, cleanedText, hierarchyResult = null) {
  if (!doc?.docId || doc.shared?.modeRecommendation) return;
  const textMetrics = analyzeText(String(cleanedText || ""));
  const pedagogicalMeta =
    hierarchyResult?.pedagogicalMeta ?? buildDeterministicPedagogicalMeta(textMetrics);
  const method = hierarchyResult?.method === "llm" ? "llm_meta" : "deterministic";
  const recommendation = computeModeRecommendation(textMetrics, pedagogicalMeta, { method });
  doc.shared.modeRecommendation = recommendation;
  updateRecommendation(doc.docId, recommendation);
}

function persistFlowRecommendationProgress(doc) {
  if (!doc?.shared?.modeRecommendation) return;
  const updated = updateFlowProgress(doc.shared.modeRecommendation, doc);
  doc.shared.modeRecommendation = updated;
  updateRecommendation(doc.docId, updated);
}

function applyFlowRecommendationOnEnterMode(chosenMode, doc) {
  if (!doc?.shared?.modeRecommendation) return;
  const slot = String(chosenMode || "").trim();
  const recommendedStep = getRecommendedStep(doc.shared.modeRecommendation);
  if (recommendedStep && slot !== String(recommendedStep.mode)) {
    const updated = recordUserOverride(doc.shared.modeRecommendation, slot);
    doc.shared.modeRecommendation = updated;
    updateRecommendation(doc.docId, updated);
  }
}

const PHILOSOPHICAL = `
La cuestión ontológica del ser plantea un problema fundamental. Por tanto, la coherencia
de un sistema filosófico depende de su capacidad explicativa. En consecuencia, el
filósofo debe interrogar los presupuestos sin caer en escepticismo.
`.repeat(12).trim();

// study.js wiring smoke checks
assert(studySrc.includes("computeAndPersistModeRecommendation"), "study.js exports compute helper");
assert(studySrc.includes("persistFlowRecommendationProgress"), "study.js defines progress sync");
assert(studySrc.includes("applyFlowRecommendationOnEnterMode"), "study.js defines enter hook");
assert(studySrc.includes('from "./recommendation/analyzer.js'), "study.js imports analyzer");
assert(studySrc.includes("updateRecommendation"), "study.js uses updateRecommendation");
assert(studySrc.includes("enterModeSelectScreen") && studySrc.includes("persistFlowRecommendationProgress()"), "study.js syncs on mode select");
assert(
  studySrc.includes("computeAndPersistModeRecommendation(doc, cleanedText"),
  "study.js computes after upload",
);

resetStorage();

const doc = await createSession(PHILOSOPHICAL);
setActiveSession(doc.docId);
computeAndPersistModeRecommendation(doc, PHILOSOPHICAL, null);
assert(doc.shared.modeRecommendation?.primaryFlow?.length > 0, "new doc: modeRecommendation populated");
assert(
  getSession(doc.docId).shared.modeRecommendation?.primaryFlow?.length > 0,
  "new doc: persisted via updateRecommendation",
);

const firstComputedAt = doc.shared.modeRecommendation.computedAt;
computeAndPersistModeRecommendation(doc, PHILOSOPHICAL, null);
assert(
  doc.shared.modeRecommendation.computedAt === firstComputedAt,
  "existing doc: does not recompute flow",
);

const metrics = analyzeText(PHILOSOPHICAL);
const rec = computeModeRecommendation(metrics, {
  genre: "philosophical",
  argumentativeDensity: 5,
  conceptualLoad: 4,
});
updateRecommendation(doc.docId, rec);
const loaded = getSession(doc.docId);
loaded.modes.slow = { phase: 3, graphEnrichedUnlocked: true };
setActiveSession(loaded.docId);
persistFlowRecommendationProgress(loaded);
const afterProgress = getSession(loaded.docId);
assert(
  afterProgress.shared.modeRecommendation.completedSteps.includes("step_slow_1"),
  "load/exit sync: slow phase3 marks step_slow_1 complete",
);

const freshDoc = await createSession("# Other\n\nShort text.");
const shortMetrics = analyzeText(freshDoc.shared.rawMarkdown);
const shortRec = computeModeRecommendation(shortMetrics, {
  genre: "essay",
  argumentativeDensity: 4,
  conceptualLoad: 2,
});
freshDoc.shared.modeRecommendation = shortRec;
updateRecommendation(freshDoc.docId, shortRec);
setActiveSession(freshDoc.docId);
const recommended = getRecommendedStep(shortRec)?.mode;
applyFlowRecommendationOnEnterMode("rsvp", freshDoc);
const overridden = getSession(freshDoc.docId);
assert(overridden.shared.modeRecommendation.userOverride === true, "enter mode: userOverride when mode differs");
assert(overridden.shared.modeRecommendation.currentStepIndex === -1, "enter mode: currentStepIndex -1 on override");

console.log(`\nT06 flow-recommendation study-integration: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
