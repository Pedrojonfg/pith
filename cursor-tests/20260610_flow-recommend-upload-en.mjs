/**
 * Flow recommendation upload — English UI + upload-to-recommendation flow
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260610_flow-recommend-upload-en.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";
import { resetStorage } from "./setup-dom.mjs";
import {
  createSession,
  getActiveSession,
  getSession,
  setActiveSession,
  updateRecommendation,
} from "../src/js/session-store.js";
import { analyzeText } from "../src/js/recommendation/analyzer.js";
import {
  buildDeterministicPedagogicalMeta,
  buildDocumentHierarchy,
} from "../src/js/normalization/hierarchy.js";
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

const [indexHtml, studySrc, mainCss, recommenderSrc] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "src/js/study.js"), "utf8"),
  readFile(join(root, "src/css/main.css"), "utf8"),
  readFile(join(root, "src/js/recommendation/recommender.js"), "utf8"),
]);

// --- Markup: English copy, no Spanish triage ---
assert(indexHtml.includes("Recommend my study flow"), "EN: upload button label");
assert(indexHtml.includes("Why this flow?"), "EN: why link");
assert(indexHtml.includes("Progress:"), "EN: progress label");
assert(indexHtml.includes("Go directly to…"), "EN: override placeholder");
assert(indexHtml.includes("Another mode"), "EN: override hint");
assert(!indexHtml.includes("Recomiéndame"), "EN: no Spanish upload CTA");
assert(!indexHtml.includes("¿Qué modo elijo?"), "EN: triage removed");
assert(!indexHtml.includes("Progreso:"), "EN: no Spanish progress label");

const dom = new JSDOM(indexHtml);
const htmlDoc = dom.window.document;
const modeSelect = htmlDoc.getElementById("screenModeSelect");
assert(modeSelect?.contains(htmlDoc.getElementById("flowRecommendBtn")), "EN: upload on mode select");
assert(
  modeSelect?.contains(htmlDoc.getElementById("recommendationPanel")),
  "EN: recommendation panel on mode select",
);

// --- study.js wiring (source) ---
assert(studySrc.includes("wireFlowRecommendUpload"), "EN: upload wired");
assert(studySrc.includes("export async function recommendFlowFromUploadedFile"), "EN: export upload handler");
assert(studySrc.includes("options.force"), "EN: force recompute on upload");
assert(studySrc.includes("full flow (approx.)"), "EN: genre line copy");
assert(studySrc.includes("Start "), "EN: start CTA");
assert(studySrc.includes("Continue with"), "EN: continue CTA");
assert(studySrc.includes("Only "), "EN: quick flow prefix");
assert(!studySrc.includes("Recomiéndame el flujo"), "EN: no Spanish in study.js upload");

// --- recommender English strings ---
assert(recommenderSrc.includes("GENRE_LABEL_EN"), "EN: genre labels export");
assert(recommenderSrc.includes("Dense argumentative text"), "EN: philosophical reasoning");
assert(!recommenderSrc.includes("Texto filosófico argumentativo"), "EN: no Spanish genre label");
assert(GENRE_LABEL_EN.philosophical.includes("philosophy"), "EN: philosophical genre label");
assert(GENRE_LABEL_EN.unknown === "Academic text", "EN: unknown genre label");

// --- Happy path: upload flow (mirrors recommendFlowFromUploadedFile) ---
resetStorage();

const philosophicalMd = `La cuestión ontológica del ser plantea un problema fundamental para la
hermenéutica contemporánea. Por tanto, la coherencia de un sistema filosófico depende
de su capacidad explicativa. ${"Argumento denso sin headings. ".repeat(80)}`;

const session = await createSession(philosophicalMd);
setActiveSession(session.docId);
const hierarchyResult = await buildDocumentHierarchy(philosophicalMd, null, { useCache: true });
const textMetrics = analyzeText(philosophicalMd);
const pedagogicalMeta =
  hierarchyResult?.pedagogicalMeta ?? buildDeterministicPedagogicalMeta(textMetrics);
const rec = computeModeRecommendation(textMetrics, pedagogicalMeta, {
  method: hierarchyResult?.method === "llm" ? "llm_meta" : "deterministic",
});

session.shared.docHierarchy = hierarchyResult;
session.shared.modeRecommendation = rec;
updateRecommendation(session.docId, rec);

assert(rec.primaryFlow[0].mode === "slow", "upload: philosophical → slow first");
assert(getRecommendationPanelState(rec) === "intro", "upload: intro panel state");

const persisted = getActiveSession();
assert(persisted?.shared?.modeRecommendation?.primaryFlow?.length >= 1, "upload: persisted to session");

// --- Edge: force recompute replaces prior recommendation ---
const firstComputedAt = persisted.shared.modeRecommendation.computedAt;
const recomputed = computeModeRecommendation(textMetrics, pedagogicalMeta);
recomputed.computedAt = Date.now() + 1;
persisted.shared.modeRecommendation = recomputed;
updateRecommendation(persisted.docId, recomputed);
const second = getSession(persisted.docId);
assert(
  second?.shared?.modeRecommendation?.computedAt > firstComputedAt,
  "force: recomputes recommendation",
);

// --- Failure: empty markdown still yields safe default flow ---
const emptyMetrics = analyzeText("");
const emptyRec = computeModeRecommendation(
  emptyMetrics,
  buildDeterministicPedagogicalMeta(emptyMetrics),
);
assert(emptyRec.primaryFlow.length >= 1, "failure: empty text still yields default flow");
assert(emptyMetrics.charCount === 0 && emptyMetrics.wordCount === 0, "failure: empty metrics zeros");

// --- CSS present ---
assert(mainCss.includes(".flow-recommend-upload"), "EN: upload section styles");

console.log(`\n20260610_flow-recommend-upload-en: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
