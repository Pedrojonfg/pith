/**
 * T03 — IA overlay + ia-query annotations
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260606_t03-ia-overlay.mjs
 */
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { getPageSlice } from "../src/js/slow/pagination.js";
import {
  IA_QUERY_TYPE,
  addIAQueryAnnotation,
  addAnnotation,
  isIAQueryAnnotation,
} from "../src/js/slow/annotations.js";
import { buildIAContext } from "../src/js/slow/ai-context.js";

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
    readingScope: { charStart: 0, charEnd: 500 },
    normalizedTextFull: "a".repeat(500),
    maxReadCharEnd: 120,
    currentPageIndex: 1,
    annotations: [],
  },
};

const breakpoints = [
  { pageIndex: 0, charStart: 0, charEnd: 100 },
  { pageIndex: 1, charStart: 100, charEnd: 200 },
];

// --- isIAQueryAnnotation ---
assert(isIAQueryAnnotation({ type: IA_QUERY_TYPE, userText: "q" }), "T03: ia-query type is IA query");
assert(
  isIAQueryAnnotation({ type: "⚑", aiReply: "respuesta" }),
  "T03: flag with aiReply is IA query",
);
assert(!isIAQueryAnnotation({ type: "⚑", aiReply: null }), "T03: flag without reply is not IA query");
assert(!isIAQueryAnnotation({ type: "≈", userText: "x" }), "T03: paraphrase is not IA query");
assert(
  isIAQueryAnnotation({ type: "ia-query", isIAQuery: true, userText: "x" }),
  "T03: isIAQuery flag edge case",
);

// --- addIAQueryAnnotation happy / edge / failure ---
const iaAnn = addIAQueryAnnotation(session, {
  userText: "¿Qué argumenta el autor?",
  charStart: 110,
  charEnd: 115,
  aiReply: "Respuesta breve.",
});
assert(iaAnn?.type === IA_QUERY_TYPE, "T03: persisted as ia-query type");
assert(iaAnn?.isIAQuery === true, "T03: isIAQuery flag set");
assert(iaAnn?.aiReply === "Respuesta breve.", "T03: aiReply stored");
assert(session.slow.annotations.length === 1, "T03: annotation pushed to session");

const emptyQuery = addIAQueryAnnotation(session, {
  userText: "",
  charStart: 50,
  charEnd: 55,
  aiReply: null,
});
assert(emptyQuery?.userText === "", "T03: empty userText edge case allowed");
assert(addIAQueryAnnotation(null, { userText: "x", charStart: 0, charEnd: 1 }) === null, "T03: no session fails");

// --- read anchor formula (mirrors getReadAnchor) ---
const slice = getPageSlice(breakpoints, session.slow.currentPageIndex);
const charEnd = Math.max(Number(session.slow.maxReadCharEnd) || 0, slice.charEnd);
const charStart = Math.max(0, charEnd - 1);
assert(charEnd === 200, "T03: anchor uses max of maxReadCharEnd and page end");
assert(charStart === 199 && charEnd > charStart, "T03: anchor satisfies charStart < charEnd");

// --- buildIAContext anti-spoiler ---
session.slow.normalizedTextFull = "ABCDEFGHIJ";
session.slow.maxReadCharEnd = 4;
const ctx = buildIAContext(session.slow);
assert(ctx === "ABCD", "T03: IA context clipped to maxReadCharEnd");

// --- overlay DOM (jsdom) ---
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;

const { showSlowIAOverlay, hideSlowIAOverlay, isSlowIAOverlayOpen } = await import("../src/js/slow/reader.js");

const page = document.createElement("div");
page.id = "slowReaderPage";
document.body.appendChild(page);

showSlowIAOverlay({ query: "Pregunta test", reply: "Respuesta corta.", loading: false });
const overlay = document.getElementById("slowIAOverlay");
assert(overlay && !overlay.hidden, "T03: overlay visible after show");
assert(isSlowIAOverlayOpen(), "T03: overlay open flag set");
assert(
  overlay.querySelector(".slow-ia-overlay-reply")?.textContent === "Respuesta corta.",
  "T03: reply rendered in overlay",
);

hideSlowIAOverlay();
assert(overlay.hidden, "T03: overlay hidden after dismiss");
assert(!isSlowIAOverlayOpen(), "T03: overlay open flag cleared");
assert(document.activeElement === page, "T03: focus returns to reader page");

showSlowIAOverlay({ query: "Q", loading: true });
assert(
  overlay.querySelector(".slow-ia-overlay-reply")?.textContent === "Pensando…",
  "T03: loading state in overlay",
);
hideSlowIAOverlay();

// --- CSS contract ---
const css = await readFile(new URL("../src/css/slow-mode.css", import.meta.url), "utf8");
assert(css.includes(".slow-ia-overlay"), "T03: overlay CSS present");
assert(css.includes(".slow-ia-overlay-panel"), "T03: overlay panel CSS present");

console.log(`\n20260606_t03-ia-overlay: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
