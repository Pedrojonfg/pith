/**
 * Structure inference pipeline (structure-inference-pipeline.md).
 * @module normalization
 */

import { createStructureReport, aggregateConfidence } from "./types.js";
import { deInfo, deLog, deWarn } from "../debug-enrich.js";
import { stripArtifacts } from "./strip-artifacts.js";
import { inferHeadings, OUTLINE_HIGH_CONFIDENCE_COVERAGE } from "./infer-headings.js";
import { extractPdfBlocks } from "./extract-pdf-blocks.js";
import { extractPdfOutline, matchOutlineToBlocks, computeOutlineCoverage, filterOutlineHeadings } from "./pdf-outline.js";
import { getFrontMatterPageRange, detectFrontMatterPages } from "./front-matter-detector.js";
import { extractHtmlBlocks } from "./extract-html-blocks.js";
import { extractHtmlBlocksWithImages } from "../document-images/extract-html.js";
import { extractPdfImages } from "../document-images/extract-pdf.js";
import { emitMarkdown, dehyphenate as dehyphenateRaw } from "./emit-markdown.js";
import { protectMarkdownTransform } from "../document-images/tokens.js";
import { buildEqualLengthSections } from "../slow/headings.js";
import { extractPlainBlocks, mergeGutenbergTitleBlocks, mergeRfcTitleBlocks } from "./plain-text-blocks.js";
import {
  parseTextTocEntries,
  textTocEntriesToOutline,
  extractHtmlTocOutline,
} from "./toc-page.js";

/** @typedef {import("./types.js").TextBlock} TextBlock */
/** @typedef {import("./types.js").HeadingCandidate} HeadingCandidate */
/** @typedef {import("./types.js").StructureReport} StructureReport */

/** [debug-enrich] */
function sampleBlockTexts(blocks, limit = 5, maxLen = 80) {
  return (blocks || []).slice(0, limit).map((b, i) => ({
    index: i,
    kind: b?.kind || "unknown",
    textPreview: String(b?.text || "").replace(/\s+/g, " ").trim().slice(0, maxLen),
    charLen: String(b?.text || "").length,
  }));
}

/** [debug-enrich] */
function countNonArtifactBlocks(blocks) {
  return (blocks || []).filter((b) => b?.kind !== "artifact").length;
}

/**
 * @param {string} text
 * @param {"txt"|"md"} source
 * @returns {TextBlock[]}
 */
function extractPlainBlocksForFormat(text, source) {
  return extractPlainBlocks(text, source);
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
        const tableCount = (html.match(/<table\b/gi) || []).length;
        if (tableCount > 0) {
          bag.tablesDetected = tableCount;
          bag.tablesEmittedOk = 0;
        }
      }
      deLog("[normalization.extractBlocks] HTML with images path:", {
        extractionPath: "extractHtmlBlocksWithImages",
        blockCount: withImages.blocks.length,
        pendingImages: withImages.pendingImages?.length ?? 0,
        blockSamples: sampleBlockTexts(withImages.blocks),
      }); // [debug-enrich]
      return {
        blocks: withImages.blocks,
        pageHeights: [],
        doc: null,
        pendingImages: withImages.pendingImages,
      };
    }
    const fallbackBlocks = extractHtmlBlocks(html);
    deLog("[normalization.extractBlocks] HTML plain path (images path empty):", {
      extractionPath: "extractHtmlBlocks",
      blockCount: fallbackBlocks.length,
      blockSamples: sampleBlockTexts(fallbackBlocks),
    }); // [debug-enrich]
    return {
      blocks: fallbackBlocks,
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
  const plainSource = format === "md" ? "md" : "txt";
  let plainBlocks = extractPlainBlocksForFormat(text, plainSource);
  if (plainSource === "txt") {
    const beforeRfc = plainBlocks;
    plainBlocks = mergeRfcTitleBlocks(plainBlocks);
    if (plainBlocks === beforeRfc) {
      plainBlocks = mergeGutenbergTitleBlocks(plainBlocks);
    }
  }
  return {
    blocks: plainBlocks,
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
  deLog("[normalization.normalizeDocumentStructure] Start:", { format: fmt });
  const { blocks: rawBlocks, pageHeights, doc, pendingImages = [] } = await extractBlocks(rawContent, fmt);
  deLog("[normalization.normalizeDocumentStructure] Blocks extracted:", {
    format: fmt,
    rawBlockCount: rawBlocks.length,
    pageCount: pageHeights.length,
    pendingImages: pendingImages.length,
  }); // [debug-enrich]

  let outline = [];
  if (doc) {
    outline = filterOutlineHeadings(await extractPdfOutline(doc));
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
  const blocksAfterStrip = stripResult.blocks.length;
  const nonArtifactAfterStrip = countNonArtifactBlocks(stripResult.blocks);
  deLog("[normalization.normalizeDocumentStructure] After stripArtifacts:", {
    step: "stripArtifacts",
    blocksIn: rawBlocks.length,
    blocksOut: blocksAfterStrip,
    nonArtifactBlocks: nonArtifactAfterStrip,
    artifactsRemoved: stripResult.artifactsRemoved,
    blocksRemoved: rawBlocks.length - nonArtifactAfterStrip,
    mergeRule: "mark_kind_artifact_not_removed_from_array",
  }); // [debug-enrich]

  const contentBlocks = stripResult.blocks.filter((b) => b.pageIndex > frontMatterEnd);
  if (frontMatterEnd >= 0) {
    deLog("[normalization.normalizeDocumentStructure] After front-matter filter:", {
      step: "frontMatterFilter",
      blocksIn: blocksAfterStrip,
      blocksOut: contentBlocks.length,
      frontMatterEnd,
      mergeRule: "filter_pageIndex_gt_frontMatterEnd",
    }); // [debug-enrich]
  }

  const blocksForInference = stripResult.blocks;
  deLog("[normalization.normalizeDocumentStructure] Blocks for inferHeadings:", {
    step: "inferHeadings_input",
    blockCount: blocksForInference.length,
    nonArtifactBlocks: countNonArtifactBlocks(blocksForInference),
    blockSamples: sampleBlockTexts(blocksForInference),
  }); // [debug-enrich]

  let outlineHeadings = [];
  let outlineCoverage = 0;
  const warnings = [...(stripResult.warnings || [])];

  if (outline.length > 0) {
    outlineHeadings = matchOutlineToBlocks(outline, contentBlocks);
    outlineCoverage = computeOutlineCoverage(outlineHeadings, outline);
    if (outlineCoverage < OUTLINE_HIGH_CONFIDENCE_COVERAGE) {
      warnings.push("outline_partial");
    }
  }

  // R18: text-TOC fallback when no outline or coverage below high confidence.
  if (
    outline.length === 0 ||
    outlineCoverage < OUTLINE_HIGH_CONFIDENCE_COVERAGE
  ) {
    const textTocEntries = parseTextTocEntries(blocksForInference);
    if (textTocEntries.length > 0) {
      const textOutline = textTocEntriesToOutline(textTocEntries);
      const textMatched = matchOutlineToBlocks(textOutline, contentBlocks);
      const textCoverage = computeOutlineCoverage(textMatched, textOutline);
      if (
        textMatched.length > outlineHeadings.length ||
        textCoverage > outlineCoverage
      ) {
        outlineHeadings = textMatched;
        outlineCoverage = textCoverage;
      }
    }
  }

  // R19: HTML TOC as structure source (still dropped from body by extract path).
  if (fmt === "html" && typeof rawContent === "string") {
    const htmlOutline = extractHtmlTocOutline(rawContent);
    if (htmlOutline.length > 0) {
      const matchBlocks = contentBlocks.length ? contentBlocks : blocksForInference;
      const htmlMatched = matchOutlineToBlocks(htmlOutline, matchBlocks);
      const htmlCoverage = computeOutlineCoverage(htmlMatched, htmlOutline);
      if (
        htmlMatched.length > 0 &&
        (outlineCoverage < OUTLINE_HIGH_CONFIDENCE_COVERAGE ||
          htmlMatched.length > outlineHeadings.length)
      ) {
        outlineHeadings = htmlMatched;
        outlineCoverage = htmlCoverage;
      }
    }
  }

  const { headings: inferred, bodyFontSize } = inferHeadings(stripResult.blocks, {
    format: fmt,
    outline: outlineHeadings,
    pageHeights,
    outlineCoverage,
  });

  const headings = inferred;
  const emitted = emitMarkdown(stripResult.blocks, headings);
  const normalizedContent = protectMarkdownTransform(emitted.markdown, dehyphenateRaw);
  const headingsWithOffsets = emitted.headings;
  const totalChars = normalizedContent?.length || 0;
  let confidence = aggregateConfidence(headingsWithOffsets, totalChars);
  const normBag = globalThis.__dppNormalizationDebug;
  if (
    normBag?.tablesDetected > 0 &&
    (normBag.tablesEmittedOk ?? 0) === 0 &&
    confidence === "high"
  ) {
    confidence = "medium";
  }

  let fallbackSections;
  if (totalChars > 5000 && headingsWithOffsets.length === 0) {
    warnings.push("low_heading_confidence");
    fallbackSections = buildEqualLengthSections(normalizedContent, {
      targetChunkSize: 5000,
      labelPrefix: "Sección",
    });
    deWarn("[normalization.normalizeDocumentStructure] Equal-length section fallback:", {
      charCount: totalChars,
      headingCount: 0,
    }); // [debug-enrich]
    const bag = globalThis.__dppNormalizationDebug;
    if (bag) bag.headingsFallbackUsed = true;
  }

  if (fmt === "pdf" && totalChars < 50) {
    warnings.push("scanned_pdf_no_text");
    deWarn("[normalization.normalizeDocumentStructure] Possible scanned PDF (very low char count):", {
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

  deInfo("[normalization.normalizeDocumentStructure] Done:", {
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
