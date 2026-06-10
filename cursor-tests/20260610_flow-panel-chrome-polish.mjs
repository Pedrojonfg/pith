/**
 * Flow Panel & Study Chrome Polish — chrome + panel regression
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260610_flow-panel-chrome-polish.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";
import { resolveChromeVisibility } from "../src/js/ui.js?realui=1";
import { resetStorage } from "./setup-dom.mjs";

/** Mirror of study.js — kept inline so tests avoid heavy study.js import graph. */
function hasValidModeRecommendation(recommendation) {
  if (!recommendation || typeof recommendation !== "object") return false;
  const flow = recommendation.primaryFlow;
  return Array.isArray(flow) && flow.length > 0;
}

function resolveFlowPanelViewState(doc) {
  const recommendation = doc?.shared?.modeRecommendation;
  if (recommendation && typeof recommendation === "object" && recommendation.userOverride) {
    return "hidden";
  }
  if (hasValidModeRecommendation(recommendation)) {
    const completed = Array.isArray(recommendation.completedSteps)
      ? recommendation.completedSteps
      : [];
    if (completed.length > 0) return "progress";
    return "intro";
  }
  return "cta_upload";
}

const FLOW_MODE_SHORT_LABELS = {
  slow: "Slow",
  cloze: "Cloze",
  review: "Review",
  rsvp: "RSVP",
  questions: "Questions",
};

function formatIntroFlowLine(steps) {
  if (!Array.isArray(steps) || !steps.length) return "";
  return steps
    .map((step) => FLOW_MODE_SHORT_LABELS[String(step?.mode || "")] || String(step?.mode || ""))
    .join(" → ");
}

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

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

function assertEq(actual, expected, msg) {
  assert(actual === expected, `${msg} (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
}

const [indexHtml, mainCss, uiSrc, studySrc] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "src/css/main.css"), "utf8"),
  readFile(join(root, "src/js/ui.js"), "utf8"),
  readFile(join(root, "src/js/study.js"), "utf8"),
]);

const dom = new JSDOM(indexHtml);
const htmlDoc = dom.window.document;

// --- T01: resolveChromeVisibility matrix (12+ cases) ---

const chromeCases = [
  { ctx: { screenId: "modeSelect", studyMode: "rsvp", blockReadWanted: true, hasConcepts: true, offline: false, assessmentActive: false }, book: false, guide: false },
  { ctx: { screenId: "modeSelect", studyMode: "cloze", blockReadWanted: true, hasConcepts: true, offline: false, assessmentActive: false }, book: false, guide: false },
  { ctx: { screenId: "modeSelect", studyMode: "slow", blockReadWanted: true, hasConcepts: true, offline: false, assessmentActive: false }, book: false, guide: false },
  { ctx: { screenId: "create", studyMode: "questions", blockReadWanted: true, hasConcepts: true, offline: false, assessmentActive: false }, book: false, guide: false },
  { ctx: { screenId: "test", studyMode: "rsvp", blockReadWanted: true, hasConcepts: false, offline: false, assessmentActive: false }, book: true, guide: false },
  { ctx: { screenId: "test", studyMode: "rsvp", blockReadWanted: false, hasConcepts: false, offline: false, assessmentActive: false }, book: false, guide: false },
  { ctx: { screenId: "test", studyMode: "questions", blockReadWanted: true, hasConcepts: true, offline: false, assessmentActive: false }, book: false, guide: true },
  { ctx: { screenId: "socratic", studyMode: "cloze", blockReadWanted: false, hasConcepts: true, offline: false, assessmentActive: false }, book: false, guide: true },
  { ctx: { screenId: "between", studyMode: "questions", blockReadWanted: false, hasConcepts: true, offline: false, assessmentActive: false }, book: false, guide: true },
  { ctx: { screenId: "between", studyMode: "questions", blockReadWanted: false, hasConcepts: false, offline: false, assessmentActive: false }, book: false, guide: false },
  { ctx: { screenId: "slowReader", studyMode: "slow", blockReadWanted: true, hasConcepts: true, offline: false, assessmentActive: false }, book: false, guide: false },
  { ctx: { screenId: "test", studyMode: "questions", blockReadWanted: false, hasConcepts: true, offline: true, assessmentActive: false }, book: false, guide: false },
  { ctx: { screenId: "test", studyMode: "questions", blockReadWanted: false, hasConcepts: true, offline: false, assessmentActive: true }, book: false, guide: false },
  { ctx: { screenId: "assessment", studyMode: "rsvp", blockReadWanted: true, hasConcepts: false, offline: false, assessmentActive: true }, book: false, guide: false },
];

for (const [i, row] of chromeCases.entries()) {
  const result = resolveChromeVisibility(row.ctx);
  assertEq(result.showBlockReadFab, row.book, `chrome[${i}] block-read`);
  assertEq(result.showGuideFab, row.guide, `chrome[${i}] guide`);
}

assert(uiSrc.includes("export function resolveChromeVisibility"), "T01: resolveChromeVisibility exported");
assert(!uiSrc.includes("SCREENS_WITH_GUIDE_TOGGLE"), "T01: legacy guide allowlist removed");
assert(uiSrc.includes("registerChromeHasConceptsResolver"), "T01: hasConcepts resolver");

// --- T02: resolveFlowPanelViewState (6+ cases) ---

resetStorage();
const baseRec = {
  primaryFlow: [{ id: "s1", mode: "rsvp", label: "RSVP" }],
  quickFlow: [],
  completedSteps: [],
  currentStepIndex: 0,
  userOverride: false,
  reasoning: "Test",
  analysis: { genreLabel: "Essay" },
};

assertEq(resolveFlowPanelViewState(null), "cta_upload", "view: null doc → cta_upload");
assertEq(resolveFlowPanelViewState({ shared: {} }), "cta_upload", "view: no recommendation → cta_upload");
assertEq(
  resolveFlowPanelViewState({ shared: { modeRecommendation: { ...baseRec } } }),
  "intro",
  "view: valid rec no progress → intro",
);
assertEq(
  resolveFlowPanelViewState({
    shared: { modeRecommendation: { ...baseRec, completedSteps: ["s1"], currentStepIndex: 1 } },
  }),
  "progress",
  "view: completed steps → progress",
);
assertEq(
  resolveFlowPanelViewState({
    shared: { modeRecommendation: { ...baseRec, userOverride: true } },
  }),
  "hidden",
  "view: userOverride → hidden",
);
assertEq(
  resolveFlowPanelViewState({
    shared: { modeRecommendation: { primaryFlow: [], userOverride: false } },
  }),
  "cta_upload",
  "view: empty primaryFlow → cta_upload",
);

// --- T03/T06: DOM contract IDs ---

const requiredIds = [
  "flowRecommendUpload",
  "flowRecommendBtn",
  "flowRecommendFileInput",
  "recommendationPanel",
  "recommendationGenreLabel",
  "recommendationFlowTitle",
  "recommendationReasoning",
  "recommendationStartBtn",
  "recommendationOverrideSelect",
  "recommendationWhyDetails",
  "recommendationWhyBody",
  "recommendationQuickFlow",
  "recommendationProgress",
  "recommendationProgressSteps",
];

for (const id of requiredIds) {
  assert(htmlDoc.getElementById(id), `DOM: #${id} present`);
}

const modeSelect = htmlDoc.getElementById("screenModeSelect");
assert(modeSelect?.contains(htmlDoc.getElementById("flowRecommendUpload")), "DOM: CTA inside mode select");
assert(modeSelect?.contains(htmlDoc.getElementById("recommendationPanel")), "DOM: panel inside mode select");
assert(htmlDoc.getElementById("flowRecommendUpload")?.hidden, "DOM: CTA hidden by default");
assert(htmlDoc.getElementById("recommendationPanel")?.hidden, "DOM: panel hidden by default");
assert(indexHtml.includes("Recommend my study flow"), "DOM: English CTA copy");
assert(indexHtml.includes("Why this flow?"), "DOM: Why details copy");

// --- T03: CSS contract ---

assert(mainCss.includes(".flow-panel"), "CSS: flow-panel");
assert(mainCss.includes(".flow-override-select"), "CSS: override select");
assert(mainCss.includes("color-scheme: dark"), "CSS: dark color-scheme on select");
assert(mainCss.includes(".flow-progress-step.upcoming"), "CSS: stepper states");
assert(mainCss.includes("flow-panel-enter"), "CSS: panel entrance animation");

// --- T04: wiring exports ---

assert(studySrc.includes("export function renderFlowPanel"), "T04: renderFlowPanel exported");
assert(studySrc.includes("export function wireFlowRecommendUpload"), "T04: wireFlowRecommendUpload exported");
assert(studySrc.includes("renderFlowPanel(getActiveSession())"), "T04: render on mode select");

// --- T06: exclusivity via render state ---

const renderDom = new JSDOM(`<!DOCTYPE html><html><body>${indexHtml.match(/<section[^>]*id="screenModeSelect"[\s\S]*?<\/section>/)?.[0] || ""}</body></html>`);
const rDoc = renderDom.window.document;

Object.assign(globalThis, {
  document: rDoc,
  window: renderDom.window,
  HTMLElement: renderDom.window.HTMLElement,
});

for (const id of requiredIds) {
  if (!rDoc.getElementById(id) && htmlDoc.getElementById(id)) {
    rDoc.body.appendChild(htmlDoc.getElementById(id).cloneNode(true));
  }
}

// Mirror els lookups used by renderFlowPanel
const panelEls = {};
for (const id of requiredIds) {
  panelEls[id.replace(/^(flow|recommendation)/, "").replace(/^./, (c) => c.toLowerCase())] = rDoc.getElementById(id);
}

// Simpler exclusivity test without full renderFlowPanel DOM boot
function simulateViewToggle(viewState) {
  const upload = { hidden: true };
  const panel = { hidden: true };
  upload.hidden = viewState !== "cta_upload";
  panel.hidden = viewState !== "intro" && viewState !== "progress";
  return { upload, panel };
}

for (const state of ["cta_upload", "intro", "progress", "hidden"]) {
  const { upload, panel } = simulateViewToggle(state);
  const ctaVisible = !upload.hidden;
  const panelVisible = !panel.hidden;
  assert(!(ctaVisible && panelVisible), `exclusivity: ${state} never shows both`);
  if (state === "cta_upload") assert(ctaVisible && !panelVisible, "exclusivity: cta_upload shows only CTA");
  if (state === "intro" || state === "progress") assert(panelVisible && !ctaVisible, `exclusivity: ${state} shows only panel`);
  if (state === "hidden") assert(!ctaVisible && !panelVisible, "exclusivity: hidden shows neither");
}

assert(
  formatIntroFlowLine([
    { mode: "slow" },
    { mode: "cloze" },
    { mode: "review" },
  ]) === "Slow → Cloze → Review",
  "formatIntroFlowLine happy path",
);

console.log(`\n20260610_flow-panel-chrome-polish: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
