import assert from "node:assert/strict";
import {
  SUPPORTED_INPUT_FORMATS,
  UnsupportedFormatError,
  cleanupMarkdown,
  detectFormatFromFilename,
  plainTextToMarkdown,
  toMinimalHtml,
  normalizeStudyMaterial,
} from "../src/js/input-normalization.js";

function testDetectFormat() {
  assert.equal(detectFormatFromFilename("notes.md"), "md");
  assert.equal(detectFormatFromFilename("PAGE.HTML"), "html");
  assert.equal(detectFormatFromFilename("doc.pdf"), "pdf");
  assert.equal(detectFormatFromFilename("readme.txt"), "txt");
  assert.equal(detectFormatFromFilename("slides.docx"), null);
  assert.equal(detectFormatFromFilename("noext"), null);
}

async function testUnsupportedFormat() {
  await assert.rejects(
    () => normalizeStudyMaterial("x", "docx"),
    (err) => err instanceof UnsupportedFormatError && err.code === "unsupported_format",
  );
}

function testHtmlMinimalStripsCssJs() {
  const html = `<!doctype html><html><head><style>body{color:red}</style><script>alert(1)</script></head><body><p onclick="x()">Hello</p><script>bad()</script></body></html>`;
  const out = toMinimalHtml(html);
  assert.ok(!/script/i.test(out), "script tags removed");
  assert.ok(!/style/i.test(out), "style blocks removed");
  assert.ok(!/onclick/i.test(out), "event handlers removed");
  assert.match(out, /<p>Hello<\/p>/);
}

function testTxtToMarkdown() {
  const md = plainTextToMarkdown("Line one.\n\nLine two.");
  assert.equal(md, "Line one.\n\nLine two.");
}

function testMdCleanup() {
  const md = cleanupMarkdown("# Title\n\n<script>evil()</script>\n\nBody.");
  assert.ok(!md.includes("<script>"));
  assert.match(md, /# Title/);
}

async function testHtmlNormalize() {
  const { normalizedFormat, normalizedContent } = await normalizeStudyMaterial(
    "<html><body><p>Hi</p></body></html>",
    "html",
  );
  assert.equal(normalizedFormat, "markdown");
  assert.ok(!/<[a-z][\s\S]*>/i.test(normalizedContent), "no HTML tags in normalized output");
  assert.match(normalizedContent, /Hi/);
}

async function testTxtNormalize() {
  const { normalizedFormat, normalizedContent } = await normalizeStudyMaterial(
    "Alpha.\n\nBeta.",
    "txt",
  );
  assert.equal(normalizedFormat, "markdown");
  assert.equal(normalizedContent, "Alpha.\n\nBeta.");
}

function testSupportedList() {
  assert.deepEqual([...SUPPORTED_INPUT_FORMATS], ["pdf", "html", "txt", "md"]);
}

testDetectFormat();
await testUnsupportedFormat();
testHtmlMinimalStripsCssJs();
testTxtToMarkdown();
testMdCleanup();
await testHtmlNormalize();
await testTxtNormalize();
testSupportedList();

console.log("20260527_t18-input-normalization: all tests passed");
