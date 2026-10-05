import { typesetMath } from "./ui.js?v=20260625_02";

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getMarked() {
  const m = globalThis.marked;
  if (!m || typeof m.parse !== "function") return null;
  return m;
}

/** Plain text only — prefer for user/LLM strings when markup is not needed. */
export function setTextContent(el, text) {
  if (!el) return;
  el.textContent = String(text ?? "");
}

/** Markdown → sanitized HTML in a container (central DOM helper). */
export function setMarkdownHtml(el, markdown) {
  if (!el) return;
  const html = markdownToHtml(String(markdown ?? ""));
  if (!html) {
    el.textContent = "";
    el.classList.remove("md-content");
    return;
  }
  el.innerHTML = html;
  el.classList.add("md-content");
}

/** @param {string} text */
export function markdownToHtml(text) {
  const raw = String(text ?? "");
  if (!raw.trim()) return "";
  const marked = getMarked();
  if (marked) {
    return marked.parse(raw, { breaks: true, gfm: true });
  }
  return escapeHtml(raw).replace(/\n/g, "<br>");
}

/** Plain text for RSVP flashes (no markup syntax). */
export function stripMarkdownForPlainText(text) {
  const raw = String(text ?? "");
  if (!raw.trim()) return "";
  const marked = getMarked();
  if (marked) {
    const div = document.createElement("div");
    div.innerHTML = marked.parse(raw, { breaks: true, gfm: true });
    return div.textContent || "";
  }
  return raw
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "");
}

/**
 * @param {HTMLElement | null} containerEl
 * @param {string} text
 * @returns {Promise<void>}
 */
export function renderMarkdown(containerEl, text) {
  if (!containerEl) return Promise.resolve();
  setMarkdownHtml(containerEl, text);
  if (!containerEl.classList.contains("md-content")) return Promise.resolve();
  return typesetMath(containerEl);
}

/** @param {HTMLElement | null} containerEl */
export function clearMarkdownContainer(containerEl) {
  if (!containerEl) return;
  containerEl.textContent = "";
  containerEl.classList.remove("md-content");
}

/** MC option button markup: letter label + markdown body (avoids parsing "A." as markdown). */
export function renderMcOptionHtml(letter, text) {
  const key = `${String(letter || "").trim()}.`;
  const body = markdownToHtml(String(text ?? "").trim());
  if (!body) return `<span class="mc-option-key">${escapeHtml(key)}</span>`;
  return `<span class="mc-option-key">${escapeHtml(key)}</span><span class="mc-option-body md-content">${body}</span>`;
}

export function hasMathInHtml(html) {
  return /\\\(|\\\[|\$\$?/.test(String(html || ""));
}
