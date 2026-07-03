/**
 * PDF image extraction — embedded XObjects + full-page vector fallback.
 */

import { loadPdfJs } from "../normalization/pdf-loader.js";
import { createTextBlock } from "../normalization/types.js";
import { formatPithImageToken, nextImageId } from "./tokens.js";

/** @typedef {import("./storage.js").PendingDocumentImage} PendingDocumentImage */

const VECTOR_OPS = new Set([
  "constructPath",
  "stroke",
  "fill",
  "eoFill",
  "closePath",
  "rect",
  "moveTo",
  "lineTo",
  "curveTo",
]);

/**
 * @param {object} page
 * @param {object} pdfjs
 */
async function scanPageOperators(page, pdfjs) {
  const ops = await page.getOperatorList();
  const fnArray = ops?.fnArray || [];
  const OPS = pdfjs.OPS || {};
  let embeddedImageCount = 0;
  let vectorOpCount = 0;

  for (let i = 0; i < fnArray.length; i += 1) {
    const fn = fnArray[i];
    const fnName =
      typeof fn === "number"
        ? Object.entries(OPS).find(([, v]) => v === fn)?.[0] || ""
        : String(fn);
    if (/paint.*image/i.test(fnName) || fnName === "paintImageXObject" || fnName === "paintInlineImageXObject") {
      embeddedImageCount += 1;
    }
    if (VECTOR_OPS.has(fnName)) vectorOpCount += 1;
  }

  return { embeddedImageCount, vectorOpCount };
}

/**
 * @param {object} page
 * @param {object} pdfjs
 */
async function extractEmbeddedImagesFromPage(page, pdfjs) {
  const ops = await page.getOperatorList();
  const fnArray = ops?.fnArray || [];
  const argsArray = ops?.argsArray || [];
  const OPS = pdfjs.OPS || {};
  /** @type {Array<{ bytes: ArrayBuffer, mimeType: string, width: number|null, height: number|null }>} */
  const out = [];

  for (let i = 0; i < fnArray.length; i += 1) {
    const fn = fnArray[i];
    const isImageOp =
      fn === OPS.paintImageXObject ||
      fn === OPS.paintInlineImageXObject ||
      /paint.*image/i.test(
        typeof fn === "number"
          ? Object.entries(OPS).find(([, v]) => v === fn)?.[0] || ""
          : String(fn),
      );
    if (!isImageOp) continue;

    const imgName = argsArray[i]?.[0];
    if (!imgName) continue;

    try {
      const img =
        (await page.objs?.get?.(imgName)) ||
        (await page.commonObjs?.get?.(imgName));
      if (!img?.data) continue;
      const width = img.width ?? null;
      const height = img.height ?? null;
      const canvas = createCanvas(width || 1, height || 1);
      if (!canvas) continue;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      const imageData = ctx.createImageData(width || 1, height || 1);
      imageData.data.set(img.data);
      ctx.putImageData(imageData, 0, 0);
      const bytes = await canvasToPng(canvas);
      if (bytes) {
        out.push({ bytes, mimeType: "image/png", width, height });
      }
    } catch {
      // skip broken XObject
    }
  }

  void pdfjs;
  return out;
}

/** @param {number} w @param {number} h */
function createCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(w, h);
  }
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  return null;
}

/** @param {HTMLCanvasElement|OffscreenCanvas} canvas */
async function canvasToPng(canvas) {
  if (typeof canvas.convertToBlob === "function") {
    const blob = await canvas.convertToBlob({ type: "image/png" });
    return blob.arrayBuffer();
  }
  if (typeof canvas.toBlob === "function") {
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    return blob ? blob.arrayBuffer() : null;
  }
  return null;
}

/** @param {object} page */
export async function renderPageFallback(page) {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  await page.render({ canvasContext: ctx, viewport }).promise;
  const bytes = await canvasToPng(canvas);
  if (!bytes) return null;
  return {
    bytes,
    mimeType: "image/png",
    width: Math.ceil(viewport.width),
    height: Math.ceil(viewport.height),
  };
}

/**
 * @param {object|null} doc pdf.js document (may be null in tests)
 * @param {import("../normalization/types.js").TextBlock[]} blocks
 * @param {number[]} pageHeights
 */
export async function extractPdfImages(doc, blocks, pageHeights) {
  /** @type {PendingDocumentImage[]} */
  const pendingImages = [];
  if (!doc?.numPages) return { blocks, pendingImages };

  const pdfjs = await loadPdfJs();
  const usedIds = new Set();
  let counter = 1;
  /** @type {import("../normalization/types.js").TextBlock[]} */
  const nextBlocks = [...blocks];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const { embeddedImageCount, vectorOpCount } = await scanPageOperators(page, pdfjs);

    /** @type {Array<{ bytes: ArrayBuffer, mimeType: string, width: number|null, height: number|null, sourceType: "embedded"|"full_page_fallback" }>} */
    const pageAssets = [];

    if (embeddedImageCount > 0) {
      const embedded = await extractEmbeddedImagesFromPage(page, pdfjs);
      for (const asset of embedded) {
        pageAssets.push({ ...asset, sourceType: "embedded" });
      }
    }

    if (!pageAssets.length && vectorOpCount >= 8) {
      const fallback = await renderPageFallback(page);
      if (fallback) {
        pageAssets.push({ ...fallback, sourceType: "full_page_fallback" });
      }
    }

    if (!pageAssets.length) continue;

    const pageIndex = pageNum - 1;
    let insertAt = nextBlocks.length;
    for (let i = nextBlocks.length - 1; i >= 0; i -= 1) {
      if (nextBlocks[i].pageIndex === pageIndex) {
        insertAt = i + 1;
        break;
      }
    }

    /** @type {import("../normalization/types.js").TextBlock[]} */
    const imageBlocks = [];
    for (const asset of pageAssets) {
      const { imageId, nextCounter } = nextImageId(usedIds, counter);
      counter = nextCounter;
      usedIds.add(imageId);
      pendingImages.push({
        imageId,
        sourceType: asset.sourceType,
        sourceFormat: "pdf",
        pageNumber: pageNum,
        bytes: asset.bytes,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
      });
      imageBlocks.push(
        createTextBlock({
          text: formatPithImageToken(imageId),
          fontSize: 0,
          pageIndex,
          lineIndex: insertAt,
          source: "pdf",
          kind: "image",
        }),
      );
    }

    nextBlocks.splice(insertAt, 0, ...imageBlocks);
  }

  void pageHeights;
  return { blocks: nextBlocks, pendingImages };
}
