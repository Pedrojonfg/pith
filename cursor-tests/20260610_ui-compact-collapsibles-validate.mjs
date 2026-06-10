/**
 * Validate — UI compact collapsibles + flow-recommendation removal + English copy
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260610_ui-compact-collapsibles-validate.mjs
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

/** Mirrors study.js updateCreateScreenModeVisibility (details-level visibility). */
function applyModeVisibility(doc, mode) {
  const isSlow = mode === "slow";
  const isRsvp = mode === "rsvp";
  const isCloze = mode === "cloze";
  const isQuestions = mode === "questions";
  const showBlockConfig = isRsvp || isQuestions;

  const setHidden = (id, hidden) => {
    const el = doc.getElementById(id);
    if (el) el.hidden = hidden;
  };

  setHidden("rsvpImportDetails", !isRsvp);
  setHidden("rsvpAdvancedDetails", !showBlockConfig);
  setHidden("slowOnlyControls", !isSlow);
  setHidden("clozeImportSection", !isCloze);

  const blocksInput = doc.getElementById("blocksInput");
  if (blocksInput) blocksInput.required = showBlockConfig;
}

const [indexHtml, studySrc, mainCss, uiSrc, slowCss] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "src/js/study.js"), "utf8"),
  readFile(join(root, "src/css/main.css"), "utf8"),
  readFile(join(root, "src/js/ui.js"), "utf8"),
  readFile(join(root, "src/css/slow-mode.css"), "utf8"),
]);

const dom = new JSDOM(indexHtml);
const doc = dom.window.document;
const modeSelect = doc.getElementById("screenModeSelect");
const createScreen = doc.getElementById("screenPlaceholder");
const form = doc.getElementById("generateBlocksForm");

// --- Happy: mode select is minimal ---
assert(modeSelect?.querySelector("h1")?.textContent === "Choose a study mode", "happy: mode select title");
assert(modeSelect?.querySelector("#studyModeSelector"), "happy: four-mode picker present");
assert(modeSelect?.querySelectorAll('input[name="studyMode"]').length === 4, "happy: four mode radios");
assert(modeSelect?.querySelector("#modeSelectDocLibraryBtn"), "happy: doc library link on mode select");

// --- Happy: configure screen collapsibles ---
const resumeDetails = doc.getElementById("resumeSessionDetails");
const rsvpImport = doc.getElementById("rsvpImportDetails");
const rsvpAdvanced = doc.getElementById("rsvpAdvancedDetails");
const clozeImport = doc.getElementById("clozeImportSection");

assert(resumeDetails?.tagName === "DETAILS", "happy: resume is details element");
assert(rsvpImport?.tagName === "DETAILS", "happy: RSVP import is details");
assert(rsvpAdvanced?.tagName === "DETAILS", "happy: RSVP advanced is details");
assert(clozeImport?.tagName === "DETAILS", "happy: cloze import is details");
assert(createScreen?.contains(resumeDetails), "happy: resume on configure screen");
assert(!resumeDetails?.open, "happy: resume collapsed by default");
assert(!rsvpAdvanced?.open, "happy: advanced blocks collapsed by default");

// --- Happy: core upload fields stay outside collapsibles ---
const fileInputIdx = indexHtml.indexOf('id="fileInput"');
const resumeIdx = indexHtml.indexOf('id="resumeSessionDetails"');
const modelIdx = indexHtml.indexOf('id="llmModelSelect"');
assert(fileInputIdx > 0 && modelIdx > fileInputIdx, "happy: model follows file input");
assert(resumeIdx > indexHtml.indexOf('id="generateBlocksError"'), "happy: resume after main form");

assert(form?.querySelector("#studyNotesInput")?.getAttribute("rows") === "2", "happy: comments textarea compact (2 rows)");
assert(form?.classList.contains("create-form"), "happy: create form uses compact layout class");

// --- Happy: mode visibility contract (RSVP) ---
applyModeVisibility(doc, "rsvp");
assert(!rsvpImport?.hidden, "happy: RSVP shows import details");
assert(!rsvpAdvanced?.hidden, "happy: RSVP shows advanced details");
assert(doc.getElementById("slowOnlyControls")?.hidden, "happy: slow options hidden for RSVP");
assert(clozeImport?.hidden, "happy: cloze import hidden for RSVP");
assert(doc.getElementById("blocksInput")?.required, "happy: blocks required for RSVP");

// --- Happy: mode visibility contract (slow) ---
applyModeVisibility(doc, "slow");
assert(rsvpImport?.hidden, "happy: import hidden for slow");
assert(rsvpAdvanced?.hidden, "happy: advanced hidden for slow");
assert(!doc.getElementById("slowOnlyControls")?.hidden, "happy: slow options visible for slow");
assert(!doc.getElementById("blocksInput")?.required, "happy: blocks not required for slow");

// --- Happy: mode visibility contract (cloze) ---
applyModeVisibility(doc, "cloze");
assert(!clozeImport?.hidden, "happy: cloze import visible for cloze");
assert(rsvpAdvanced?.hidden, "happy: advanced hidden for cloze");

// --- Happy: study.js wiring ---
assert(studySrc.includes("rsvpImportDetails"), "happy: study wires rsvpImportDetails");
assert(studySrc.includes("rsvpAdvancedDetails"), "happy: study wires rsvpAdvancedDetails");
assert(uiSrc.includes("rsvpImportDetails"), "happy: ui els rsvpImportDetails");
assert(uiSrc.includes("rsvpAdvancedDetails"), "happy: ui els rsvpAdvancedDetails");
assert(!studySrc.includes("wireFlowRecommendUpload"), "happy: no flow upload wiring");
assert(!studySrc.includes("renderRecommendationPanel"), "happy: no panel renderer");

// --- Happy: English dynamic strings in study.js ---
assert(studySrc.includes("Generate items"), "happy: cloze generate EN");
assert(studySrc.includes("Items ready."), "happy: cloze ready EN");
assert(!studySrc.includes("Generar ítems"), "happy: no Spanish cloze generate in study.js");
assert(studySrc.includes("Edit sections"), "happy: slow scope edit EN");

// --- Edge: null mode hides mode-specific sections ---
applyModeVisibility(doc, null);
assert(rsvpImport?.hidden, "edge: null mode hides RSVP import");
assert(rsvpAdvanced?.hidden, "edge: null mode hides advanced");
assert(clozeImport?.hidden, "edge: null mode hides cloze import");

// --- Edge: questions mode shares block config with RSVP ---
applyModeVisibility(doc, "questions");
assert(rsvpImport?.hidden, "edge: questions hides RSVP-only import");
assert(!rsvpAdvanced?.hidden, "edge: questions shows block config");
assert(doc.getElementById("blocksInput")?.required, "edge: blocks required for questions");

// --- Edge: resume always on configure, never on mode select ---
assert(!modeSelect?.contains(resumeDetails), "edge: resume not on mode select");

// --- Failure: flow recommendation UI fully removed ---
const removedIds = [
  "flowRecommendBtn",
  "flowRecommendFileInput",
  "recommendationPanel",
  "recommendationStartBtn",
  "recommendationOverrideSelect",
  "recommendationWhyLink",
];
for (const id of removedIds) {
  assert(!doc.getElementById(id), `failure: ${id} absent from DOM`);
}
assert(!indexHtml.includes("Recommend my study flow"), "failure: flow CTA copy removed");
assert(!indexHtml.includes("Why this flow?"), "failure: why-link copy removed");
assert(!mainCss.includes(".recommendation-panel"), "failure: recommendation CSS removed");
assert(!mainCss.includes(".flow-recommend-upload"), "failure: flow upload CSS removed");

// --- Failure: Spanish user-facing strings removed from index.html ---
const spanishUiSnippets = [
  "Generar ítems",
  "Estudiar",
  "Ver grafo",
  "Importar ítems",
  "Editar secciones",
  "Mapa rellenable",
  "Mis anotaciones",
  "Preguntar a IA",
  "Lectura completa",
  "¿Qué modo elijo?",
];
for (const snippet of spanishUiSnippets) {
  assert(!indexHtml.includes(snippet), `failure: no Spanish "${snippet}" in index.html`);
}

// --- Failure: collapsible styles present ---
assert(mainCss.includes(".form-collapsible"), "failure: collapsible styles exist");
assert(mainCss.includes(".form-collapsible-body"), "failure: collapsible body styles exist");
assert(slowCss.includes(".study-mode-option:hover"), "failure: mode card hover polish");

console.log(`\n20260610_ui-compact-collapsibles-validate: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
