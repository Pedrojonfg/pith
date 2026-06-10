/**
 * T13 — Mode select without flow-recommendation UI; configure screen collapsibles
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260528_t13-triage-matrix.mjs
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

const [indexHtml, studySrc, mainCss, uiSrc] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "src/js/study.js"), "utf8"),
  readFile(join(root, "src/css/main.css"), "utf8"),
  readFile(join(root, "src/js/ui.js"), "utf8"),
]);

const dom = new JSDOM(indexHtml);
const doc = dom.window.document;
const modeSelectSection = doc.getElementById("screenModeSelect");
const createSection = doc.getElementById("screenPlaceholder");

// Flow recommendation UI removed from mode select
assert(indexHtml.includes('id="screenModeSelect"'), "T13: mode select screen present");
assert(!indexHtml.includes('id="flowRecommendBtn"'), "T13: flow recommend button removed");
assert(!indexHtml.includes('id="recommendationPanel"'), "T13: recommendation panel removed");
assert(!indexHtml.includes("Recommend my study flow"), "T13: flow CTA copy removed");
assert(!indexHtml.includes("modeTriageToggle"), "T13: old triage accordion removed");
assert(!indexHtml.includes("¿Qué modo elijo?"), "T13: triage title removed");

// Configure screen uses collapsible sections
assert(indexHtml.includes('id="resumeSessionDetails"'), "T13: resume collapsible present");
assert(indexHtml.includes('id="rsvpAdvancedDetails"'), "T13: RSVP advanced collapsible present");
assert(indexHtml.includes('id="rsvpImportDetails"'), "T13: RSVP import collapsible present");
assert(mainCss.includes(".form-collapsible"), "T13: collapsible styles");
assert(createSection?.querySelector("#resumeSessionDetails"), "T13: resume on configure screen");
assert(!modeSelectSection?.querySelector("#resumeSessionDetails"), "T13: resume not on mode select");

// study.js still persists recommendations silently; no upload UI wiring
assert(studySrc.includes("computeAndPersistModeRecommendation"), "T13: recommendation persisted on upload");
assert(!studySrc.includes("wireFlowRecommendUpload"), "T13: flow upload wiring removed");
assert(!studySrc.includes("renderRecommendationPanel"), "T13: panel renderer removed");
assert(studySrc.includes("enterCreateScreenForMode"), "T13: mode selection navigates to create");
assert(studySrc.includes("enterModeSelectScreen"), "T13: back navigates to mode select");
assert(studySrc.includes("rsvpImportDetails"), "T13: import details visibility wired");
assert(studySrc.includes("rsvpAdvancedDetails"), "T13: advanced details visibility wired");

assert(uiSrc.includes("screenModeSelect"), "T13: ui els screenModeSelect");
assert(uiSrc.includes("rsvpImportDetails"), "T13: ui els rsvpImportDetails");
assert(uiSrc.includes('which === "modeSelect"'), "T13: showScreen modeSelect");
assert(!mainCss.includes(".mode-triage-panel"), "T13: triage styles removed");

assert(indexHtml.includes('value="rsvp"'), "T13: RSVP radio preserved");
assert(indexHtml.includes('value="slow"'), "T13: Slow radio preserved");
assert(!studySrc.includes("wireModeTriagePanel"), "T13: triage wiring removed");

console.log(`\n20260528_t13-triage-matrix: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
