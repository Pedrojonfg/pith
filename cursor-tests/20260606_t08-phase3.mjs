/**
 * T08 — Phase 3 picker + real Modules A/B
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260606_t08-phase3.mjs
 */
import { JSDOM } from "jsdom";
import {
  PROXIMITY,
  buildRetrievalQuestionShells,
  comparePhase0ToAnnotations,
  computePhase3ConceptStats,
  getEligiblePhase3Modules,
  normalizePhase3Selection,
  renderPhase3ModuleA,
  renderPhase3ModuleB,
  renderPhase3ModulePicker,
  resolveArgumentMapNodeAnchor,
} from "../src/js/slow/phase3.js";

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

const phase0 = {
  argumentMap: [
    { id: "P1", text: "Premise in scope", status: "argued" },
    { id: "C", text: "Conclusion here", status: "argued" },
  ],
  conceptsToFind: [
    { term: "libertad", authorUsage: "freedom" },
    { term: "razón", authorUsage: "reason" },
    { term: "voluntad", authorUsage: "will" },
  ],
  fillableBlanks: [{ nodeId: "P1", userText: "filled", annotationId: "linked", pageIndex: 2 }],
};

const scopeText = `${"x".repeat(200)} Premise in scope ${"y".repeat(200)} Conclusion here ${"z".repeat(80)}`;
const p1Anchor = resolveArgumentMapNodeAnchor(phase0.argumentMap[0], scopeText, [], []);
const linkedAnchor = resolveArgumentMapNodeAnchor(
  phase0.argumentMap[0],
  scopeText,
  phase0.fillableBlanks,
  [{ id: "linked", charStart: 410, charEnd: 430, type: "→", userText: "nota" }],
);

assert(p1Anchor.anchor != null && p1Anchor.source === "text", "T08 happy: P1 anchor from scope text");
assert(linkedAnchor.source === "fillable", "T08 happy: fillable blank overrides text search");

const nearAnn = [
  { id: "a1", charStart: 205, charEnd: 225, type: "≈", userText: "paráfrasis cerca de premisa" },
];
const diffHit = comparePhase0ToAnnotations(phase0, nearAnn, scopeText);
assert(diffHit.find((r) => r.node.id === "P1")?.hit, "T08 happy: ✓ when annotation within ±200 of node");
assert(diffHit.find((r) => r.node.id === "P1")?.snippet.includes("paráfrasis"), "T08 happy: snippet from user note");

const edgeAnn = [
  {
    id: "edge",
    charStart: Math.floor(p1Anchor.anchor + PROXIMITY - 5),
    charEnd: Math.floor(p1Anchor.anchor + PROXIMITY + 5),
    type: "→",
    userText: "just inside window",
  },
];
assert(
  comparePhase0ToAnnotations(phase0, edgeAnn, scopeText).find((r) => r.node.id === "P1")?.hit,
  "T08 edge: annotation at proximity boundary counts",
);

const farAnn = [{ id: "far", charStart: 0, charEnd: 5, type: "?", userText: "lejos" }];
assert(
  !comparePhase0ToAnnotations(phase0, farAnn, scopeText).find((r) => r.node.id === "P1")?.hit,
  "T08 fail: distant annotation does not mark ✓",
);

const emptyTextAnn = [{ id: "empty", charStart: 210, charEnd: 220, type: "≈", userText: "   " }];
assert(
  !comparePhase0ToAnnotations(phase0, emptyTextAnn, scopeText).find((r) => r.node.id === "P1")?.hit,
  "T08 fail: annotation without user text ignored",
);

const session = {
  slow: {
    phase0,
    annotations: nearAnn,
    findings: [{ conceptTerm: "libertad", annotationId: "a1" }],
  },
};
const htmlA = renderPhase3ModuleA(diffHit, session, {
  lang: "Spanish",
  breakpoints: [
    { pageIndex: 0, charStart: 0, charEnd: 250 },
    { pageIndex: 1, charStart: 250, charEnd: 500 },
  ],
});
assert(htmlA.includes("oportunidad de revisión") || htmlA.includes("cubierto"), "T08 happy: non-punitive Spanish copy");
assert(htmlA.includes("Conceptos: 1/3"), "T08 happy: concept footer X/5 style");

const shells = buildRetrievalQuestionShells(nearAnn, "Spanish");
assert(shells.length === 1 && shells[0].prompt.includes("sin usar las palabras"), "T08 happy: retrieval shell template");
const htmlB = renderPhase3ModuleB(shells, "Spanish");
assert(htmlB.includes("slow-retrieval-answer"), "T08 happy: Module B answer UI scaffold");

const eligibleSession = {
  slow: { phase0, annotations: nearAnn },
};
assert(getEligiblePhase3Modules(eligibleSession).join("") === "ABC", "T08 happy: all modules eligible");
assert(getEligiblePhase3Modules({ slow: { phase0 } }).join("") === "A", "T08 edge: B/C need annotations");
assert(
  normalizePhase3Selection(eligibleSession, ["C", "X"]).join("") === "C",
  "T08 fail: invalid module ids filtered out",
);

const dom = new JSDOM('<div id="slowPhase3Modules"></div>');
const pickerEl = dom.window.document.getElementById("slowPhase3Modules");
const picked = renderPhase3ModulePicker(eligibleSession, pickerEl, { onChange: () => {} });
assert(picked.includes("A") && picked.includes("B"), "T08 happy: picker defaults to eligible modules");
assert(
  pickerEl.querySelector('[data-module-id="A"]')?.getAttribute("aria-pressed") === "true",
  "T08 happy: picker marks selected module",
);

console.log(`\nT08 phase3: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
