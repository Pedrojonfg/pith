/**
 * T05 — markdown selection → plain offset mapping
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260533_t02-selection-offsets.mjs
 */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  buildVisibleToSourceMap,
  sourceOffsetToVisible,
  selectionToScopeOffsetsFromRendered,
} from "../src/js/slow/reader.js";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
globalThis.document = dom.window.document;
globalThis.NodeFilter = dom.window.NodeFilter;
globalThis.window = dom.window;
globalThis.Range = dom.window.Range;
const { getSelection } = dom.window;

function testBoldMappingHappyPath() {
  const source = "Intro **bold word** end.";
  const visible = "Intro bold word end.";
  const map = buildVisibleToSourceMap(source, visible);
  assert.equal(map[6], source.indexOf("bold"));
  const visBold = sourceOffsetToVisible(source, visible, source.indexOf("bold"));
  assert.equal(visible.slice(visBold, visBold + 4), "bold");
}

function testBoldMappingEdgeEmptyVisible() {
  const map = buildVisibleToSourceMap("**x**", "");
  assert.deepEqual(map, []);
}

function testSelectionOffsetsFromRenderedHappyPath() {
  const source = "Para **negrita** aquí.";
  const slice = { charStart: 100, charEnd: 100 + source.length };
  const pageEl = document.createElement("div");
  pageEl.innerHTML = "<p>Para <strong>negrita</strong> aquí.</p>";
  document.body.appendChild(pageEl);
  const range = document.createRange();
  const strong = pageEl.querySelector("strong").firstChild;
  range.setStart(strong, 0);
  range.setEnd(strong, strong.length);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  const result = selectionToScopeOffsetsFromRendered(pageEl, slice, source);
  assert.ok(result, "expected selection offsets from rendered markdown");
  assert.equal(result.charStart, 100 + source.indexOf("negrita"));
  assert.equal(result.charEnd, 100 + source.indexOf("negrita") + "negrita".length);
  assert.equal(result.selectedText, "negrita");
}

function testSelectionOffsetsFailureOutsidePage() {
  const pageEl = document.createElement("div");
  pageEl.textContent = "text";
  const other = document.createElement("p");
  other.textContent = "other";
  document.body.appendChild(pageEl);
  document.body.appendChild(other);
  const range = document.createRange();
  range.selectNodeContents(other);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  const result = selectionToScopeOffsetsFromRendered(pageEl, { charStart: 0, charEnd: 4 }, "text");
  assert.equal(result, null);
}

testBoldMappingHappyPath();
testBoldMappingEdgeEmptyVisible();
testSelectionOffsetsFromRenderedHappyPath();
testSelectionOffsetsFailureOutsidePage();
console.log("20260533_t02-selection-offsets: all passed");
