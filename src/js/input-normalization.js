/**
 * Study material normalization (FR-013, FR-014, v3 markdown canonical).
 * pdf|html|txt|md → markdown (single normalized format).
 */

import { normalizeDocumentStructure } from "./normalization/index.js";
import { deLog } from "./debug-enrich.js";
import { protectMarkdownTransform } from "./document-images/tokens.js";
import {
  MAX_SOURCE_FILES,
  assignSourceFileIds,
  buildSourceFileBreak,
} from "./source-provenance.js";

export const SUPPORTED_INPUT_FORMATS = Object.freeze(["pdf", "html", "txt", "md"]);

import { loadPdfJs as loadPdfJsInternal } from "./normalization/pdf-loader.js";

export class UnsupportedFormatError extends Error {
  constructor(message, detectedFormat = "") {
    super(message);
    this.name = "UnsupportedFormatError";
    this.code = "unsupported_format";
    this.detectedFormat = detectedFormat;
  }
}

export class NormalizationError extends Error {
  constructor(message, detectedFormat = "") {
    super(message);
    this.name = "NormalizationError";
    this.code = "normalization_failed";
    this.detectedFormat = detectedFormat;
  }
}

/** @param {string} filename */
export function detectFormatFromFilename(filename) {
  const name = String(filename || "").trim().toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = name.slice(dot + 1);
  if (!SUPPORTED_INPUT_FORMATS.includes(ext)) return null;
  return ext;
}

function stripDataUriAttributes(html) {
  return String(html || "").replace(
    /\b([a-zA-Z0-9:_-]+)\s*=\s*(["'])\s*data:[\s\S]*?\2/gi,
    '$1=""',
  );
}

function stripScriptAndStyleBlocks(html) {
  const raw = String(html || "");
  const noScript = raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  return noScript.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

const MINIMAL_HTML_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

function stripUnsafeAttributes(el) {
  const attrs = Array.from(el.attributes || []);
  for (const a of attrs) {
    const n = String(a.name || "").toLowerCase();
    if (n.startsWith("on")) {
      el.removeAttribute(a.name);
      continue;
    }
    if (n === "style") {
      el.removeAttribute(a.name);
      continue;
    }
    if (n === "href" || n === "alt") continue;
    el.removeAttribute(a.name);
  }
}

function unwrapNonSemanticElement(el) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

/** @param {string} html */
export function toMinimalHtml(html) {
  const pre = stripScriptAndStyleBlocks(stripDataUriAttributes(html));
  if (typeof DOMParser === "undefined") {
    return String(pre)
      .replace(/\s*on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(/\sstyle\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(/\s+/g, " ")
      .replace(/>\s+</g, "><")
      .trim();
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(pre, "text/html");

  for (const node of Array.from(doc.querySelectorAll("script, style, link[rel='stylesheet'], noscript"))) {
    node.remove();
  }

  const body = doc.body || doc.documentElement;
  const walk = (el) => {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    const tag = String(el.tagName || "").toLowerCase();
    if (!MINIMAL_HTML_TAGS.has(tag)) {
      unwrapNonSemanticElement(el);
      return;
    }
    stripUnsafeAttributes(el);
    const children = Array.from(el.children || []);
    for (const child of children) walk(child);
  };

  for (const child of Array.from(body.children || [])) walk(child);

  const out = String(body.innerHTML || "")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
  return out;
}

/** Strip html_min tags for IA prompts (keeps readable line breaks). */
export function htmlMinToPlainText(html) {
  const raw = String(html || "").trim();
  if (!raw) return "";
  if (typeof DOMParser === "undefined") {
    return raw
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const doc = new DOMParser().parseFromString(`<body>${raw}</body>`, "text/html");
  return (doc.body?.innerText || doc.body?.textContent || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Scope text prepared for Phase 0 / IA (plain text when source is html_min). */
export function scopeTextForPhase0IA(text, normalizedFormat) {
  const raw = String(text || "");
  return String(normalizedFormat || "") === "html_min" ? htmlMinToPlainText(raw) : raw;
}

/** Plain text → markdown paragraphs (no HTML). */
export function plainTextToMarkdown(text) {
  const raw = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  if (!raw) return "";
  const blocks = raw.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  if (!blocks.length) return raw;
  return blocks.join("\n\n");
}

/** Light cleanup for existing markdown files. */
export function cleanupMarkdown(md) {
  return protectMarkdownTransform(String(md || ""), (text) => {
    let out = stripScriptAndStyleBlocks(text);
    out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
    return out.trim();
  });
}

export async function loadPdfJs() {
  return loadPdfJsInternal();
}

/** [debug-enrich] instrumentation-only — shared normalization diagnostics bag */
export function ensureNormalizationDebugBag() {
  if (!globalThis.__dppNormalizationDebug) {
    globalThis.__dppNormalizationDebug = {
      totalPages: 0,
      lowExtractionPages: [],
      tablesDetected: 0,
      tablesEmittedOk: 0,
      headingsInferred: 0,
      headingsBySource: {},
      headingsFallbackUsed: false,
      headingInferenceDiagnostics: null,
      hierarchyMethod: null,
      visionFallbackPages: [],
      lowExtractionPagesAfterVision: [],
      imagesDetected: 0,
      imagesAnalyzed: 0,
      imagesFailed: 0,
      imagesSkipped: 0,
      charsBeforeStrip: 0,
      charsAfterStrip: 0,
    };
  }
  return globalThis.__dppNormalizationDebug;
}

/** [debug-enrich] take and clear bag after normalization completes */
export function takeNormalizationDebugBag() {
  const bag = globalThis.__dppNormalizationDebug || null;
  globalThis.__dppNormalizationDebug = null;
  return bag;
}

/** [debug-enrich] peek without clearing — for DPP phases after upload */
export function peekNormalizationDebugBag() {
  return globalThis.__dppNormalizationDebug || null;
}

/** @param {ArrayBuffer} buffer */
export async function extractPdfPlainText(buffer) {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const doc = await loadingTask.promise;
  const parts = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => String(item?.str || ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) parts.push(line);
  }
  return parts.join("\n\n");
}

/**
 * @param {string|ArrayBuffer} rawContent
 * @param {"pdf"|"html"|"txt"|"md"} detectedFormat
 * @returns {Promise<{
 *   normalizedFormat: "markdown",
 *   normalizedContent: string,
 *   warnings: string[],
 *   structure: { heading_count: number, confidence: string, artifacts_removed: number },
 * }>}
 */
export async function normalizeStudyMaterial(rawContent, detectedFormat) {
  const format = String(detectedFormat || "").toLowerCase();
  const inputBytes =
    rawContent instanceof ArrayBuffer
      ? rawContent.byteLength
      : String(rawContent || "").length;
  deLog("[input-normalization.normalizeStudyMaterial] Start:", { format, inputBytes });
  if (!SUPPORTED_INPUT_FORMATS.includes(format)) {
    throw new UnsupportedFormatError(
      `Unsupported file format. Use one of: ${SUPPORTED_INPUT_FORMATS.join(", ")}.`,
      format,
    );
  }

  if (format === "pdf" && !(rawContent instanceof ArrayBuffer)) {
    throw new NormalizationError("PDF input must be read as binary.", format);
  }

  try {
    ensureNormalizationDebugBag(); // [debug-enrich]
    const pipeline = await normalizeDocumentStructure({ rawContent, format });
    let normalizedContent = pipeline.normalizedContent || "";

    if (format === "md") {
      normalizedContent = cleanupMarkdown(normalizedContent);
    }

    if (!normalizedContent.trim()) {
      const emptyMsg =
        format === "html"
          ? "HTML file appears empty after cleanup."
          : format === "md"
            ? "Markdown file appears empty."
            : "File appears empty after normalization.";
      throw new NormalizationError(emptyMsg, format);
    }

    const warnings = [...(pipeline.structure?.warnings || [])];

    const debugBag = peekNormalizationDebugBag(); // [debug-enrich]
    if (debugBag) {
      debugBag.imagesDetected = (pipeline.pendingImages || []).length;
      debugBag.headingsFallbackUsed = Boolean(pipeline.fallbackSections);
    }

    console.info("[input-normalization.normalizeStudyMaterial] Done:", {
      format,
      charCount: normalizedContent.length,
      headingCount: pipeline.structure?.headingCount ?? 0,
      confidence: pipeline.structure?.confidence ?? "low",
      warningCount: warnings.length,
      warnings: warnings.slice(0, 5),
      pendingImages: (pipeline.pendingImages || []).length,
      hasFallbackSections: Boolean(pipeline.fallbackSections),
    }); // [debug-enrich]

    return {
      normalizedFormat: "markdown",
      normalizedContent,
      warnings,
      fallbackSections: pipeline.fallbackSections || null,
      pendingImages: pipeline.pendingImages || [],
      // R6: preserve HeadingCandidate.source for HierarchyNode tagging at T1.1
      headings: Array.isArray(pipeline.headings)
        ? pipeline.headings.map((h) => ({
            label: String(h.label || ""),
            source: String(h.source || "heuristic"),
            level: Number(h.level) || 1,
          }))
        : [],
      structure: {
        heading_count: pipeline.structure?.headingCount ?? 0,
        confidence: pipeline.structure?.confidence ?? "low",
        artifacts_removed: pipeline.structure?.artifactsRemoved ?? 0,
      },
    };
  } catch (err) {
    if (err instanceof NormalizationError || err instanceof UnsupportedFormatError) throw err;
    console.error("[input-normalization.normalizeStudyMaterial] Failed:", {
      format,
      message: err?.message || String(err),
      stack: err?.stack,
    }); // [debug-enrich]
    throw new NormalizationError(
      err?.message ? String(err.message) : "Failed to normalize study material.",
      format,
    );
  }
}

/**
 * Normalize and concatenate 1–5 study files with source sentinels.
 * @param {File[]} files
 */
export async function normalizeMultipleFiles(files) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!list.length) {
    throw new NormalizationError("At least one file is required.");
  }
  if (list.length > MAX_SOURCE_FILES) {
    throw new NormalizationError(`Maximum ${MAX_SOURCE_FILES} files per session.`);
  }

  const fileMetas = assignSourceFileIds(list);
  const parts = [];
  const sourceMap = {};
  const warnings = [];
  const pendingImages = [];
  /** @type {{ label: string, source: string, level: number }[]} */
  const headings = [];

  for (let i = 0; i < list.length; i += 1) {
    const file = list[i];
    const meta = fileMetas[i];
    const detectedFormat = detectFormatFromFilename(file?.name || "");
    if (!detectedFormat) {
      throw new UnsupportedFormatError(
        `Unsupported file format for "${file?.name || "file"}".`,
        String(file?.name || "").split(".").pop() || "",
      );
    }

    const rawContent =
      detectedFormat === "pdf" ? await file.arrayBuffer() : await file.text();

    const result = await normalizeStudyMaterial(rawContent, detectedFormat);
    meta.originalFormat = detectedFormat;
    sourceMap[i] = meta.fileId;

    if (i > 0) {
      parts.push(buildSourceFileBreak(meta.fileId));
    }
    parts.push(result.normalizedContent);
    warnings.push(...(result.warnings || []));
    pendingImages.push(...(result.pendingImages || []));
    if (Array.isArray(result.headings)) headings.push(...result.headings);
  }

  const markdown = parts.join("");
  if (!String(markdown || "").trim()) {
    throw new NormalizationError("All files appear empty after normalization.");
  }

  return {
    markdown,
    files: fileMetas,
    sourceMap,
    warnings,
    pendingImages,
    headings,
  };
}
