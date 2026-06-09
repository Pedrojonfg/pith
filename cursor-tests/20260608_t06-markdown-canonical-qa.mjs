/**
 * T06 — Markdown Canonical quickstart QA closure
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260608_t06-markdown-canonical-qa.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { normalizeStudyMaterial } from "../src/js/input-normalization.js";
import { normalizeDocumentStructure } from "../src/js/normalization/index.js";
import { buildScopeOptions } from "../src/js/slow/headings.js";
import { getScopeText } from "../src/js/slow/reader.js";
import {
  loadSessionForMode,
  splitMaterialIntoBlockChunks,
  storeSessionForMode,
} from "../src/js/session.js";
import { resetStorage } from "./setup-dom.mjs";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
globalThis.DOMParser = dom.window.DOMParser;
globalThis.Node = dom.window.Node;

const HTML_TAG_RE = /<[a-z][\s\S]*>/i;
const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "legacy-html-min-session.json",
);

function assertNoHtmlTags(text, label) {
  assert.ok(!HTML_TAG_RE.test(String(text || "")), `${label}: no HTML tags in output`);
}

// Quickstart — Manual: HTML Word → markdown + scope picker ≥2 options
async function testQuickstartHtmlWordUpload() {
  const html = `<p class="Heading1">Capítulo 1</p><p>Texto.</p>`;
  const { normalizedFormat, normalizedContent } = await normalizeStudyMaterial(html, "html");
  assert.equal(normalizedFormat, "markdown");
  assertNoHtmlTags(normalizedContent, "Word HTML upload");
  assert.match(normalizedContent, /#+ Capítulo 1/);
  assert.match(normalizedContent, /Texto/);

  const scopes = buildScopeOptions(normalizedContent, "markdown");
  assert.ok(scopes.length >= 2, "scope picker should expose full + heading options");
}

// Quickstart — Manual: Slow reader sin tags
async function testQuickstartSlowReaderNoTags() {
  const html = "<html><body><h1>Chapter</h1><p>Readable body.</p></body></html>";
  const { normalizedFormat, normalizedContent } = await normalizeStudyMaterial(html, "html");
  assert.equal(normalizedFormat, "markdown");

  const session = {
    studyMode: "slow",
    slow: {
      normalizedTextFull: normalizedContent,
      normalizedFormat,
      readingScope: null,
    },
  };
  const scopeText = getScopeText(session);
  assertNoHtmlTags(scopeText, "slow reader scope text");
  assert.match(scopeText, /Chapter/);
  assert.match(scopeText, /Readable body/);
}

// Quickstart — Manual: RSVP HTML upload (material chunks without HTML tags)
async function testQuickstartRsvpHtmlUploadChunks() {
  const html = "<html><body><p>Alpha paragraph.</p><p>Beta paragraph.</p></body></html>";
  const { normalizedContent } = await normalizeStudyMaterial(html, "html");
  assertNoHtmlTags(normalizedContent, "RSVP normalized material");

  const chunks = splitMaterialIntoBlockChunks(normalizedContent, 2);
  assert.equal(chunks.length, 2);
  for (const [i, chunk] of chunks.entries()) {
    assertNoHtmlTags(chunk, `RSVP chunk ${i + 1}`);
    assert.ok(chunk.trim().length > 0);
  }
}

// Quickstart — Manual: Sesión legacy (load, scope picker, re-save → markdown)
function testQuickstartLegacySessionResave() {
  resetStorage();
  const legacy = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  assert.equal(legacy.slow.normalizedFormat, "html_min");

  storeSessionForMode("slow", legacy);
  const loaded = loadSessionForMode("slow");
  assert.equal(loaded.slow.normalizedFormat, "markdown");
  assert.equal(loaded.slow._migratedFromHtmlMin, true);

  const scopes = buildScopeOptions(loaded.slow.normalizedTextFull, loaded.slow.normalizedFormat);
  assert.ok(scopes.length >= 2, "legacy session scope picker works after migration");
  assertNoHtmlTags(loaded.slow.normalizedTextFull, "migrated session text");

  storeSessionForMode("slow", loaded);
  const resaved = loadSessionForMode("slow");
  assert.equal(resaved.slow.normalizedFormat, "markdown");
  assert.equal(resaved.slow._migratedFromHtmlMin, true);
}

// Failure signal guard — pipeline must not emit html_min
async function testPipelineNeverEmitsHtmlMin() {
  const result = await normalizeDocumentStructure({
    format: "html",
    rawContent: "<h2>Guard</h2><p>Check.</p>",
  });
  assert.equal(result.normalizedFormat, "markdown");
  assert.notEqual(result.normalizedFormat, "html_min");
  assertNoHtmlTags(result.normalizedContent, "pipeline output");
}

await testQuickstartHtmlWordUpload();
await testQuickstartSlowReaderNoTags();
await testQuickstartRsvpHtmlUploadChunks();
testQuickstartLegacySessionResave();
await testPipelineNeverEmitsHtmlMin();

console.log("20260608_t06-markdown-canonical-qa: all tests passed");
