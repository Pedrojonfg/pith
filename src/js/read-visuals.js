/**
 * Lazy visual resolution for Read mode blocks (images + Mermaid diagrams).
 * @see specs/20260705-read-mode/
 */

import { findPithImageTokenIds } from "./document-images/tokens.js";
import { generateBlockDiagram } from "./api.js";
import { isValidMermaidSource } from "./read-mode.js";
import { storeActiveSession } from "./session.js";
import { getActiveSession } from "./session-store.js";

/** @type {((blockIndex: number) => void) | null} */
let onVisualResolved = null;

/**
 * @param {(blockIndex: number) => void} fn
 */
export function setOnReadVisualResolved(fn) {
  onVisualResolved = typeof fn === "function" ? fn : null;
}

/**
 * @param {object} raw
 * @returns {object|null}
 */
export function normalizeVisualNeed(raw) {
  if (!raw || typeof raw !== "object") return null;
  const typeRaw = raw.type;
  const type =
    typeRaw === "diagram" || typeRaw === "image" ? typeRaw : typeRaw === null ? null : null;
  if (!type) return null;
  return {
    type,
    reason: String(raw.reason || "").trim(),
    insertionAnchor: String(raw.insertionAnchor || "").trim(),
  };
}

/**
 * @param {object} block
 * @param {import("./session-types.js").DocumentSession | null} doc
 * @returns {string|null}
 */
export function pickImageIdForBlock(block, doc) {
  const chunk = String(block?.chunk || "");
  const ids = findPithImageTokenIds(chunk);
  if (!ids.length) return null;
  if (ids.length > 1) {
    console.info("[read-visuals] multiple image candidates in chunk; using first", {
      blockId: block?.id,
      ids,
    });
  }
  const images = Array.isArray(doc?.shared?.images) ? doc.shared.images : [];
  const known = new Set(images.map((img) => String(img?.imageId || "")));
  const match = ids.find((id) => known.has(id));
  return match || ids[0] || null;
}

/**
 * @param {string} chunk
 * @param {import("./session-types.js").DocumentSession | null} doc
 */
export function sectionHasImages(chunk, doc) {
  const ids = findPithImageTokenIds(String(chunk || ""));
  if (!ids.length) return false;
  const images = Array.isArray(doc?.shared?.images) ? doc.shared.images : [];
  const known = new Set(images.map((img) => String(img?.imageId || "")));
  return ids.some((id) => known.has(id));
}

/**
 * @param {object} block
 * @param {{ llmModel?: string, language?: string, doc?: object }} opts
 */
async function resolveDiagramVisual(block, { llmModel, language, doc }) {
  const labels = Array.isArray(block?.concepts)
    ? block.concepts.map((c) => String(c?.term || "").trim()).filter(Boolean)
    : [];
  try {
    const { mermaidSource } = await generateBlockDiagram({
      llmModel,
      language,
      blockText: String(block?.explanation || ""),
      conceptLabels: labels,
      reason: String(block?.visualNeed?.reason || ""),
    });
    if (!isValidMermaidSource(mermaidSource)) {
      return { type: "diagram", status: "failed" };
    }
    return {
      type: "diagram",
      status: "ready",
      mermaidSource: String(mermaidSource || "").trim(),
      generatedAt: Date.now(),
    };
  } catch (err) {
    console.warn("[read-visuals] diagram generation failed", err);
    return { type: "diagram", status: "failed" };
  }
}

/**
 * @param {number} blockIndex
 * @param {object} block
 * @param {{ llmModel?: string, language?: string, activeSession?: object }} opts
 */
export async function resolveBlockVisual(blockIndex, block, opts = {}) {
  const need = normalizeVisualNeed(block?.visualNeed);
  if (!need?.type) return block;
  if (block?.resolvedVisual?.status === "ready") return block;

  const doc = opts.doc || (await getActiveSession());
  const llmModel = opts.llmModel;
  const language = opts.language || "English";

  /** @type {object} */
  let resolvedVisual;

  if (need.type === "image") {
    const imageId = pickImageIdForBlock(block, doc);
    if (imageId) {
      resolvedVisual = { type: "image", status: "ready", imageId, generatedAt: Date.now() };
    } else {
      // ponytail: fall back to diagram when image association fails
      resolvedVisual = await resolveDiagramVisual(block, { llmModel, language, doc });
    }
  } else {
    resolvedVisual = await resolveDiagramVisual(block, { llmModel, language, doc });
  }

  const next = { ...block, resolvedVisual };
  const session = opts.activeSession;
  if (session && Array.isArray(session.blocks)) {
    const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
    session.blocks[idx] = next;
    void storeActiveSession(session, { bumpRev: true });
  }
  if (typeof onVisualResolved === "function") {
    try {
      onVisualResolved(Math.max(0, Math.floor(Number(blockIndex) || 0)));
    } catch (err) {
      console.warn("[read-visuals] onVisualResolved failed", err);
    }
  }
  return next;
}

/**
 * Fire-and-forget visual resolution during prefetch.
 * @param {number} blockIndex
 * @param {object} block
 * @param {{ llmModel?: string, language?: string, activeSession?: object }} opts
 */
export function triggerReadVisualPrefetch(blockIndex, block, opts = {}) {
  const need = normalizeVisualNeed(block?.visualNeed);
  if (!need?.type) return;
  if (block?.resolvedVisual?.status === "ready") return;
  void resolveBlockVisual(blockIndex, block, opts).catch((err) => {
    console.warn("[read-visuals] prefetch visual failed", err);
  });
}
