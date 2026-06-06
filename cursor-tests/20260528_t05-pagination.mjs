/**
 * T05 — viewport pagination
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260528_t05-pagination.mjs
 */
import { JSDOM } from "jsdom";
import {
  charOffsetToPage,
  closestPageAfterRecompute,
  computePageBreakpoints,
  getPageCount,
  getPageSlice,
  invalidatePaginationCache,
} from "../src/js/slow/pagination.js";

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
globalThis.HTMLElement = dom.window.HTMLElement;

function makeContainer(w, h) {
  const el = document.createElement("div");
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  Object.defineProperty(el, "clientWidth", { value: w });
  Object.defineProperty(el, "clientHeight", { value: h });
  document.body.appendChild(el);
  return el;
}

invalidatePaginationCache();

const shortText = "Word ".repeat(200).trim();
const container = makeContainer(400, 120);
const typography = { fontSizePx: 16, lineHeight: 1.5, fontFamily: "sans-serif" };
const bp1 = computePageBreakpoints(shortText, container, typography);
assert(getPageCount(bp1) >= 2, "T05: short text splits into multiple pages");

const slice0 = getPageSlice(bp1, 0);
assert(slice0.charEnd > slice0.charStart, "T05: first page has content");
assert(charOffsetToPage(bp1, slice0.charStart) === 0, "T05: charOffsetToPage start");

const bp2 = computePageBreakpoints(shortText, container, { ...typography, fontSizePx: 24 });
assert(getPageCount(bp2) >= getPageCount(bp1), "T05: larger font → more or equal pages");
const preserved = closestPageAfterRecompute(bp1, 1, bp2);
assert(Number.isFinite(preserved), "T05: closest page after recompute");

console.log(`\n20260528_t05-pagination: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
