/**
 * T04 — headings.js markdown primary, html_min legacy
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260608_t04-headings-markdown.mjs
 */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { normalizeDocumentStructure } from "../src/js/normalization/index.js";
import { buildScopeOptions, parseHeadings } from "../src/js/slow/headings.js";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
globalThis.DOMParser = dom.window.DOMParser;
globalThis.Node = dom.window.Node;

function testParseH4Markdown() {
  const parsed = parseHeadings("#### Subsection\n\nBody.", "markdown");
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].label, "Subsection");
  assert.equal(parsed[0].level, 4);
  assert.equal(parsed[0].kind, "section");
  assert.equal(parsed[0].charStart, 0);
  assert.ok(parsed[0].charEnd > parsed[0].charStart);
}

function testDefaultFormatIsMarkdown() {
  const text = "# Chapter\n\n## Section\n\nText.";
  const explicit = parseHeadings(text, "markdown");
  const omitted = parseHeadings(text);
  const unknown = parseHeadings(text, "plain");
  assert.deepEqual(omitted, explicit);
  assert.deepEqual(unknown, explicit);
  assert.equal(explicit[0].kind, "chapter");
  assert.equal(explicit[1].kind, "section");
}

function testLegacyHtmlMin() {
  const html = "<h1>Title</h1><p>Intro.</p><h3>Deep</h3><p>More.</p>";
  const parsed = parseHeadings(html, "html_min");
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].label, "Title");
  assert.equal(parsed[0].kind, "chapter");
  assert.equal(parsed[1].label, "Deep");
  assert.equal(parsed[1].kind, "section");
  assert.equal(parsed[1].level, 3);
}

function testBuildScopeOptionsMarkdown() {
  const body = "Lorem ipsum dolor sit amet. ".repeat(20);
  const md = `# Intro\n\n${body}\n\n## Section A\n\n${body}\n\n## Section B\n\n${body}`;
  const headings = parseHeadings(md, "markdown");
  const scopes = buildScopeOptions(md, "markdown");
  assert.equal(scopes[0].kind, "full");
  assert.ok(scopes.some((s) => s.label === "Section A"));
  const sectionA = scopes.find((s) => s.label === "Section A");
  assert.equal(sectionA.charEnd, headings[2].charStart);
}

async function testScopePickerHtmlUpload() {
  const body = "Texto del cuerpo con suficiente longitud. ".repeat(15);
  const html = `<html><body><p class="Heading1">Capítulo 1</p><p>${body}</p><p class="Heading2">Sección A</p><p>${body}</p></body></html>`;
  const { normalizedContent } = await normalizeDocumentStructure({ rawContent: html, format: "html" });
  assert.match(normalizedContent, /^# Capítulo 1/m);
  const options = buildScopeOptions(normalizedContent, "markdown");
  assert.ok(options.length >= 2, "HTML-upload markdown should yield heading scopes");
  assert.ok(options.some((o) => o.label === "Capítulo 1"));
}

function testEdgeEmptyAndNoHeadings() {
  assert.equal(parseHeadings("", "markdown").length, 0);
  assert.equal(parseHeadings("plain paragraph only", "markdown").length, 0);
  const scopes = buildScopeOptions("no headings here");
  assert.equal(scopes.length, 1);
  assert.equal(scopes[0].kind, "full");
}

function testFailureNullishInput() {
  assert.doesNotThrow(() => parseHeadings(null));
  assert.doesNotThrow(() => parseHeadings(undefined, "html_min"));
  assert.doesNotThrow(() => buildScopeOptions(null));
  assert.equal(parseHeadings(null).length, 0);
}

testParseH4Markdown();
testDefaultFormatIsMarkdown();
testLegacyHtmlMin();
testBuildScopeOptionsMarkdown();
await testScopePickerHtmlUpload();
testEdgeEmptyAndNoHeadings();
testFailureNullishInput();

console.log("20260608_t04-headings-markdown: all tests passed");
