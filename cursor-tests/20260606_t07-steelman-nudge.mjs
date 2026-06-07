/**
 * T07 — Steel-man nudges + critical depth multiplier
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260606_t07-steelman-nudge.mjs
 */
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import {
  addAnnotation,
  hasSteelManPrecursorNearby,
  shouldShowSteelManNudge,
  updateAnnotation,
  STEELMAN_NUDGE_TYPES,
} from "../src/js/slow/annotations.js";
import { computeDepthScore } from "../src/js/slow/gamification.js";

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

const session = {
  slow: {
    readingScope: { charStart: 0, charEnd: 2000 },
    normalizedTextFull: "x".repeat(2000),
    annotations: [],
  },
};

// --- hasSteelManPrecursorNearby ---

const target = { id: "crit1", type: "⊘", charStart: 600, charEnd: 610, userText: "objeto" };

assert(
  !hasSteelManPrecursorNearby([], target),
  "T07: no annotations → no precursor",
);

const nearApprox = [
  { id: "p1", type: "≈", charStart: 200, charEnd: 210, userText: "parafraseo" },
  target,
];
assert(
  hasSteelManPrecursorNearby(nearApprox, target),
  "T07 happy: ≈ within ±500 chars counts as precursor",
);

const farApprox = [
  { id: "p2", type: "≈", charStart: 50, charEnd: 60, userText: "lejos" },
  target,
];
assert(
  !hasSteelManPrecursorNearby(farApprox, target),
  "T07 fail: ≈ beyond ±500 chars is not precursor",
);

const emptyApprox = [
  { id: "p3", type: "≈", charStart: 580, charEnd: 590, userText: "" },
  target,
];
assert(
  !hasSteelManPrecursorNearby(emptyApprox, target),
  "T07 edge: ≈ without userText does not count",
);

const nearSteel = [
  { id: "p4", type: "⇑", charStart: 620, charEnd: 630, userText: "steel man" },
  target,
];
assert(
  hasSteelManPrecursorNearby(nearSteel, target),
  "T07 happy: ⇑ with text within window counts",
);

// --- shouldShowSteelManNudge ---

assert(
  shouldShowSteelManNudge(farApprox, target),
  "T07 happy: ⊘ without precursor triggers nudge",
);

assert(
  !shouldShowSteelManNudge(nearApprox, target),
  "T07 fail: ⊘ with nearby ≈ does not trigger nudge",
);

assert(
  !shouldShowSteelManNudge([], { id: "x", type: "≈", charStart: 0, charEnd: 5 }),
  "T07 edge: non-nudge types never trigger",
);

assert(STEELMAN_NUDGE_TYPES.has("↯") && STEELMAN_NUDGE_TYPES.has("⚠"), "T07: nudge types include ↯ and ⚠");

// --- skippedSteelMan on continue ---

const rejectAnn = addAnnotation(session, {
  type: "⊘",
  charStart: 100,
  charEnd: 110,
  userText: "objeción",
});
updateAnnotation(session, rejectAnn.id, { skippedSteelMan: true });
assert(
  session.slow.annotations.find((a) => a.id === rejectAnn.id)?.skippedSteelMan === true,
  "T07: Continuar sets skippedSteelMan on annotation",
);

// --- computeDepthScore critical multiplier ---

const baseAnnotations = [
  { id: "1", type: "⊘", userText: "obj" },
  { id: "2", type: "→", userText: "exp" },
];

const baseScore = computeDepthScore(baseAnnotations);
const criticalScore = computeDepthScore(baseAnnotations, { criticalMode: true });

assert(baseScore.total === 7, "T07: base score ⊘(4)+→(3)=7");
assert(criticalScore.total === 8, "T07 happy: critical mode ⊘×1.25(5)+→(3)=8");

const allCriticalTypes = [
  { id: "a", type: "⊘", userText: "x" },
  { id: "b", type: "↯", userText: "x" },
  { id: "c", type: "⚠", userText: "x" },
  { id: "d", type: "★", userText: "x" },
  { id: "e", type: "⇑", userText: "x" },
];
const rawCritical = allCriticalTypes.reduce((s, a) => s + ({ "⊘": 4, "↯": 4, "⚠": 3, "★": 3, "⇑": 4 }[a.type]), 0);
const boosted = computeDepthScore(allCriticalTypes, { criticalMode: true });
assert(
  Math.abs(boosted.total - rawCritical * 1.25) < 0.001,
  "T07: all critical types get ×1.25 in criticalMode",
);

const noBoost = computeDepthScore([{ id: "z", type: "≈", userText: "p" }], { criticalMode: true });
assert(noBoost.total === 2, "T07 edge: non-critical types unchanged in criticalMode");

// --- modal DOM (jsdom) ---

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const {
  showSteelManNudgeModal,
  hideSteelManNudgeModal,
  isSlowSteelManNudgeOpen,
} = await import("../src/js/slow/reader.js");

let steelManClicked = false;
showSteelManNudgeModal(session, rejectAnn, {
  onSteelMan: () => {
    steelManClicked = true;
  },
});

const modal = document.getElementById("slowSteelManNudge");
assert(modal && !modal.hidden, "T07: steel-man modal visible after critical confirm");
assert(isSlowSteelManNudgeOpen(), "T07: nudge open flag set");
assert(
  modal.querySelector(".slow-steelman-nudge-title")?.textContent?.includes("mejor argumento"),
  "T07: modal shows educational prompt",
);

modal.querySelector(".slow-steelman-nudge-steel")?.click();
assert(steelManClicked, "T07: Pedir steel man triggers callback");

hideSteelManNudgeModal();
assert(modal.hidden, "T07: modal hidden after dismiss");
assert(!isSlowSteelManNudgeOpen(), "T07: nudge open flag cleared");

// --- CSS contract ---
const css = await readFile(new URL("../src/css/slow-mode.css", import.meta.url), "utf8");
assert(css.includes(".slow-steelman-nudge"), "T07: nudge CSS present");
assert(css.includes(".slow-steelman-nudge-panel"), "T07: nudge panel CSS present");

console.log(`\n20260606_t07-steelman-nudge: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
