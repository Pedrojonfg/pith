/**
 * HTML image extraction — emits pith-image tokens and pending binary payloads.
 */

import { createTextBlock } from "../normalization/types.js";
import { inferLevelFromElement } from "../normalization/extract-html-blocks.js";
import { formatPithImageToken, nextImageId } from "./tokens.js";

/** @typedef {import("./storage.js").PendingDocumentImage} PendingDocumentImage */

function escapeMarkdownTableCell(text) {
  return String(text || "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

/**
 * Minimal HTML table → markdown table.
 * @param {Element} tableEl
 * @returns {string|null}
 */
function tableElementToMarkdown(tableEl) {
  const rows = Array.from(tableEl.querySelectorAll("tr"));
  if (!rows.length) return null;

  const grid = rows
    .map((tr) => {
      const cells = Array.from(tr.querySelectorAll("th,td"));
      return cells.map((c) => escapeMarkdownTableCell(c.textContent || ""));
    })
    .filter((r) => r.length > 0);

  if (!grid.length) return null;

  const headerRow = grid[0];
  const colCount = Math.max(1, ...grid.map((r) => r.length));
  const header = Array.from({ length: colCount }, (_, i) => headerRow[i] || "");
  const sep = Array.from({ length: colCount }, () => "---");
  const body = grid
    .slice(1)
    .map((r) => Array.from({ length: colCount }, (_, i) => r[i] || ""));

  const lines = [];
  lines.push(`| ${header.join(" | ")} |`);
  lines.push(`| ${sep.join(" | ")} |`);
  for (const r of body) lines.push(`| ${r.join(" | ")} |`);
  return lines.join("\n");
}

/**
 * @param {string} src
 * @returns {Promise<{ bytes: ArrayBuffer, mimeType: string, width: number|null, height: number|null }|null>}
 */
async function resolveImageBytes(src) {
  const raw = String(src || "").trim();
  if (!raw) return null;

  if (raw.startsWith("data:")) {
    const m = /^data:([^;,]+)?;base64,(.+)$/i.exec(raw);
    if (!m) return null;
    const mimeType = m[1] || "image/png";
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return { bytes: bytes.buffer, mimeType, width: null, height: null };
  }

  if (typeof fetch !== "function") return null;
  try {
    const res = await fetch(raw);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") || "image/png";
    const bytes = await res.arrayBuffer();
    return { bytes, mimeType, width: null, height: null };
  } catch {
    return null;
  }
}

/**
 * @param {Element} el
 */
function readImgDimensions(el) {
  const w = parseInt(el.getAttribute("width") || "", 10);
  const h = parseInt(el.getAttribute("height") || "", 10);
  return {
    width: Number.isFinite(w) && w > 0 ? w : null,
    height: Number.isFinite(h) && h > 0 ? h : null,
  };
}

/**
 * @param {string} html
 * @returns {Promise<{ blocks: import("../normalization/types.js").TextBlock[], pendingImages: PendingDocumentImage[] }>}
 */
export async function extractHtmlBlocksWithImages(html) {
  const raw = String(html || "").trim();
  /** @type {import("../normalization/types.js").TextBlock[]} */
  const blocks = [];
  /** @type {PendingDocumentImage[]} */
  const pendingImages = [];
  const usedIds = new Set();
  let counter = 1;
  let lineIndex = 0;

  if (!raw) return { blocks, pendingImages };

  if (typeof DOMParser === "undefined") {
    return { blocks, pendingImages };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/html");
  const body = doc.body || doc.documentElement;

  const blockTags = new Set([
    "p", "div", "h1", "h2", "h3", "h4", "h5", "h6",
    "li", "blockquote", "pre", "figure",
  ]);

  /**
   * @param {Node} node
   */
  const walk = async (node) => {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = /** @type {Element} */ (node);
    const tag = String(el.tagName || "").toLowerCase();
    if (tag === "script" || tag === "style" || tag === "noscript") return;

    if (tag === "table") {
      const md = tableElementToMarkdown(el);
      if (md) {
        blocks.push(
          createTextBlock({
            text: md,
            fontSize: 0,
            pageIndex: 0,
            lineIndex: lineIndex++,
            source: "html",
            kind: "paragraph",
          }),
        );
      }
      return;
    }

    if (tag === "img") {
      const src = el.getAttribute("src") || "";
      const resolved = await resolveImageBytes(src);
      if (resolved) {
        const { imageId, nextCounter } = nextImageId(usedIds, counter);
        counter = nextCounter;
        usedIds.add(imageId);
        const dims = readImgDimensions(el);
        pendingImages.push({
          imageId,
          sourceType: "embedded",
          sourceFormat: "html",
          pageNumber: null,
          bytes: resolved.bytes,
          mimeType: resolved.mimeType,
          width: dims.width ?? resolved.width,
          height: dims.height ?? resolved.height,
        });
        blocks.push(
          createTextBlock({
            text: formatPithImageToken(imageId),
            fontSize: 0,
            pageIndex: 0,
            lineIndex: lineIndex++,
            source: "html",
            kind: "image",
          }),
        );
      }
      return;
    }

    if (blockTags.has(tag)) {
      const clone = el.cloneNode(true);
      for (const img of clone.querySelectorAll("img")) {
        img.replaceWith(document.createTextNode(""));
      }
      const text = (clone.textContent || "").replace(/\s+/g, " ").trim();
      if (text) {
        const headingLevel = inferLevelFromElement(el);
        const mdText = headingLevel > 0 ? `${"#".repeat(headingLevel)} ${text}` : text;
        blocks.push(
          createTextBlock({
            text: mdText,
            fontSize: 0,
            pageIndex: 0,
            lineIndex: headingLevel > 0 ? headingLevel : lineIndex++,
            source: "html",
            kind: headingLevel > 0 ? "heading" : tag.startsWith("h") ? "heading" : "paragraph",
          }),
        );
      }
      for (const child of Array.from(el.children || [])) {
        if (String(child.tagName || "").toLowerCase() === "img") {
          await walk(child);
        }
      }
      return;
    }

    for (const child of Array.from(el.children || [])) {
      await walk(child);
    }
  };

  for (const child of Array.from(body.children || [])) {
    await walk(child);
  }

  if (!blocks.length) {
    for (const img of Array.from(body.querySelectorAll("img"))) {
      await walk(img);
    }
    const text = (body.textContent || "").replace(/\s+/g, " ").trim();
    if (text) {
      blocks.push(
        createTextBlock({
          text,
          fontSize: 0,
          source: "html",
          kind: "paragraph",
        }),
      );
    }
  }

  return { blocks, pendingImages };
}
