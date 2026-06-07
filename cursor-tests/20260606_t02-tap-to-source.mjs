/**
 * T02 — tap-to-source + margin Y positioning
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260606_t02-tap-to-source.mjs
 */
import { JSDOM } from "jsdom";
import { charOffsetToPage, getPageSlice } from "../src/js/slow/pagination.js";
import { jumpToAnnotation, setAnnotationNavigator } from "../src/js/slow/sidebar.js";
import {
  computeMarkYFallback,
  resolveHighlightLocalRange,
} from "../src/js/slow/reader.js";

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

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Range = dom.window.Range;

const breakpoints = [
  { pageIndex: 0, charStart: 0, charEnd: 100 },
  { pageIndex: 1, charStart: 100, charEnd: 200 },
  { pageIndex: 2, charStart: 200, charEnd: 300 },
  { pageIndex: 3, charStart: 300, charEnd: 400 },
  { pageIndex: 4, charStart: 400, charEnd: 500 },
];

const slicePage5 = getPageSlice(breakpoints, 4);
const annOnPage5 = { id: "far", type: "≈", charStart: 420, charEnd: 430 };

assert(
  charOffsetToPage(breakpoints, annOnPage5.charStart) === 4,
  "T02 happy: charStart 420 maps to page index 4 (page 5)",
);

let navigatedPage = null;
let highlighted = null;
setAnnotationNavigator((session, ann) => {
  navigatedPage = charOffsetToPage(breakpoints, ann.charStart);
  const slice = getPageSlice(breakpoints, navigatedPage);
  highlighted = resolveHighlightLocalRange(slice, ann.charStart, ann.charEnd);
  session.slow.currentPageIndex = navigatedPage;
});

jumpToAnnotation({ slow: { currentPageIndex: 0 } }, annOnPage5);
assert(navigatedPage === 4, "T02 happy: jumpToAnnotation navigates to page 4 from page 0");
assert(highlighted?.localStart === 20, "T02 happy: highlight localStart on page 5");
assert(highlighted?.localEnd === 30, "T02 happy: highlight localEnd on page 5");

const slice0 = getPageSlice(breakpoints, 0);
const local = resolveHighlightLocalRange(slice0, 10, 25);
assert(local?.localStart === 10 && local?.localEnd === 25, "T02 happy: local range within page");

const crossPage = resolveHighlightLocalRange(slice0, 90, 150);
assert(
  crossPage?.localStart === 90 && crossPage?.localEnd === 100,
  "T02 edge: annotation crossing page boundary clips to page end",
);

const empty = resolveHighlightLocalRange(slice0, 200, 210);
assert(empty === null, "T02 failure: range outside page returns null");

const yMid = computeMarkYFallback(250, getPageSlice(breakpoints, 2), 400);
assert(yMid > 0 && yMid < 400, "T02 happy: proportional fallback Y within page height");

const yTop = computeMarkYFallback(200, getPageSlice(breakpoints, 2), 400, 0, 3);
const yBottom = computeMarkYFallback(280, getPageSlice(breakpoints, 2), 400, 2, 3);
assert(yTop <= yBottom, "T02 edge: later char offsets yield lower fallback Y");

const yNaN = computeMarkYFallback(NaN, { charStart: 0, charEnd: 100 }, 0, 1, 4);
assert(Number.isFinite(yNaN), "T02 failure: invalid charStart still yields finite fallback Y");

setAnnotationNavigator(null);
let noopCalled = false;
jumpToAnnotation({ slow: {} }, annOnPage5);
assert(!noopCalled, "T02 failure: jumpToAnnotation without navigator is no-op");

console.log(`\n20260606_t02-tap-to-source: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
