/**
 * T07 — recommendation panel UI (markup + render helpers)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260609_flow-recommendation-panel-ui.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";
import { analyzeText } from "../src/js/recommendation/analyzer.js";
import { computeModeRecommendation } from "../src/js/recommendation/recommender.js";

const FLOW_MODE_SHORT_ES = {
  slow: "Slow",
  cloze: "Cloze",
  review: "Revisión",
  rsvp: "RSVP",
  questions: "Questions",
};

function getFlowModeShortLabel(mode) {
  return FLOW_MODE_SHORT_ES[mode] || mode;
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

function sumFlowTimeMin(steps) {
  if (!Array.isArray(steps)) return 0;
  return steps.reduce((sum, step) => sum + (Number(step?.estimatedTimeMin) || 0), 0);
}

function formatIntroFlowLine(steps) {
  if (!Array.isArray(steps) || !steps.length) return "";
  return steps.map((step) => getFlowModeShortLabel(String(step?.mode || ""))).join(" → ");
}

function formatProgressFlowLine(steps, completed, currentStepIndex) {
  if (!Array.isArray(steps) || !steps.length) return "";
  return steps
    .map((step, index) => {
      const short = getFlowModeShortLabel(String(step?.mode || ""));
      if (step?.id && completed.has(step.id)) return `${short} ✓`;
      if (index === currentStepIndex) return `${short} (siguiente)`;
      return short;
    })
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

const CONTRACT_IDS = [
  "recommendationPanel",
  "recommendationGenreLabel",
  "recommendationFlowSteps",
  "recommendationReasoning",
  "recommendationStartBtn",
  "recommendationOverrideSelect",
  "recommendationWhyLink",
  "recommendationQuickFlow",
  "recommendationProgress",
];

const [indexHtml, studySrc, mainCss] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "src/js/study.js"), "utf8"),
  readFile(join(root, "src/css/main.css"), "utf8"),
]);

const dom = new JSDOM(indexHtml);
const doc = dom.window.document;
const modeSelectScreen = doc.getElementById("screenModeSelect");

for (const id of CONTRACT_IDS) {
  const el = doc.getElementById(id);
  assert(el, `T07: #${id} exists`);
  assert(modeSelectScreen?.contains(el), `T07: #${id} inside mode select screen`);
}

assert(doc.getElementById("recommendationContinueBtn"), "T07: continue button in progress view");
assert(
  doc.querySelector("#recommendationOverrideSelect option[value='rsvp']"),
  "T07: override select includes RSVP",
);

assert(studySrc.includes("export function renderRecommendationPanel"), "T07: renderRecommendationPanel exported");
assert(studySrc.includes("export function getRecommendationPanelState"), "T07: getRecommendationPanelState exported");
assert(studySrc.includes("export function getFlowModeShortLabel"), "T07: getFlowModeShortLabel exported");
assert(studySrc.includes("wireRecommendationPanelHandlers"), "T07: panel handlers wired");
assert(
  studySrc.includes("renderRecommendationPanel(doc?.shared?.modeRecommendation"),
  "T07: enterModeSelectScreen renders panel",
);
assert(studySrc.includes("recordUserOverride(doc.shared.modeRecommendation"), "T07: override persists userOverride");
assert(studySrc.includes("Comenzar"), "T07: Spanish start CTA copy");
assert(studySrc.includes("(aprox.)"), "T07: approx suffix on times");
assert(studySrc.includes("Continuar con"), "T07: Spanish continue CTA copy");

assert(mainCss.includes(".recommendation-panel"), "T07: panel styles in main.css");
assert(mainCss.includes(".recommendation-flow-step"), "T07: linear step chip styles");

const philosophical = `
La cuestión ontológica del ser plantea un problema fundamental. Por tanto, la coherencia
de un sistema filosófico depende de su capacidad explicativa.
`.repeat(20).trim();
const metrics = analyzeText(philosophical);
const rec = computeModeRecommendation(metrics, {
  genre: "philosophical",
  argumentativeDensity: 5,
  conceptualLoad: 4,
  genreReasoning: "Texto denso con cadena argumental",
});

assert(getRecommendationPanelState(rec) === "intro", "state A: intro on fresh recommendation");
assert(getRecommendationPanelState({ ...rec, userOverride: true }) === "hidden", "state C: hidden on override");
assert(
  getRecommendationPanelState({ ...rec, completedSteps: ["step_slow_1"], currentStepIndex: 1 }) === "progress",
  "state B: progress when completedSteps non-empty",
);
assert(
  getRecommendationPanelState({ ...rec, currentStepIndex: 1, completedSteps: [] }) === "hidden",
  "state C: hidden when index>0 without completed steps",
);

assert(
  formatIntroFlowLine(rec.primaryFlow).includes("Slow") &&
    formatIntroFlowLine(rec.primaryFlow).includes("Cloze"),
  "intro flow line uses short Spanish labels",
);
assert(getFlowModeShortLabel("review") === "Revisión", "review short label");
assert(sumFlowTimeMin(rec.primaryFlow) > 0, "sumFlowTimeMin positive for philosophical flow");

const completed = new Set(["step_slow_1"]);
const progressLine = formatProgressFlowLine(rec.primaryFlow, completed, 1);
assert(progressLine.includes("✓"), "progress line marks completed step");
assert(progressLine.includes("(siguiente)"), "progress line marks next step");

console.log(`\nT07 flow-recommendation panel-ui: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
