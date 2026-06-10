/**
 * T13 — Flow recommendation upload on mode select screen
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

// Happy: upload CTA on mode select screen
assert(indexHtml.includes('id="screenModeSelect"'), "T13: mode select screen present");
assert(indexHtml.includes('id="flowRecommendBtn"'), "T13: flow recommend button present");
assert(indexHtml.includes('id="flowRecommendFileInput"'), "T13: hidden file input present");
assert(indexHtml.includes("Recommend my study flow"), "T13: button label in English");
assert(
  indexHtml.indexOf('id="flowRecommendBtn"') < indexHtml.indexOf('id="recommendationPanel"'),
  "T13: upload CTA precedes recommendation panel",
);
assert(
  indexHtml.indexOf('id="recommendationPanel"') < indexHtml.indexOf('id="studyModeSelector"'),
  "T13: recommendation panel precedes mode selector",
);
assert(indexHtml.includes('id="createBackToModesBtn"'), "T13: back to modes button on create screen");
assert(!indexHtml.includes("modeTriageToggle"), "T13: old triage accordion removed");
assert(!indexHtml.includes("¿Qué modo elijo?"), "T13: triage title removed");

// Happy: study.js wires upload + recommendation
assert(studySrc.includes("function wireFlowRecommendUpload"), "T13: wireFlowRecommendUpload defined");
assert(studySrc.includes("wireFlowRecommendUpload();"), "T13: wired from mode selector");
assert(studySrc.includes("export async function recommendFlowFromUploadedFile"), "T13: upload handler exported");
assert(studySrc.includes("enterCreateScreenForMode"), "T13: mode selection navigates to create");
assert(studySrc.includes("enterModeSelectScreen"), "T13: back navigates to mode select");
assert(studySrc.includes("computeAndPersistModeRecommendation"), "T13: recommendation persisted");
assert(studySrc.includes("options.force"), "T13: force recompute on explicit upload");

// Happy: ui.js els
assert(uiSrc.includes("screenModeSelect"), "T13: ui els screenModeSelect");
assert(uiSrc.includes("flowRecommendBtn"), "T13: ui els flowRecommendBtn");
assert(uiSrc.includes("flowRecommendFileInput"), "T13: ui els flowRecommendFileInput");
assert(uiSrc.includes('which === "modeSelect"'), "T13: showScreen modeSelect");

// Happy: styles in main.css
assert(mainCss.includes(".flow-recommend-upload"), "T13: upload panel styles");
assert(!mainCss.includes(".mode-triage-panel"), "T13: triage styles removed");

// Edge: file input accepts study formats
const dom = new JSDOM(indexHtml);
const fileInput = dom.window.document.getElementById("flowRecommendFileInput");
const btn = dom.window.document.getElementById("flowRecommendBtn");
assert(fileInput?.getAttribute("accept")?.includes(".pdf"), "T13: accepts pdf");
assert(btn?.textContent?.includes("Recommend"), "T13: button text in DOM");

// Failure: upload lives on mode select, not configure screen
const modeSelectSection = dom.window.document.getElementById("screenModeSelect");
const createSection = dom.window.document.getElementById("screenPlaceholder");
assert(modeSelectSection?.contains(btn), "T13: upload CTA on mode select screen");
assert(!createSection?.contains(btn), "T13: upload CTA not on configure screen");

// Regression: mode radios unchanged
assert(indexHtml.includes('value="rsvp"'), "T13: RSVP radio preserved");
assert(indexHtml.includes('value="slow"'), "T13: Slow radio preserved");
assert(!studySrc.includes("wireModeTriagePanel"), "T13: triage wiring removed");

console.log(`\n20260528_t13-triage-matrix: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
