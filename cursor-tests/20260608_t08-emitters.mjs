import assert from "node:assert/strict";
import { emitMarkdown } from "../src/js/normalization/emit-markdown.js";
import { emitHtmlMin } from "../src/js/normalization/emit-html-min.js";
import { createTextBlock, resetBlockIdSequence } from "../src/js/normalization/types.js";
import { parseHeadings } from "../src/js/slow/headings.js";

function testEmitMarkdown() {
  resetBlockIdSequence();
  const b1 = createTextBlock({ text: "Title", source: "txt" });
  const b2 = createTextBlock({ text: "Body text.", source: "txt" });
  const headings = [
    { label: "Title", level: 2, score: 50, source: "pattern", blockId: b1.id, charStart: 0, charEnd: 0 },
  ];
  const { markdown, headings: withOffsets } = emitMarkdown([b1, b2], headings);
  assert.match(markdown, /^## Title/m);
  assert.match(markdown, /Body text/);
  assert.ok(withOffsets[0].charStart >= 0);
  const parsed = parseHeadings(markdown, "markdown");
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].label, "Title");
}

function testEmitHtmlMin() {
  resetBlockIdSequence();
  const b1 = createTextBlock({ text: "Capítulo", source: "html", kind: "heading" });
  const b2 = createTextBlock({ text: "Párrafo.", source: "html" });
  const headings = [
    { label: "Capítulo", level: 1, score: 90, source: "html-tag", blockId: b1.id, charStart: 0, charEnd: 0 },
  ];
  const { htmlMin } = emitHtmlMin([b1, b2], headings);
  assert.match(htmlMin, /<h1>Capítulo<\/h1>/);
  assert.match(htmlMin, /<p>Párrafo.<\/p>/);
  const parsed = parseHeadings(htmlMin, "html_min");
  assert.equal(parsed.length, 1);
}

function testH4Markdown() {
  resetBlockIdSequence();
  const b = createTextBlock({ text: "Deep", source: "txt" });
  const { markdown } = emitMarkdown([b], [
    { label: "Deep", level: 4, score: 40, source: "pattern", blockId: b.id, charStart: 0, charEnd: 0 },
  ]);
  assert.match(markdown, /^#### Deep/m);
  const parsed = parseHeadings(markdown, "markdown");
  assert.equal(parsed[0].level, 4);
}

testEmitMarkdown();
testEmitHtmlMin();
testH4Markdown();

console.log("20260608_t08-emitters: all tests passed");
