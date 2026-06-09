import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { normalizeDocumentStructure } from "../src/js/normalization/index.js";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
globalThis.DOMParser = dom.window.DOMParser;
globalThis.Node = dom.window.Node;
import { normalizeStudyMaterial } from "../src/js/input-normalization.js";
import { parseHeadings, buildScopeOptions } from "../src/js/slow/headings.js";

async function testTxtSections() {
  const raw = `1. Introducción

Párrafo de cuerpo largo con varias oraciones para el test.

1.1 Contexto

Más cuerpo del documento.`;
  const result = await normalizeDocumentStructure({ rawContent: raw, format: "txt" });
  assert.ok(result.normalizedContent);
  assert.match(result.normalizedContent, /#+ Introducción/);
  assert.ok(result.structure.headingCount >= 1);
}

async function testHtmlWordExport() {
  const html = `<html><body><p class="Heading1">Capítulo 1</p><p>Texto del cuerpo.</p></body></html>`;
  const result = await normalizeDocumentStructure({ rawContent: html, format: "html" });
  assert.equal(result.normalizedFormat, "markdown");
  assert.ok(!/<[a-z][\s\S]*>/i.test(result.normalizedContent || ""), "no HTML tags in output");
  assert.match(result.normalizedContent, /#+ Capítulo 1/);
  assert.match(result.normalizedContent, /Texto del cuerpo/);
  assert.ok(result.structure.headingCount >= 1);
}

async function testStripPageNums() {
  const blocks = await normalizeDocumentStructure({
    rawContent: "Intro\n\n42\n\nBody paragraph here.",
    format: "txt",
  });
  assert.ok(!/^\s*42\s*$/m.test(blocks.normalizedContent || ""));
}

async function testLowConfidenceWarning() {
  const longBody = "word ".repeat(1200);
  const result = await normalizeDocumentStructure({ rawContent: longBody, format: "txt" });
  assert.ok(result.structure.warnings.includes("low_heading_confidence"));
}

async function testNormalizeStudyMaterialIntegration() {
  const { normalizedFormat, normalizedContent, warnings, structure } = await normalizeStudyMaterial(
    "Alpha.\n\nBeta.",
    "txt",
  );
  assert.equal(normalizedFormat, "markdown");
  assert.equal(normalizedContent, "Alpha.\n\nBeta.");
  assert.ok(Array.isArray(warnings));
  assert.ok(structure);
}

async function testScopePicker() {
  const body = "Lorem ipsum dolor sit amet. ".repeat(20);
  const raw = `## Chapter One

${body}

## Chapter Two

${body}`;
  const { normalizedContent } = await normalizeDocumentStructure({ rawContent: raw, format: "md" });
  const options = buildScopeOptions(normalizedContent, "markdown");
  assert.ok(options.length >= 3, "scope options should include headings above MIN_SCOPE_CHARS");
}

async function testParseH4() {
  const parsed = parseHeadings("#### Subsection\n\nText", "markdown");
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].level, 4);
}

await testTxtSections();
await testHtmlWordExport();
await testStripPageNums();
await testLowConfidenceWarning();
await testNormalizeStudyMaterialIntegration();
await testScopePicker();
testParseH4();

console.log("20260608_t01-structure-inference: all tests passed");
