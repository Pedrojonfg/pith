/**
 * Read mode — static textbook-style block text + inline visuals.
 * @see specs/20260705-read-mode/
 */

import { markdownToHtml } from "./markdown.js";
import { getDocumentImageSignedUrl } from "./document-images/storage.js";
import { typesetMath } from "./ui.js";

const TYPO_DEFAULTS = {
  fontSizePx: 16,
  lineHeight: 1.6,
  fontFamily: '"DM Sans", sans-serif',
};

let mermaidInitialized = false;

function ensureMermaid() {
  if (mermaidInitialized || typeof window === "undefined") return;
  const m = window.mermaid;
  if (!m || typeof m.initialize !== "function") return;
  m.initialize({
    startOnLoad: false,
    theme: "dark",
    themeVariables: {
      darkMode: true,
      background: "#111318",
      primaryColor: "#1a1f28",
      primaryTextColor: "#e8eaed",
      primaryBorderColor: "#5eb8b8",
      lineColor: "#5eb8b8",
      secondaryColor: "#252b36",
      tertiaryColor: "#111318",
    },
  });
  mermaidInitialized = true;
}

/**
 * @param {HTMLElement} el
 */
function applyReadTypography(el) {
  if (!el) return;
  el.style.fontSize = `${TYPO_DEFAULTS.fontSizePx}px`;
  el.style.lineHeight = String(TYPO_DEFAULTS.lineHeight);
  el.style.fontFamily = TYPO_DEFAULTS.fontFamily;
}

/**
 * @param {string} text
 */
export function renderExplanationHtml(text) {
  return markdownToHtml(String(text || ""));
}

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isValidMermaidSource(source) {
  const s = String(source || "").trim();
  if (!s) return false;
  return /\b(graph|flowchart|sequenceDiagram)\b/i.test(s);
}

/**
 * @param {HTMLElement} container
 * @param {string} mermaidSource
 */
export async function renderMermaidInto(container, mermaidSource) {
  if (!container) return false;
  ensureMermaid();
  const m = window.mermaid;
  if (!m || typeof m.render !== "function") return false;
  const id = `read-mmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const { svg } = await m.render(id, String(mermaidSource || "").trim());
    container.className = "read-mode-visual read-mode-visual--diagram";
    container.innerHTML = svg;
    return true;
  } catch (err) {
    console.warn("[read-mode] mermaid render failed", err);
    return false;
  }
}

/**
 * @param {HTMLElement} container
 * @param {string} imageId
 * @param {import("./session-types.js").DocumentImage[]} images
 */
export async function renderDocumentImageInto(container, imageId, images) {
  if (!container || !imageId) return false;
  const rec = (images || []).find((img) => String(img?.imageId || "") === String(imageId));
  if (!rec?.storagePath) return false;
  try {
    const url = await getDocumentImageSignedUrl(rec.storagePath);
    if (!url) return false;
    container.className = "read-mode-visual read-mode-visual--image";
    const img = document.createElement("img");
    img.src = url;
    img.alt = String(rec.visionDescription || "Document figure").trim() || "Document figure";
    img.loading = "lazy";
    if (rec.width) img.width = Number(rec.width) || undefined;
    if (rec.height) img.height = Number(rec.height) || undefined;
    container.replaceChildren(img);
    return true;
  } catch (err) {
    console.warn("[read-mode] image render failed", err);
    return false;
  }
}

/**
 * Split explanation at anchor; fallback append visual at end.
 * @param {string} explanationText
 * @param {string} anchor
 * @returns {{ before: string, after: string, anchorFound: boolean }}
 */
export function splitExplanationAtAnchor(explanationText, anchor) {
  const text = String(explanationText || "");
  const needle = String(anchor || "").trim();
  if (!needle) return { before: text, after: "", anchorFound: false };
  const idx = text.indexOf(needle);
  if (idx < 0) return { before: text, after: "", anchorFound: false };
  const splitAt = idx + needle.length;
  return {
    before: text.slice(0, splitAt),
    after: text.slice(splitAt),
    anchorFound: true,
  };
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   explanationText: string,
 *   visualNeed?: object,
 *   resolvedVisual?: object,
 *   images?: import("./session-types.js").DocumentImage[],
 * }} block
 */
export async function renderReadBlockContent(host, block) {
  if (!host) return;
  host.replaceChildren();
  host.classList.add("md-content", "read-mode-text");
  applyReadTypography(host);

  const explanation = String(block?.explanationText || block?.explanation || "");
  const visual = block?.resolvedVisual;
  const need = block?.visualNeed;
  const anchor = String(need?.insertionAnchor || "").trim();
  const visualReady = visual?.status === "ready";

  const wrap = document.createElement("div");
  wrap.className = "read-mode-body";

  if (!visualReady || !need?.type) {
    const prose = document.createElement("div");
    prose.innerHTML = renderExplanationHtml(explanation);
    wrap.appendChild(prose);
    host.appendChild(wrap);
    void typesetMath(wrap);
    return;
  }

  const { before, after, anchorFound } = splitExplanationAtAnchor(explanation, anchor);
  const beforeEl = document.createElement("div");
  beforeEl.innerHTML = renderExplanationHtml(anchorFound ? before : explanation);
  wrap.appendChild(beforeEl);

  const visualEl = document.createElement("div");
  visualEl.className = "read-mode-visual-slot";
  wrap.appendChild(visualEl);

  if (anchorFound && after.trim()) {
    const afterEl = document.createElement("div");
    afterEl.innerHTML = renderExplanationHtml(after);
    wrap.appendChild(afterEl);
  }

  host.appendChild(wrap);

  if (visual.type === "diagram" && visual.mermaidSource) {
    await renderMermaidInto(visualEl, visual.mermaidSource);
  } else if (visual.type === "image" && visual.imageId) {
    await renderDocumentImageInto(visualEl, visual.imageId, block?.images || []);
  }

  void typesetMath(wrap);
}
