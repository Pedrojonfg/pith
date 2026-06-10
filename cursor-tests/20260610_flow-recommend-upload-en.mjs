/**
 * English UI — mode select + configure collapsibles (no flow-recommendation panel)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260610_flow-recommend-upload-en.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";
import { resetStorage } from "./setup-dom.mjs";
import {
  createSession,
  getSession,
  updateRecommendation,
} from "../src/js/session-store.js";
import { analyzeText } from "../src/js/recommendation/analyzer.js";
import { buildDeterministicPedagogicalMeta } from "../src/js/normalization/hierarchy.js";
import { computeModeRecommendation, GENRE_LABEL_EN } from "../src/js/recommendation/recommender.js";

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

const [indexHtml, studySrc, mainCss, recommenderSrc] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "src/js/study.js"), "utf8"),
  readFile(join(root, "src/css/main.css"), "utf8"),
  readFile(join(root, "src/js/recommendation/recommender.js"), "utf8"),
]);

// --- Markup: English copy, no flow-recommendation UI ---
assert(indexHtml.includes("Choose a study mode"), "EN: mode select heading");
assert(indexHtml.includes("Resume saved session"), "EN: resume collapsible summary");
assert(indexHtml.includes("Generate items"), "EN: cloze generate button");
assert(!indexHtml.includes("Generar ítems"), "EN: no Spanish cloze CTA");
assert(!indexHtml.includes("Recomiéndame"), "EN: no Spanish upload CTA");
assert(!indexHtml.includes("¿Qué modo elijo?"), "EN: triage removed");
assert(!indexHtml.includes('id="flowRecommendBtn"'), "EN: flow upload button removed");
assert(!indexHtml.includes('id="recommendationPanel"'), "EN: recommendation panel removed");

const dom = new JSDOM(indexHtml);
const htmlDoc = dom.window.document;
const modeSelect = htmlDoc.getElementById("screenModeSelect");
assert(modeSelect?.querySelector("#studyModeSelector"), "EN: mode selector on mode select");
assert(!modeSelect?.querySelector("#flowRecommendBtn"), "EN: no upload on mode select");

// --- study.js: silent recommendation persist, no panel ---
assert(studySrc.includes("computeAndPersistModeRecommendation"), "EN: recommendation compute on upload");
assert(!studySrc.includes("wireFlowRecommendUpload"), "EN: upload wiring removed");
assert(!studySrc.includes("renderRecommendationPanel"), "EN: panel renderer removed");
assert(recommenderSrc.includes(GENRE_LABEL_EN.unknown), "EN: genre labels in recommender");

// --- Backend: recommendation still computed and stored ---
resetStorage();
const text = "# Intro\n\nDense academic prose about causation and inference.";
const doc = await createSession(text);
const textMetrics = analyzeText(text);
const pedagogicalMeta = buildDeterministicPedagogicalMeta(textMetrics);
const rec = computeModeRecommendation(textMetrics, pedagogicalMeta, { method: "deterministic" });
doc.shared.modeRecommendation = rec;
updateRecommendation(doc.docId, rec);
const refreshed = getSession(doc.docId);
assert(refreshed?.shared?.modeRecommendation?.primaryFlow?.length > 0, "EN: recommendation stored");
assert(
  refreshed.shared.modeRecommendation.analysis?.genreLabel?.length > 0,
  "EN: genre label on recommendation",
);

assert(mainCss.includes(".form-collapsible"), "EN: collapsible section styles");
assert(!mainCss.includes(".flow-recommend-upload"), "EN: flow upload styles removed");

console.log(`\n20260610_flow-recommend-upload-en: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
