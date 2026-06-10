/**
 * T07 — Flow recommendation panel removed; configure collapsibles present
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260609_flow-recommendation-panel-ui.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";

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

const [indexHtml, studySrc, mainCss] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "src/js/study.js"), "utf8"),
  readFile(join(root, "src/css/main.css"), "utf8"),
]);

const dom = new JSDOM(indexHtml);
const doc = dom.window.document;

const removedIds = [
  "recommendationPanel",
  "recommendationGenreLabel",
  "recommendationFlowSteps",
  "recommendationReasoning",
  "recommendationStartBtn",
  "recommendationOverrideSelect",
  "recommendationWhyLink",
  "recommendationQuickFlow",
  "recommendationProgress",
  "flowRecommendBtn",
];

for (const id of removedIds) {
  assert(!doc.getElementById(id), `T07: ${id} removed from DOM`);
}

assert(doc.getElementById("resumeSessionDetails")?.tagName === "DETAILS", "T07: resume is collapsible");
assert(doc.getElementById("rsvpAdvancedDetails")?.tagName === "DETAILS", "T07: RSVP advanced is collapsible");
assert(doc.getElementById("clozeImportSection")?.tagName === "DETAILS", "T07: cloze import is collapsible");

assert(!studySrc.includes("export function renderRecommendationPanel"), "T07: renderRecommendationPanel removed");
assert(!studySrc.includes("export function getRecommendationPanelState"), "T07: panel state helper removed");
assert(studySrc.includes("export function getRecommendedStep"), "T07: getRecommendedStep kept for progress");
assert(studySrc.includes("export function computeAndPersistModeRecommendation"), "T07: silent persist kept");

assert(mainCss.includes(".form-collapsible"), "T07: collapsible styles in main.css");
assert(!mainCss.includes(".recommendation-panel"), "T07: panel styles removed");

console.log(`\nT07 flow-recommendation panel-ui: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
