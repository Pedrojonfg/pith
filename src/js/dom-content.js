/**
 * Central DOM content helpers (prefer over raw innerHTML for LLM/document text).
 * @see markdown.js for markdown rendering + KaTeX typeset.
 */

export {
  setTextContent,
  setMarkdownHtml,
  markdownToHtml,
  renderMarkdown,
  renderMcOptionHtml,
  clearMarkdownContainer,
  hasMathInHtml,
} from "./markdown.js";

/** Trusted static HTML from app templates only — never for raw model output. */
export function setStaticHtml(el, html) {
  if (!el) return;
  el.innerHTML = String(html ?? "");
}

/** Clear a container safely. */
export function clearElement(el) {
  if (!el) return;
  el.textContent = "";
}
