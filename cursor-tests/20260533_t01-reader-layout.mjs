/**
 * T01 — Slow Reader full-bleed DOM layout
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260533_t01-reader-layout.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");

function testReaderOutsideContainerHappyPath() {
  const readerIdx = html.indexOf('id="screenSlowReader"');
  assert.ok(readerIdx > 0, "screenSlowReader exists");
  const mainOpen = html.lastIndexOf("<main", readerIdx);
  const mainClose = html.indexOf("</main>", readerIdx);
  assert.ok(mainOpen >= 0 && mainClose > readerIdx, "reader inside main");
  const containerCloseBeforeReader = html.lastIndexOf("</div>", readerIdx);
  const containerOpenInMain = html.indexOf('<div class="container">', mainOpen);
  assert.ok(
    containerOpenInMain >= 0 && containerCloseBeforeReader > containerOpenInMain,
    "reader is after .container closing tag",
  );
  const between = html.slice(containerCloseBeforeReader, readerIdx);
  assert.ok(!between.includes('id="screenSlowReader"'), "reader not nested in container");
}

function testReaderNotInsideMainContainerEdge() {
  const mainStart = html.indexOf("<main");
  const mainEnd = html.indexOf("</main>", mainStart);
  const mainHtml = html.slice(mainStart, mainEnd);
  const readerIdx = mainHtml.indexOf('id="screenSlowReader"');
  const containerOpen = mainHtml.indexOf('<div class="container">');
  const containerClose = mainHtml.indexOf("</div>", mainHtml.indexOf('id="screenClozeStudy"'));
  assert.ok(readerIdx > containerClose, "reader must be sibling after main .container");
  assert.ok(containerOpen < containerClose && containerClose < readerIdx);
}

function testSlowReaderActiveInUiJs() {
  const ui = readFileSync(join(root, "src/js/ui.js"), "utf8");
  assert.match(ui, /slow-reader-active/);
  assert.match(ui, /showSlowReader/);
}

function testMainCssChromeRules() {
  const css = readFileSync(join(root, "src/css/main.css"), "utf8");
  assert.match(css, /body\.slow-reader-active main/);
  assert.match(css, /body\.slow-reader-active \.corner-plus/);
}

testReaderOutsideContainerHappyPath();
testReaderNotInsideMainContainerEdge();
testSlowReaderActiveInUiJs();
testMainCssChromeRules();
console.log("20260533_t01-reader-layout: all passed");
