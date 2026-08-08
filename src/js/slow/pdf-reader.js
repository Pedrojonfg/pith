/**
 * Slow Mode native PDF viewer (pdf.js canvas + text layer + annotation overlays).
 */

import { loadPdfJs } from "../normalization/pdf-loader.js";
import { annotationHighlightClass } from "./annotations.js";

/** @type {{ key: string, doc: object } | null} */
let pdfCache = null;

/**
 * @param {ArrayBuffer | Uint8Array} bytes
 * @returns {string}
 */
export function bytesToBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(u8).toString("base64");
  }
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Persistable pdfSource from raw bytes.
 * @param {ArrayBuffer | Uint8Array} bytes
 * @returns {{ kind: "base64", data: string }}
 */
export function encodePdfSourceBase64(bytes) {
  return { kind: "base64", data: bytesToBase64(bytes) };
}

/**
 * Stash original PDF bytes onto a shared bag while a live File is available.
 * // ponytail: same shape as legacy Slow generate — no IndexedDB
 * @param {Record<string, unknown>} shared
 * @param {{ arrayBuffer?: () => Promise<ArrayBuffer> } | null | undefined} file
 * @param {string} [originalFormat]
 * @returns {Promise<boolean>} true when pdfSource was written
 */
export async function stashPdfSourceOntoShared(shared, file, originalFormat) {
  if (!shared || typeof shared !== "object") return false;
  if (String(originalFormat || "").toLowerCase() !== "pdf") return false;
  if (typeof file?.arrayBuffer !== "function") return false;
  const bytes = await file.arrayBuffer();
  shared.pdfSource = encodePdfSourceBase64(bytes);
  return true;
}

/**
 * @param {string} b64
 * @returns {Uint8Array}
 */
function base64ToBytes(b64) {
  const raw = String(b64 || "");
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(raw, "base64"));
  }
  const binary = atob(raw);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * @param {{ kind?: string, data?: unknown } | null | undefined} pdfSource
 * @returns {Uint8Array}
 */
export function bytesFromPdfSource(pdfSource) {
  if (!pdfSource || typeof pdfSource !== "object") {
    throw new Error("Missing pdfSource");
  }
  const kind = String(pdfSource.kind || "");
  if (kind === "arrayBuffer") {
    const data = pdfSource.data;
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    throw new Error("pdfSource.arrayBuffer requires ArrayBuffer or Uint8Array");
  }
  if (kind === "base64") {
    return base64ToBytes(String(pdfSource.data || ""));
  }
  throw new Error(`Unsupported pdfSource.kind: ${kind}`);
}

function pdfSourceKey(pdfSource) {
  if (!pdfSource) return "";
  if (pdfSource.kind === "base64") {
    const data = String(pdfSource.data || "");
    // Content fingerprint — length alone collides across different PDFs of equal size.
    return `b64:${data.length}:${data.slice(0, 64)}:${data.slice(-64)}`;
  }
  if (pdfSource.kind === "arrayBuffer") {
    const data = pdfSource.data;
    const len =
      data instanceof Uint8Array
        ? data.byteLength
        : data instanceof ArrayBuffer
          ? data.byteLength
          : 0;
    return `ab:${len}`;
  }
  return String(pdfSource.kind || "");
}

export function resetPdfReaderCache() {
  pdfCache = null;
}

/**
 * Map DOM client rects into normalized 0–1 page-space rects (R-PDF-4 / FR-008).
 * @param {ArrayLike<{ left: number, top: number, width: number, height: number }> | null | undefined} clientRects
 * @param {{ left: number, top: number, width: number, height: number }} pageBox
 * @returns {{ x: number, y: number, width: number, height: number }[]}
 */
export function clientRectsToNormalizedPageRects(clientRects, pageBox) {
  const pw = Number(pageBox?.width) || 0;
  const ph = Number(pageBox?.height) || 0;
  if (pw <= 0 || ph <= 0) return [];
  const left = Number(pageBox.left) || 0;
  const top = Number(pageBox.top) || 0;
  const out = [];
  const list = clientRects?.length != null ? clientRects : [];
  for (let i = 0; i < list.length; i += 1) {
    const r = list[i];
    if (!r) continue;
    const w = Number(r.width) || 0;
    const h = Number(r.height) || 0;
    if (w <= 0 || h <= 0) continue;
    out.push({
      x: (Number(r.left) - left) / pw,
      y: (Number(r.top) - top) / ph,
      width: w / pw,
      height: h / ph,
    });
  }
  return out;
}

/**
 * Absolutely-positioned highlight overlays for pdf-rect anns on the current page (R-PDF-5).
 * @param {Element | null | undefined} pageWrap
 * @param {object[]} annotations
 * @param {number} page1 — 1-indexed
 */
export function renderPdfAnnotationOverlays(pageWrap, annotations, page1) {
  if (!pageWrap) return;
  pageWrap.querySelectorAll(".slow-pdf-ann-overlay").forEach((el) => el.remove());
  const page = Math.floor(Number(page1) || 1);
  const anns = (annotations || []).filter(
    (a) => !a?.orphaned && a?.anchor?.kind === "pdf-rect" && Number(a.anchor.page) === page,
  );
  for (const ann of anns) {
    const rects = Array.isArray(ann.anchor.rects) ? ann.anchor.rects : [];
    for (const r of rects) {
      if (!r) continue;
      const el = document.createElement("div");
      el.className = `slow-pdf-ann-overlay slow-ann-highlight slow-ann-highlight--${annotationHighlightClass(ann.type)}`;
      el.dataset.annId = String(ann.id || "");
      el.style.left = `${(Number(r.x) || 0) * 100}%`;
      el.style.top = `${(Number(r.y) || 0) * 100}%`;
      el.style.width = `${(Number(r.width) || 0) * 100}%`;
      el.style.height = `${(Number(r.height) || 0) * 100}%`;
      el.title = ann.userText || ann.snippet || ann.type || "";
      pageWrap.appendChild(el);
    }
  }
}

/**
 * @param {object} session
 * @returns {Promise<object>} pdf.js PDFDocumentProxy
 */
export async function ensurePdfDocument(session) {
  const src = session?.slow?.pdfSource;
  if (!src) throw new Error("session.slow.pdfSource is required for PDF viewer");
  const key = pdfSourceKey(src);
  if (pdfCache?.key === key && pdfCache.doc) {
    session.slow.pdfPageCount = Number(pdfCache.doc.numPages) || 0;
    return pdfCache.doc;
  }
  const pdfjs = await loadPdfJs();
  const data = bytesFromPdfSource(src);
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  pdfCache = { key, doc };
  session.slow.pdfPageCount = Number(doc.numPages) || 0;
  return doc;
}

/**
 * Per-page extracted text lengths for section→page checkpoint mapping (R-CP-2).
 * @param {object} session
 * @returns {Promise<number[]>}
 */
export async function extractPdfPageTextLengths(session) {
  const doc = await ensurePdfDocument(session);
  const lengths = [];
  const total = Number(doc.numPages) || 0;
  for (let p = 1; p <= total; p += 1) {
    const pdfPage = await doc.getPage(p);
    const textContent = await pdfPage.getTextContent();
    const text = (textContent.items || []).map((it) => String(it?.str || "")).join("");
    lengths.push(text.length);
  }
  return lengths;
}

/**
 * Extract concatenated text for PDF pages 1..maxPage (inclusive) for IA anti-spoiler.
 * @param {object} session
 * @param {number} maxPage — 1-indexed inclusive
 * @returns {Promise<string>}
 */
export async function extractPdfTextThroughPage(session, maxPage) {
  const doc = await ensurePdfDocument(session);
  const total = Number(doc.numPages) || 0;
  let max = Math.floor(Number(maxPage) || 0);
  if (!Number.isFinite(max) || max < 1) return "";
  if (total > 0 && max > total) max = total;
  const parts = [];
  for (let p = 1; p <= max; p += 1) {
    const pdfPage = await doc.getPage(p);
    const textContent = await pdfPage.getTextContent();
    parts.push((textContent.items || []).map((it) => String(it?.str || "")).join(""));
  }
  return parts.join("\n\n");
}

/**
 * Clamp and persist 1-indexed page; updates maxReadPdfPage.
 * @param {object} session
 * @param {number} page1
 * @returns {number} clamped page
 */
export function goToPdfPage(session, page1) {
  if (!session?.slow) return 1;
  const total = Math.max(0, Number(session.slow.pdfPageCount) || 0);
  let page = Math.floor(Number(page1) || 1);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (total > 0 && page > total) page = total;
  session.slow.currentPdfPage = page;
  session.slow.maxReadPdfPage = Math.max(Number(session.slow.maxReadPdfPage) || 1, page);
  return page;
}

/**
 * Render current PDF page into container (canvas + text layer).
 * @param {object} session
 * @param {Element | null | undefined} containerEl
 * @param {{ scale?: number }} [opts]
 */
export async function renderPdfViewer(session, containerEl, opts = {}) {
  if (!session?.slow || !containerEl) return;
  if (session.slow.viewerMode !== "pdf") return;

  if (!session.slow.pdfSource) {
    containerEl.textContent = "PDF source unavailable. Re-upload the PDF to view pages.";
    return;
  }

  const pdfjs = await loadPdfJs();
  const doc = await ensurePdfDocument(session);
  const page = goToPdfPage(session, session.slow.currentPdfPage || 1);
  const pdfPage = await doc.getPage(page);

  const baseViewport = pdfPage.getViewport({ scale: 1 });
  const containerWidth =
    Number(containerEl.clientWidth) ||
    Number(containerEl.parentElement?.clientWidth) ||
    600;
  const fitScale = containerWidth > 0 ? containerWidth / baseViewport.width : 1;
  const scale = Number(opts.scale) > 0 ? Number(opts.scale) : Math.min(2, Math.max(0.5, fitScale));
  const viewport = pdfPage.getViewport({ scale });

  containerEl.textContent = "";
  containerEl.classList.remove("md-content");

  const wrap = document.createElement("div");
  wrap.className = "slow-pdf-page";
  wrap.style.width = `${viewport.width}px`;
  wrap.style.height = `${viewport.height}px`;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.className = "slow-pdf-canvas";

  const textLayerDiv = document.createElement("div");
  textLayerDiv.className = "textLayer slow-pdf-text-layer";
  textLayerDiv.style.width = `${viewport.width}px`;
  textLayerDiv.style.height = `${viewport.height}px`;

  wrap.appendChild(canvas);
  wrap.appendChild(textLayerDiv);
  containerEl.appendChild(wrap);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  await pdfPage.render({ canvasContext: ctx, viewport }).promise;

  const textContent = await pdfPage.getTextContent();
  const textLayer = new pdfjs.TextLayer({
    textContentSource: textContent,
    container: textLayerDiv,
    viewport,
  });
  await textLayer.render();

  renderPdfAnnotationOverlays(wrap, session.slow.annotations, page);
}
