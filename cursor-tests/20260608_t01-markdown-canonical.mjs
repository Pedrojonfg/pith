/**
 * T05 — markdown canonical regression (pipeline + facade)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260608_t01-markdown-canonical.mjs
 */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { normalizeDocumentStructure } from "../src/js/normalization/index.js";
import { emitMarkdown } from "../src/js/normalization/emit-markdown.js";
import { createTextBlock, resetBlockIdSequence } from "../src/js/normalization/types.js";
import { normalizeStudyMaterial } from "../src/js/input-normalization.js";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
globalThis.DOMParser = dom.window.DOMParser;
globalThis.Node = dom.window.Node;

const HTML_TAG_RE = /<[a-z][\s\S]*>/i;

// --- pipeline (normalizeDocumentStructure) ---

async function testPipelineHtmlHappyPath() {
  const result = await normalizeDocumentStructure({
    format: "html",
    rawContent: "<h1>Title</h1><p>Body</p>",
  });
  assert.equal(result.normalizedFormat, "markdown");
  assert.ok(!HTML_TAG_RE.test(result.normalizedContent || ""));
  assert.match(result.normalizedContent, /^# Title/m);
  assert.match(result.normalizedContent, /Body/);
  assert.ok(result.structure);
  assert.ok(Array.isArray(result.structure.warnings));
  assert.ok(result.structure.headingCount >= 1);
}

async function testPipelineTxtStillMarkdown() {
  const result = await normalizeDocumentStructure({
    format: "txt",
    rawContent: "Plain paragraph.",
  });
  assert.equal(result.normalizedFormat, "markdown");
  assert.match(result.normalizedContent, /Plain paragraph/);
}

async function testPipelineHtmlWordExportEdge() {
  const html = `<html><body><p class="Heading1">Capítulo 1</p><p>Texto del cuerpo.</p></body></html>`;
  const result = await normalizeDocumentStructure({ format: "html", rawContent: html });
  assert.equal(result.normalizedFormat, "markdown");
  assert.ok(!HTML_TAG_RE.test(result.normalizedContent || ""));
  assert.match(result.normalizedContent, /#+ Capítulo 1/);
  assert.match(result.normalizedContent, /Texto del cuerpo/);
}

function testPipelineListItemEdge() {
  resetBlockIdSequence();
  const items = [
    createTextBlock({ text: "First item", source: "html", kind: "list-item" }),
    createTextBlock({ text: "Second item", source: "html", kind: "list-item" }),
  ];
  const { markdown } = emitMarkdown(items, []);
  assert.match(markdown, /^- First item/m);
  assert.match(markdown, /- Second item/);
}

async function testPipelineEmptyHtmlEdge() {
  const result = await normalizeDocumentStructure({ format: "html", rawContent: "" });
  assert.equal(result.normalizedFormat, "markdown");
  assert.equal(result.normalizedContent, "");
  assert.ok(result.structure);
  assert.equal(result.structure.headingCount, 0);
}

// --- facade (normalizeStudyMaterial) ---

async function testFacadeHtmlHappyPath() {
  const { normalizedFormat, normalizedContent } = await normalizeStudyMaterial(
    "<html><body><h1>Title</h1><p>Body text.</p></body></html>",
    "html",
  );
  assert.equal(normalizedFormat, "markdown");
  assert.ok(!HTML_TAG_RE.test(normalizedContent));
  assert.match(normalizedContent, /^# Title/m);
  assert.match(normalizedContent, /Body text/);
}

async function testFacadeHtmlWordExportEdge() {
  const html = `<html><body><p class="Heading1">Capítulo 1</p><p>Texto del cuerpo.</p></body></html>`;
  const { normalizedFormat, normalizedContent } = await normalizeStudyMaterial(html, "html");
  assert.equal(normalizedFormat, "markdown");
  assert.ok(!HTML_TAG_RE.test(normalizedContent));
  assert.match(normalizedContent, /#+ Capítulo 1/);
}

async function testFacadeTxtHappyPath() {
  const { normalizedFormat, normalizedContent } = await normalizeStudyMaterial(
    "Alpha.\n\nBeta.",
    "txt",
  );
  assert.equal(normalizedFormat, "markdown");
  assert.equal(normalizedContent, "Alpha.\n\nBeta.");
}

await testPipelineHtmlHappyPath();
await testPipelineTxtStillMarkdown();
await testPipelineHtmlWordExportEdge();
testPipelineListItemEdge();
await testPipelineEmptyHtmlEdge();
await testFacadeHtmlHappyPath();
await testFacadeHtmlWordExportEdge();
await testFacadeTxtHappyPath();

console.log("20260608_t01-markdown-canonical: all tests passed");
