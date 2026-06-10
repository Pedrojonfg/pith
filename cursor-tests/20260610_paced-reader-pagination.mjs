/**
 * Paced reader (fast mode normal reading) — viewport pagination regression
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260610_paced-reader-pagination.mjs
 */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computePageBreakpoints,
  getPageCount,
  getPageSlice,
  invalidatePaginationCache,
} from "../src/js/slow/pagination.js";
import { markdownToHtml } from "../src/js/markdown.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let passed = 0;
let failed = 0;

function ok(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${msg}`);
}

const TYPO = { fontSizePx: 16, lineHeight: 1.5, fontFamily: "sans-serif" };

const LONG_TEXT = `${"This is study block prose for RSVP and paced reading. ".repeat(20).trim()}\n\n${"Second paragraph with additional words for pagination. ".repeat(15).trim()}`;

function fixedPacedMeasureContent(typography, columnWidth) {
  const widthPx = Math.max(200, Math.floor(Number(columnWidth) || 0));
  return (el, slice) => {
    el.className = "md-content";
    el.style.fontSize = `${typography.fontSizePx}px`;
    el.style.lineHeight = String(typography.lineHeight);
    el.style.fontFamily = typography.fontFamily;
    el.style.whiteSpace = "normal";
    el.style.wordBreak = "break-word";
    el.style.width = `${widthPx}px`;
    el.style.height = "auto";
    el.style.overflow = "visible";
    el.style.boxSizing = "border-box";
    el.innerHTML = markdownToHtml(slice);
  };
}

function bootDom(html = "<!doctype html><html><body></body></html>") {
  const dom = new JSDOM(html, { url: "http://127.0.0.1:3456/" });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.HTMLElement = dom.window.HTMLElement;
  return dom;
}

function makeMeasureHost(dom, widthPx) {
  const host = dom.window.document.createElement("div");
  host.setAttribute("data-paced-measure-host", "1");
  host.style.width = `${widthPx}px`;
  Object.defineProperty(host, "clientWidth", { value: widthPx, configurable: true });
  dom.window.document.body.appendChild(host);
  return host;
}

function testFixedMeasureHostPaginatesWithSubstantialSlices() {
  const dom = bootDom();
  invalidatePaginationCache();
  const columnWidth = 560;
  const host = makeMeasureHost(dom, columnWidth);
  const bp = computePageBreakpoints(LONG_TEXT, host, TYPO, {
    availableHeight: 220,
    measureMode: "md-paced",
    measureContent: fixedPacedMeasureContent(TYPO, columnWidth),
  });
  const count = getPageCount(bp);
  const firstSlice = getPageSlice(bp, 0);
  const sliceLen = firstSlice.charEnd - firstSlice.charStart;

  ok(count >= 2, "happy path: long text splits into multiple pages");
  ok(sliceLen >= 80, "happy path: first page holds a substantial slice, not one character");
  ok(sliceLen < LONG_TEXT.length, "happy path: first page does not contain entire document");
}

function testNarrowColumnStillPaginatesByWords() {
  const dom = bootDom();
  invalidatePaginationCache();
  const columnWidth = 240;
  const host = makeMeasureHost(dom, columnWidth);
  const bp = computePageBreakpoints(LONG_TEXT, host, TYPO, {
    availableHeight: 180,
    measureMode: "md-paced-narrow",
    measureContent: fixedPacedMeasureContent(TYPO, columnWidth),
  });
  const firstSlice = getPageSlice(bp, 0);
  const sliceLen = firstSlice.charEnd - firstSlice.charStart;

  ok(getPageCount(bp) >= 3, "edge: narrow column still yields multiple pages");
  ok(sliceLen >= 40, "edge: narrow column first slice is word-sized, not one character");
}

function testEmptyTextSinglePage() {
  const dom = bootDom();
  invalidatePaginationCache();
  const host = makeMeasureHost(dom, 400);
  const bp = computePageBreakpoints("", host, TYPO, {
    availableHeight: 400,
    measureMode: "md-paced",
    measureContent: fixedPacedMeasureContent(TYPO, 400),
  });
  ok(getPageCount(bp) === 1, "failure/empty: single placeholder page for empty text");
}

function testSourceContracts() {
  const src = readFileSync(join(root, "src/js/paced-reader.js"), "utf8");
  ok(src.includes("data-paced-measure-host"), "contract: dedicated off-screen measure host");
  ok(src.includes('measureMode: "md-paced"'), "contract: paced-specific pagination cache key");
  ok(src.includes("ensurePacedMeasureHost"), "contract: measure host helper");
  ok(src.includes("resolvePacedColumnWidth"), "contract: explicit column width resolver");
  ok(src.includes('el.style.width = `${widthPx}px`'), "contract: pixel width on measure element");
  ok(!src.includes('el.style.width = "100%"'), "contract: removed 100% width on measure element");
  ok(src.includes("requestAnimationFrame(() => renderPacedReaderPage())"), "contract: defers first render");
  ok(src.includes("minSensible"), "contract: ignores bogus tiny content heights");
}

function testPageCountMuchLessThanCharCount() {
  const dom = bootDom();
  invalidatePaginationCache();
  const columnWidth = 560;
  const host = makeMeasureHost(dom, columnWidth);
  const bp = computePageBreakpoints(LONG_TEXT, host, TYPO, {
    availableHeight: 220,
    measureMode: "md-paced-ratio",
    measureContent: fixedPacedMeasureContent(TYPO, columnWidth),
  });
  ok(
    getPageCount(bp) < LONG_TEXT.length / 20,
    "failure guard: page count is not char-by-char (pages << characters)",
  );
}

testFixedMeasureHostPaginatesWithSubstantialSlices();
testNarrowColumnStillPaginatesByWords();
testEmptyTextSinglePage();
testSourceContracts();
testPageCountMuchLessThanCharCount();

console.log(`\n20260610_paced-reader-pagination: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
