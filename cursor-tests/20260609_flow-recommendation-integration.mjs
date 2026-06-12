/**
 * T08 — flow recommendation end-to-end integration
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260609_flow-recommendation-integration.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  createSession,
  getSession,
  setActiveSession,
  updateRecommendation,
} from "../src/js/session-store.js";
import { analyzeText } from "../src/js/recommendation/analyzer.js";
import { computeModeRecommendation, TIME_FACTORS } from "../src/js/recommendation/recommender.js";
import {
  buildDeterministicPedagogicalMeta,
  buildDocumentHierarchy,
} from "../src/js/normalization/hierarchy.js";
import {
  recordUserOverride,
  updateFlowProgress,
} from "../src/js/recommendation/tracker.js";

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

function getRecommendationPanelState(recommendation) {
  if (!recommendation || typeof recommendation !== "object") return "hidden";
  if (recommendation.userOverride) return "hidden";
  const completed = Array.isArray(recommendation.completedSteps)
    ? recommendation.completedSteps
    : [];
  if (completed.length > 0) return "progress";
  if (recommendation.currentStepIndex === 0 && completed.length === 0) return "intro";
  return "hidden";
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

const PHILOSOPHICAL_PARAGRAPH = `
The ontological question of being and nothingness raises a fundamental problem for
contemporary hermeneutics. From a phenomenological perspective, intentionality of
consciousness cannot be reduced to merely empirical analysis without losing its
transcendental dimension. The dialectical argument treats intersubjectivity as a
condition for knowledge. Therefore, the coherence of a philosophical system depends
on its explanatory power and its resistance to refutation.
`.trim();

function buildPhilosophicalText(targetWords = 2000) {
  const unit = PHILOSOPHICAL_PARAGRAPH + " ";
  let text = "";
  while (analyzeText(text).wordCount < targetWords) {
    text += unit;
  }
  return text.trim();
}

// --- Upload → recommendation populated ---
resetStorage();

const uploadText = buildPhilosophicalText(2500);
const doc = await createSession(uploadText);
setActiveSession(doc.docId);

assert(doc.shared.modeRecommendation === null, "upload: fresh session has null recommendation");

computeAndPersistModeRecommendation(doc, uploadText, null);

const rec = doc.shared.modeRecommendation;
assert(rec && Array.isArray(rec.primaryFlow) && rec.primaryFlow.length > 0, "upload: modeRecommendation populated");
assert(rec.primaryFlow[0].mode === "slow", "upload: philosophical flow starts with slow");
assert(typeof rec.reasoning === "string" && rec.reasoning.length > 0, "upload: reasoning present");
assert(rec.method === "deterministic", "upload: deterministic method without LLM hierarchy");

const persisted = getSession(doc.docId);
assert(
  persisted.shared.modeRecommendation?.computedAt === rec.computedAt,
  "upload: recommendation persisted to session-store",
);

// --- Existing session: no recompute ---
const firstComputedAt = rec.computedAt;
const firstFlowId = rec.primaryFlow[0].id;
computeAndPersistModeRecommendation(doc, uploadText, null);
assert(
  doc.shared.modeRecommendation.computedAt === firstComputedAt,
  "existing session: does not recompute flow",
);
assert(
  doc.shared.modeRecommendation.primaryFlow[0].id === firstFlowId,
  "existing session: primaryFlow unchanged",
);

// --- Override flow (userOverride true) ---
const recommendedMode = getRecommendedStep(doc.shared.modeRecommendation)?.mode;
assert(recommendedMode === "slow", "override: recommended step is slow");

applyFlowRecommendationOnEnterMode("rsvp", doc);
const overridden = getSession(doc.docId);
assert(overridden.shared.modeRecommendation.userOverride === true, "override: userOverride true");
assert(overridden.shared.modeRecommendation.currentStepIndex === -1, "override: currentStepIndex -1");
assert(
  getRecommendationPanelState(overridden.shared.modeRecommendation) === "hidden",
  "override: panel hidden after userOverride",
);

// --- ~83 min for 10k words slow philosophical flow ---
const text10k = buildPhilosophicalText(10000);
const metrics10k = analyzeText(text10k);
assert(metrics10k.wordCount >= 9800, `10k fixture: wordCount >= 9800 (got ${metrics10k.wordCount})`);

const doc10k = await createSession(text10k);
setActiveSession(doc10k.docId);
computeAndPersistModeRecommendation(doc10k, text10k, null);

const slowStep = doc10k.shared.modeRecommendation.primaryFlow.find((s) => s.mode === "slow");
const expectedSlowMin = TIME_FACTORS.slow(metrics10k.wordCount);
assert(slowStep, "10k: slow step present in primary flow");
assert(
  slowStep.estimatedTimeMin === expectedSlowMin,
  `10k: slow step time matches TIME_FACTORS (${slowStep?.estimatedTimeMin} vs ${expectedSlowMin})`,
);
assert(
  slowStep.estimatedTimeMin >= 82 && slowStep.estimatedTimeMin <= 85,
  `10k: slow step ~83 min (got ${slowStep.estimatedTimeMin})`,
);
assert(
  doc10k.shared.modeRecommendation.primaryFlow.map((s) => s.mode).join(",") === "slow,cloze,review",
  "10k: full philosophical primary flow",
);

// --- Fallback without LLM ---
resetStorage();

const longNoHeadings = "Dense philosophical concept without headings. ".repeat(120).trim();
const hierarchyNoLlm = await buildDocumentHierarchy(longNoHeadings, null, { useCache: false });
assert(hierarchyNoLlm === null, "fallback: buildDocumentHierarchy returns null without llmFn");

const fallbackDoc = await createSession(longNoHeadings);
setActiveSession(fallbackDoc.docId);
computeAndPersistModeRecommendation(fallbackDoc, longNoHeadings, hierarchyNoLlm);

const fallbackRec = fallbackDoc.shared.modeRecommendation;
assert(fallbackRec, "fallback: recommendation still computed without LLM");
assert(fallbackRec.method === "deterministic", "fallback: method deterministic");
assert(fallbackRec.primaryFlow.length >= 1, "fallback: primaryFlow non-empty");
assert(
  typeof fallbackRec.analysis.genreLabel === "string" && fallbackRec.analysis.genreLabel.length > 0,
  "fallback: genreLabel present",
);

const hierarchyDeterministic = await buildDocumentHierarchy(
  "# Intro\n\n" + longNoHeadings.slice(0, 500),
  null,
  { useCache: false },
);
assert(hierarchyDeterministic?.method === "deterministic", "fallback: headings path works without LLM");
assert(hierarchyDeterministic?.pedagogicalMeta?.genre, "fallback: pedagogicalMeta from deterministic hierarchy");

const docWithHierarchy = await createSession(longNoHeadings);
setActiveSession(docWithHierarchy.docId);
computeAndPersistModeRecommendation(docWithHierarchy, longNoHeadings, hierarchyDeterministic);
assert(
  docWithHierarchy.shared.modeRecommendation?.method === "deterministic",
  "fallback: recommendation from deterministic hierarchy meta",
);

// --- Progress sync on reload (QA-7) ---
const progressDoc = await createSession(buildPhilosophicalText(1800));
setActiveSession(progressDoc.docId);
computeAndPersistModeRecommendation(progressDoc, progressDoc.shared.rawMarkdown, null);
const loaded = getSession(progressDoc.docId);
loaded.modes.slow = { phase: 3, graphEnrichedUnlocked: true };
setActiveSession(loaded.docId);
const updated = updateFlowProgress(loaded.shared.modeRecommendation, loaded);
loaded.shared.modeRecommendation = updated;
updateRecommendation(loaded.docId, updated);
const reloaded = getSession(loaded.docId);
assert(
  reloaded.shared.modeRecommendation.completedSteps.includes("step_slow_1"),
  "reload: progress preserved without recomputing flow",
);
assert(
  reloaded.shared.modeRecommendation.computedAt === progressDoc.shared.modeRecommendation.computedAt,
  "reload: computedAt unchanged after progress sync",
);

console.log(`\nT08 flow-recommendation integration: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
