import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
globalThis.DOMParser = dom.window.DOMParser;
globalThis.Node = dom.window.Node;

import {
  NormalizationError,
  UnsupportedFormatError,
  htmlMinToPlainText,
  normalizeStudyMaterial,
  scopeTextForPhase0IA,
} from "../src/js/input-normalization.js";

const HTML_TAG_RE = /<[a-z][\s\S]*>/i;

async function testHtmlHappyPath() {
  const { normalizedFormat, normalizedContent, warnings, structure } = await normalizeStudyMaterial(
    "<html><body><h1>Title</h1><p>Body text.</p></body></html>",
    "html",
  );
  assert.equal(normalizedFormat, "markdown");
  assert.ok(!HTML_TAG_RE.test(normalizedContent));
  assert.match(normalizedContent, /^# Title/m);
  assert.match(normalizedContent, /Body text/);
  assert.ok(Array.isArray(warnings));
  assert.ok(structure);
  assert.equal(typeof structure.heading_count, "number");
  assert.equal(typeof structure.confidence, "string");
  assert.equal(typeof structure.artifacts_removed, "number");
}

async function testTxtHappyPath() {
  const { normalizedFormat, normalizedContent, warnings, structure } = await normalizeStudyMaterial(
    "Alpha.\n\nBeta.",
    "txt",
  );
  assert.equal(normalizedFormat, "markdown");
  assert.equal(normalizedContent, "Alpha.\n\nBeta.");
  assert.ok(Array.isArray(warnings));
  assert.ok(structure);
}

async function testMdHappyPath() {
  const { normalizedFormat, normalizedContent } = await normalizeStudyMaterial(
    "# Heading\n\nParagraph.",
    "md",
  );
  assert.equal(normalizedFormat, "markdown");
  assert.match(normalizedContent, /# Heading/);
  assert.match(normalizedContent, /Paragraph/);
}

async function testHtmlWordExportEdge() {
  const html = `<html><body><p class="Heading1">Capítulo 1</p><p>Texto del cuerpo.</p></body></html>`;
  const { normalizedFormat, normalizedContent } = await normalizeStudyMaterial(html, "html");
  assert.equal(normalizedFormat, "markdown");
  assert.ok(!HTML_TAG_RE.test(normalizedContent));
  assert.match(normalizedContent, /#+ Capítulo 1/);
}

function testLegacyReadPathEdge() {
  const scoped = scopeTextForPhase0IA("<p>Hello</p>", "html_min");
  assert.equal(scoped, htmlMinToPlainText("<p>Hello</p>"));
  assert.equal(scopeTextForPhase0IA("# Title\n\nBody", "markdown"), "# Title\n\nBody");
}

async function testUnsupportedFormatFailure() {
  await assert.rejects(
    () => normalizeStudyMaterial("x", "docx"),
    (err) => err instanceof UnsupportedFormatError && err.code === "unsupported_format",
  );
}

async function testEmptyHtmlFailure() {
  await assert.rejects(
    () => normalizeStudyMaterial("<html><body></body></html>", "html"),
    (err) => err instanceof NormalizationError && err.detectedFormat === "html",
  );
}

async function testPdfWithoutBufferFailure() {
  await assert.rejects(
    () => normalizeStudyMaterial("not-a-buffer", "pdf"),
    (err) => err instanceof NormalizationError && err.detectedFormat === "pdf",
  );
}

await testHtmlHappyPath();
await testTxtHappyPath();
await testMdHappyPath();
await testHtmlWordExportEdge();
testLegacyReadPathEdge();
await testUnsupportedFormatFailure();
await testEmptyHtmlFailure();
await testPdfWithoutBufferFailure();

console.log("20260608_t02-input-normalization-v3: all tests passed");
