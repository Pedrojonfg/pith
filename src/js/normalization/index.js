/**
 * Structure inference pipeline (structure-inference-pipeline.md).
 * @module normalization
 */

import { createStructureReport, aggregateConfidence } from "./types.js";
import { stripArtifacts } from "./strip-artifacts.js";
import { inferHeadings, validateHeadingHierarchy } from "./infer-headings.js";
import { extractPdfBlocks } from "./extract-pdf-blocks.js";
import { extractPdfOutline, matchOutlineToBlocks } from "./pdf-outline.js";
import { extractHtmlBlocks } from "./extract-html-blocks.js";
import { emitMarkdown } from "./emit-markdown.js";
import { createTextBlock } from "./types.js";

/** @typedef {import("./types.js").TextBlock} TextBlock */
/** @typedef {import("./types.js").HeadingCandidate} HeadingCandidate */
/** @typedef {import("./types.js").StructureReport} StructureReport */

/**
 * @param {string} text
 * @param {"txt"|"md"} source
 * @returns {TextBlock[]}
 */
function extractPlainBlocks(text, source) {
  const raw = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  if (!raw) return [];
  return raw.split(/\n{2,}/).map((para, i) => {
    const trimmed = para.trim();
    return createTextBlock({
      text: trimmed,
      fontSize: 0,
      source,
      lineIndex: i,
      kind: "paragraph",
    });
  }).filter((b) => b.text);
}

/**
 * @param {string|ArrayBuffer} rawContent
 * @param {"pdf"|"html"|"txt"|"md"} format
 */
async function extractBlocks(rawContent, format) {
  if (format === "html") {
    const html = typeof rawContent === "string" ? rawContent : "";
    return { blocks: extractHtmlBlocks(html), pageHeights: [], doc: null };
  }
  if (format === "pdf") {
    if (!(rawContent instanceof ArrayBuffer)) {
      return { blocks: [], pageHeights: [], doc: null };
    }
    const { blocks, pageHeights, doc } = await extractPdfBlocks(rawContent);
    return { blocks, pageHeights, doc };
  }
  const text = typeof rawContent === "string" ? rawContent : "";
  return {
    blocks: extractPlainBlocks(text, format === "md" ? "md" : "txt"),
    pageHeights: [],
    doc: null,
  };
}

/**
 * @param {{ rawContent: string|ArrayBuffer, format: "pdf"|"html"|"txt"|"md" }} opts
 * @returns {Promise<{
 *   blocks: TextBlock[],
 *   headings: HeadingCandidate[],
 *   structure: StructureReport,
 *   normalizedFormat?: "markdown",
 *   normalizedContent?: string,
 * }>}
 */
export async function normalizeDocumentStructure({ rawContent, format }) {
  const fmt = String(format || "").toLowerCase();
  const { blocks: rawBlocks, pageHeights, doc } = await extractBlocks(rawContent, fmt);

  const stripResult = stripArtifacts(rawBlocks, {
    format: fmt,
    pageHeights,
  });

  let outlineHeadings = [];
  const warnings = [...(stripResult.warnings || [])];

  if (doc) {
    const outline = await extractPdfOutline(doc);
    outlineHeadings = matchOutlineToBlocks(outline, stripResult.blocks);
    const matchRatio =
      outline.length > 0 ? outlineHeadings.length / outline.length : 1;
    if (outline.length > 0 && matchRatio < 0.5) {
      warnings.push("outline_partial");
    }
  }

  const { headings: inferred, bodyFontSize } = inferHeadings(stripResult.blocks, {
    format: fmt,
    outline: outlineHeadings,
    pageHeights,
  });

  const headings = validateHeadingHierarchy(inferred);

  const emitted = emitMarkdown(stripResult.blocks, headings);
  const normalizedFormat = "markdown";
  const normalizedContent = emitted.markdown;
  const headingsWithOffsets = emitted.headings;

  const totalChars = normalizedContent?.length || 0;
  const confidence = aggregateConfidence(headingsWithOffsets, totalChars);

  if (totalChars > 5000 && headingsWithOffsets.length === 0) {
    warnings.push("low_heading_confidence");
  }

  if (fmt === "pdf" && totalChars < 50) {
    warnings.push("scanned_pdf_no_text");
  }

  const structure = createStructureReport({
    headingCount: headingsWithOffsets.length,
    bodyFontSize: bodyFontSize || undefined,
    confidence,
    artifactsRemoved: stripResult.artifactsRemoved,
    warnings,
  });

  return {
    blocks: stripResult.blocks,
    headings: headingsWithOffsets,
    structure,
    normalizedFormat,
    normalizedContent,
  };
}

export { createTextBlock, createStructureReport, emptyStructureReport } from "./types.js";
