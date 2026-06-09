import assert from "node:assert/strict";
import { matchOutlineToBlocks } from "../src/js/normalization/pdf-outline.js";
import { inferHeadings } from "../src/js/normalization/infer-headings.js";
import { stripArtifacts, isArtifact } from "../src/js/normalization/strip-artifacts.js";
import { buildScopeOptions, buildEqualLengthSections } from "../src/js/slow/headings.js";
import { emitMarkdown, dehyphenate } from "../src/js/normalization/emit-markdown.js";
import { createTextBlock, resetBlockIdSequence } from "../src/js/normalization/types.js";

function fixture1OutlineBook() {
  resetBlockIdSequence();
  const outline = [
    { title: "Introducción", pageIndex: 9, level: 1 },
    { title: "Capítulo 1", pageIndex: 12, level: 1 },
  ];
  const blocks = [
    createTextBlock({ text: "Introducci6n", source: "pdf", pageIndex: 9 }),
    createTextBlock({ text: "Capítulo 1", source: "pdf", pageIndex: 12 }),
  ];
  const headings = matchOutlineToBlocks(outline, blocks);
  assert.equal(headings.length, 2);
  assert.ok(headings.every((h) => h.source === "outline"));

  const { headings: inferred } = inferHeadings(blocks, {
    outline: headings,
    outlineCoverage: 1.0,
  });
  assert.ok(!inferred.some((h) => h.source === "pattern"));

  const { markdown } = emitMarkdown(blocks, inferred);
  const options = buildScopeOptions(markdown, "markdown", { documentType: "book" });
  assert.ok(!options.some((o) => o.label === "ATE" || o.label === "~II~"));
}

function fixture3PlainTxt() {
  const text = "word ".repeat(3000).trim();
  const sections = buildEqualLengthSections(text, { targetChunkSize: 5000, labelPrefix: "Sección" });
  assert.ok(sections.length >= 1);
  const options = buildScopeOptions(text, "markdown", { fallbackSections: sections });
  assert.equal(options[0].label, "Full document");
  assert.ok(options.some((o) => o.label.startsWith("Sección")));
}

function fixture4HtmlHeadings() {
  const body = "Content paragraph. ".repeat(30);
  const htmlText = `# Title\n\n${body}\n\n## Sub\n\n${body}`;
  const options = buildScopeOptions(htmlText, "markdown");
  assert.ok(options.length >= 3);
}

function testArtifactsStripped() {
  resetBlockIdSequence();
  const blocks = [
    createTextBlock({ text: "~II~", source: "pdf", pageIndex: 1 }),
    createTextBlock({ text: "Real heading", source: "pdf", pageIndex: 10, fontSize: 18 }),
  ];
  const { blocks: out } = stripArtifacts(blocks, { frontMatterEnd: 8 });
  assert.equal(out[0].kind, "artifact");
  assert.equal(out[1].kind, "paragraph");
}

function testDehyphenationInPipeline() {
  const out = dehyphenate("foo-\nbar baz");
  assert.ok(!/\w-\n[a-záéíóúüñ]/u.test(out));
}

function testNoArtifactLabelsInScope() {
  assert.ok(isArtifact({ text: "PAIDOS", pageIndex: 2 }, 5));
}

fixture1OutlineBook();
fixture3PlainTxt();
fixture4HtmlHeadings();
testArtifactsStripped();
testDehyphenationInPipeline();
testNoArtifactLabelsInScope();

console.log("20260609_t06-regression-integration: all tests passed");
