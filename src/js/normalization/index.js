/**
 * Structure inference pipeline (structure-inference-pipeline.md).
 * @module normalization
 */

import { createStructureReport, aggregateConfidence } from "./types.js";
import { stripArtifacts } from "./strip-artifacts.js";
import { inferHeadings, validateHeadingHierarchy } from "./infer-headings.js";
import { extractPdfBlocks } from "./extract-pdf-blocks.js";
import { extractPdfOutline, matchOutlineToBlocks, computeOutlineCoverage } from "./pdf-outline.js";
import { getFrontMatterPageRange, detectFrontMatterPages } from "./front-matter-detector.js";
import { extractHtmlBlocks } from "./extract-html-blocks.js";
import { extractHtmlBlocksWithImages } from "../document-images/extract-html.js";
import { extractPdfImages } from "../document-images/extract-pdf.js";
import { emitMarkdown, dehyphenate as dehyphenateRaw } from "./emit-markdown.js";
import { protectMarkdownTransform } from "../document-images/tokens.js";
import { buildEqualLengthSections } from "../slow/headings.js";
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
    const withImages = await extractHtmlBlocksWithImages(html);
    if (withImages.blocks.length) {
      const bag = globalThis.__dppNormalizationDebug;
      if (bag) {
        bag.imagesDetected = withImages.pendingImages?.length ?? 0;
        const tdThCount = (html.match(/<t[dh]\b/gi) || []).length;
        if (tdThCount > 0) {
          bag.tablesDetected = tdThCount;
          bag.tablesEmittedOk = 0;
        }
      }
      console.debug("[normalization.extractBlocks] HTML with images path:", {
        blockCount: withImages.blocks.length,
        pendingImages: withImages.pendingImages?.length ?? 0,
      }); // [debug-enrich]
      return {
        blocks: withImages.blocks,
        pageHeights: [],
        doc: null,
        pendingImages: withImages.pendingImages,
      };
    }
    return {
      blocks: extractHtmlBlocks(html),
      pageHeights: [],
      doc: null,
      pendingImages: [],
    };
  }
  if (format === "pdf") {
    if (!(rawContent instanceof ArrayBuffer)) {
      return { blocks: [], pageHeights: [], doc: null, pendingImages: [] };
    }
    const { blocks, pageHeights, doc } = await extractPdfBlocks(rawContent);
    const pdfImages = await extractPdfImages(doc, blocks, pageHeights);
    return {
      blocks: pdfImages.blocks,
      pageHeights,
      doc,
      pendingImages: pdfImages.pendingImages,
    };
  }
  const text = typeof rawContent === "string" ? rawContent : "";
  return {
    blocks: extractPlainBlocks(text, format === "md" ? "md" : "txt"),
    pageHeights: [],
    doc: null,
    pendingImages: [],
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
 *   fallbackSections?: ReturnType<typeof buildEqualLengthSections>,
 *   pendingImages?: import("../document-images/storage.js").PendingDocumentImage[],
 * }>}
 */
export async function normalizeDocumentStructure({ rawContent, format }) {
  const fmt = String(format || "").toLowerCase();
  console.debug("[normalization.normalizeDocumentStructure] Start:", { format: fmt }); // [debug-enrich]
  const { blocks: rawBlocks, pageHeights, doc, pendingImages = [] } = await extractBlocks(rawContent, fmt);
  console.debug("[normalization.normalizeDocumentStructure] Blocks extracted:", {
    format: fmt,
    rawBlockCount: rawBlocks.length,
    pageCount: pageHeights.length,
    pendingImages: pendingImages.length,
  }); // [debug-enrich]

  let outline = [];
  if (doc) {
    outline = await extractPdfOutline(doc);
  }

  const totalPages = Math.max(
    pageHeights.length,
    ...rawBlocks.map((b) => b.pageIndex + 1),
    1,
  );

  const frontMatterEnd =
    outline.length > 0
      ? getFrontMatterPageRange(outline).skip
      : detectFrontMatterPages(rawBlocks, totalPages);

  const stripResult = stripArtifacts(rawBlocks, {
    format: fmt,
    pageHeights,
    frontMatterEnd,
  });

  const contentBlocks = stripResult.blocks.filter((b) => b.pageIndex > frontMatterEnd);

  let outlineHeadings = [];
  let outlineCoverage = 0;
  const warnings = [...(stripResult.warnings || [])];

  if (outline.length > 0) {
    outlineHeadings = matchOutlineToBlocks(outline, contentBlocks);
    outlineCoverage = computeOutlineCoverage(outlineHeadings, outline);
    if (outlineCoverage < 0.5) {
      warnings.push("outline_partial");
    }
  }

  const { headings: inferred, bodyFontSize } = inferHeadings(stripResult.blocks, {
    format: fmt,
    outline: outlineHeadings,
    pageHeights,
    outlineCoverage,
  });

  const headings = validateHeadingHierarchy(inferred);
  const emitted = emitMarkdown(stripResult.blocks, headings);
  const normalizedContent = protectMarkdownTransform(emitted.markdown, dehyphenateRaw);
  const headingsWithOffsets = emitted.headings;
  const totalChars = normalizedContent?.length || 0;
  const confidence = aggregateConfidence(headingsWithOffsets, totalChars);

  let fallbackSections;
  if (totalChars > 5000 && headingsWithOffsets.length === 0) {
    warnings.push("low_heading_confidence");
    fallbackSections = buildEqualLengthSections(normalizedContent, {
      targetChunkSize: 5000,
      labelPrefix: "Sección",
    });
    console.warn("[normalization.normalizeDocumentStructure] Equal-length section fallback:", {
      charCount: totalChars,
      headingCount: 0,
    }); // [debug-enrich]
    const bag = globalThis.__dppNormalizationDebug;
    if (bag) bag.headingsFallbackUsed = true;
  }

  if (fmt === "pdf" && totalChars < 50) {
    warnings.push("scanned_pdf_no_text");
    console.warn("[normalization.normalizeDocumentStructure] Possible scanned PDF (very low char count):", {
      charCount: totalChars,
    }); // [debug-enrich]
  }

  const structure = createStructureReport({
    headingCount: headingsWithOffsets.length,
    bodyFontSize: bodyFontSize || undefined,
    confidence,
    artifactsRemoved: stripResult.artifactsRemoved,
    warnings,
  });

  console.info("[normalization.normalizeDocumentStructure] Done:", {
    format: fmt,
    charCount: totalChars,
    headingCount: headingsWithOffsets.length,
    confidence,
    artifactsRemoved: stripResult.artifactsRemoved,
    warningCount: warnings.length,
    warnings: warnings.slice(0, 5),
    hasFallbackSections: Boolean(fallbackSections),
  }); // [debug-enrich]

  return {
    blocks: stripResult.blocks,
    headings: headingsWithOffsets,
    structure,
    normalizedFormat: "markdown",
    normalizedContent,
    fallbackSections,
    pendingImages,
  };
}

export { createTextBlock, createStructureReport, emptyStructureReport } from "./types.js";
export { dehyphenate } from "./emit-markdown.js";
