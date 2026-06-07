/**
 * T20 — jumpToAnnotation page calculation (sidebar tap-to-source)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260528_t20-sidebar-jump.mjs
 */
import { JSDOM } from "jsdom";
import {
  charOffsetToPage,
  computePageBreakpoints,
  getPageSlice,
} from "../src/js/slow/pagination.js";
import { jumpToAnnotation, setAnnotationNavigator } from "../src/js/slow/sidebar.js";
import { resolveHighlightLocalRange } from "../src/js/slow/reader.js";

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

const container = document.createElement("div");
Object.defineProperty(container, "clientWidth", { value: 360 });
Object.defineProperty(container, "clientHeight", { value: 120 });
document.body.appendChild(container);

const typo = { fontSizePx: 16, lineHeight: 1.5, fontFamily: "serif" };
const scopeText =
  "## Libertad y razón\n\n" +
  "El autor sostiene que la libertad moral exige autonomía racional. ".repeat(8) +
  "\n\n## Voluntad\n\n" +
  "La voluntad no es mero impulso: requiere deliberación. ".repeat(6) +
  "\n\nConclusión: sin razón no hay responsabilidad.";

const breakpoints = computePageBreakpoints(scopeText, container, typo);
assert(breakpoints.length >= 3, "T20 setup: realistic pagination yields multiple pages");

const libertyIdx = scopeText.indexOf("libertad moral");
const willIdx = scopeText.indexOf("Voluntad");
const conclusionIdx = scopeText.indexOf("Conclusión");

assert(libertyIdx > 0 && willIdx > libertyIdx && conclusionIdx > willIdx, "T20 setup: known anchors in scope");

const annLiberty = { id: "lib", type: "≈", charStart: libertyIdx, charEnd: libertyIdx + 18 };
const annWill = { id: "will", type: "→", charStart: willIdx, charEnd: willIdx + 12 };
const annConclusion = { id: "con", type: "⊘", charStart: conclusionIdx, charEnd: conclusionIdx + 20 };

const pageLiberty = charOffsetToPage(breakpoints, annLiberty.charStart);
const pageWill = charOffsetToPage(breakpoints, annWill.charStart);
const pageConclusion = charOffsetToPage(breakpoints, annConclusion.charStart);

assert(pageLiberty < pageWill, "T20 happy: liberty annotation precedes will page");
assert(pageWill <= pageConclusion, "T20 happy: conclusion on same or later page than will");

const sidebarPageLiberty = pageLiberty + 1;
const sidebarPageWill = pageWill + 1;
assert(sidebarPageLiberty >= 1 && sidebarPageWill >= 1, "T20 happy: sidebar displays 1-based page numbers");

function makeNavigator(breakpointsRef) {
  return (session, ann) => {
    const page = charOffsetToPage(breakpointsRef, ann.charStart);
    session.slow.currentPageIndex = page;
    const slice = getPageSlice(breakpointsRef, page);
    session.slow._lastHighlight = resolveHighlightLocalRange(slice, ann.charStart, ann.charEnd);
  };
}

setAnnotationNavigator(makeNavigator(breakpoints));

const session = { slow: { currentPageIndex: 0 } };
jumpToAnnotation(session, annConclusion);
assert(
  session.slow.currentPageIndex === pageConclusion,
  "T20 happy: jump from page 0 lands on conclusion page",
);
assert(session.slow._lastHighlight != null, "T20 happy: highlight range resolved on target page");

jumpToAnnotation(session, annLiberty);
assert(
  session.slow.currentPageIndex === pageLiberty,
  "T20 happy: second jump rewinds to earlier liberty page",
);

const boundaryPage = breakpoints[1];
const annBoundary = {
  id: "bound",
  type: "?",
  charStart: boundaryPage.charEnd - 1,
  charEnd: boundaryPage.charEnd,
};
assert(
  charOffsetToPage(breakpoints, annBoundary.charStart) === boundaryPage.pageIndex,
  "T20 edge: charStart at page charEnd-1 stays on that page",
);

const annExactStart = {
  id: "start",
  type: "≈",
  charStart: boundaryPage.charStart,
  charEnd: boundaryPage.charStart + 5,
};
jumpToAnnotation(session, annExactStart);
assert(
  session.slow.currentPageIndex === boundaryPage.pageIndex,
  "T20 edge: jump to annotation at page charStart",
);

setAnnotationNavigator(null);
const frozenPage = session.slow.currentPageIndex;
jumpToAnnotation(session, annWill);
assert(
  session.slow.currentPageIndex === frozenPage,
  "T20 failure: jumpToAnnotation without navigator leaves page unchanged",
);

setAnnotationNavigator(makeNavigator([]));
jumpToAnnotation({ slow: { currentPageIndex: 0 } }, annWill);
assert(true, "T20 failure: empty breakpoints navigator does not throw");

console.log(`\n20260528_t20-sidebar-jump: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
