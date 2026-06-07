/**
 * T10 — UI depth score + hallazgos + feedback calidad
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260606_t10-gamification-ui.mjs
 */
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import {
  buildPenaltyFeedback,
  computeDepthScore,
  ensureDepthScore,
  PENALTY_FEEDBACK_TEMPLATES,
  renderDepthScorePanel,
  renderFindingsPanel,
  renderPhase3GamificationPanel,
} from "../src/js/slow/gamification.js";

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

// --- buildPenaltyFeedback ---

assert(
  buildPenaltyFeedback({ type: "⊘" }, "Spanish").includes("Esta ⊘ podría especificar"),
  "T10 happy: ⊘ actionable feedback in Spanish",
);
assert(
  buildPenaltyFeedback({ type: "→" }, "English").includes("This → could develop"),
  "T10 happy: → actionable feedback in English",
);
assert(
  buildPenaltyFeedback({ type: "📌" }, "Spanish").includes("Añade tu propio texto"),
  "T10 edge: unknown type falls back to generic feedback",
);

assert(
  Object.keys(PENALTY_FEEDBACK_TEMPLATES).includes("≈") &&
    Object.keys(PENALTY_FEEDBACK_TEMPLATES).includes("?"),
  "T10: penalty templates cover generative types",
);

// --- computeDepthScore penalties include type ---

const penalized = computeDepthScore([
  { id: "g1", type: "→", userText: "" },
  { id: "g2", type: "≈", userText: "con texto" },
]);
assert(penalized.penalties.length === 1, "T10 happy: one penalty for empty generative mark");
assert(penalized.penalties[0].type === "→", "T10 happy: penalty carries annotation type");
assert(penalized.total === 4, "T10 happy: total reflects −1 penalty (→ 3−1 + ≈ 2 = 4)");

const empty = computeDepthScore([]);
assert(empty.generativeRatio === 0 && empty.total === 0, "T10 edge: empty annotations → zero score");

// --- ensureDepthScore ---

const session = {
  slow: {
    criticalMode: true,
    annotations: [
      { id: "a1", type: "⊘", userText: "objeción" },
      { id: "a2", type: "→", userText: "explicación" },
    ],
    findings: [
      { conceptTerm: "libertad", annotationId: "a2", revealedInPhase1: false },
      { conceptTerm: "razón", annotationId: "a1", revealedInPhase1: true },
    ],
  },
};

const stored = ensureDepthScore(session);
assert(session.slow.depthScore === stored, "T10 happy: ensureDepthScore writes to session");
assert(stored.byType["⊘"] === 5, "T10 happy: critical mode boosts ⊘ to 5");
assert(stored.generativeRatio === 1, "T10 happy: generativeRatio 100% when all have text");

// --- renderDepthScorePanel ---

const depthHtml = renderDepthScorePanel(session, "Spanish");
assert(depthHtml.includes("Profundidad de lectura"), "T10 happy: Spanish depth panel title");
assert(depthHtml.includes("8") || depthHtml.includes(String(stored.total)), "T10 happy: total score visible");
assert(depthHtml.includes("100%"), "T10 happy: generative ratio shown as percent");
assert(depthHtml.includes("⊘"), "T10 happy: byType breakdown includes ⊘");
assert(
  depthHtml.includes("sin rankings ni rachas"),
  "T10: private note — no leaderboards/streaks copy",
);

const penalizedSession = {
  slow: {
    annotations: [{ id: "p1", type: "≈", userText: "" }],
    findings: [],
  },
};
const penaltyHtml = renderDepthScorePanel(penalizedSession, "Spanish");
assert(
  penaltyHtml.includes("Esta ≈ podría parafrasear"),
  "T10 happy: actionable penalty text rendered",
);
assert(
  penaltyHtml.includes("Oportunidades de mejora"),
  "T10 happy: penalties section heading present",
);

// --- renderFindingsPanel ---

const findingsHtml = renderFindingsPanel(session, "Spanish");
assert(findingsHtml.includes("Hallazgos"), "T10 happy: findings panel title");
assert(findingsHtml.includes("libertad"), "T10 happy: silent finding revealed in Phase 3");
assert(findingsHtml.includes("razón"), "T10 happy: early finding listed");
assert(
  findingsHtml.includes("revelados aquí"),
  "T10 happy: silent findings group hint",
);

const noFindings = renderFindingsPanel({ slow: { findings: [], annotations: [] } }, "English");
assert(
  noFindings.includes("No Phase 0 concepts linked yet"),
  "T10 edge: empty findings shows hint",
);

// --- renderPhase3GamificationPanel combines both ---

const combined = renderPhase3GamificationPanel(session, "Spanish");
assert(
  combined.includes("slow-depth-panel") && combined.includes("slow-findings-panel"),
  "T10 happy: combined panel includes depth + findings",
);

// --- DOM integration via initPhase3Screen ---

const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
    <div id="slowPhase3Score"></div>
    <div id="slowPhase3Modules"></div>
    <div id="slowPhase3Content"></div>
  </body></html>`,
  { pretendToBeVisual: true, url: "http://localhost" },
);
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { initPhase3Screen } = await import("../src/js/slow/phase3.js");
await initPhase3Screen(session);

const scoreEl = document.getElementById("slowPhase3Score");
assert(scoreEl?.innerHTML.includes("Reading depth"), "T10 happy: initPhase3Screen fills score section");
assert(scoreEl?.innerHTML.includes("libertad"), "T10 happy: findings visible without export");

// --- No leaderboards/streaks in touched files ---

const gamificationSrc = await readFile(
  new URL("../src/js/slow/gamification.js", import.meta.url),
  "utf8",
);
const phase3Src = await readFile(new URL("../src/js/slow/phase3.js", import.meta.url), "utf8");
const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
const noGamificationDisclaimer = gamificationSrc
  .replace(/sin rankings ni rachas/gi, "")
  .replace(/no rankings or streaks/gi, "");
const noLeaderboardStreak = (src) => !/leaderboard|streak/i.test(src);
assert(noLeaderboardStreak(noGamificationDisclaimer), "T10: gamification.js has no leaderboard/streak features");
assert(noLeaderboardStreak(phase3Src), "T10: phase3.js has no leaderboard/streak features");
assert(noLeaderboardStreak(indexHtml), "T10: index.html has no leaderboard/streak features");

const css = await readFile(new URL("../src/css/slow-mode.css", import.meta.url), "utf8");
assert(css.includes(".slow-depth-panel"), "T10: depth panel CSS present");
assert(css.includes(".slow-findings-panel"), "T10: findings panel CSS present");

console.log(`\n20260606_t10-gamification-ui: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
