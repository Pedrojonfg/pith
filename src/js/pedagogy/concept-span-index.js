/**
 * Build text-offset spans for concept inventory entries (label search in source).
 * @see specs/20260701-pedagogical-principles/research.md §14.2
 */

import { getPedagogicalFlags } from "../config/flags.js";

/**
 * @param {string} sourceText
 * @param {object[]} inventory
 * @param {{ familiarityByConceptId?: Record<string, number> }} [options]
 * @returns {Array<{ conceptId: string, start: number, end: number, noveltyScore: number|null, familiar: boolean }>}
 */
export function buildConceptSpanIndex(sourceText, inventory, options = {}) {
  const text = String(sourceText || "");
  const inv = Array.isArray(inventory) ? inventory : [];
  const familiarityMap = options.familiarityByConceptId || {};
  /** @type {Array<{ conceptId: string, start: number, end: number, noveltyScore: number|null, familiar: boolean, wordCount: number }>} */
  const spans = [];

  for (const entry of inv) {
    if (!entry || typeof entry !== "object") continue;
    const conceptId = String(entry.canonicalId || entry.id || "").trim();
    const label = String(entry.label || entry.title || "").trim();
    if (!conceptId || label.length < 3) continue;

    const idx = text.toLowerCase().indexOf(label.toLowerCase());
    if (idx < 0) continue;

    const start = idx;
    const end = idx + label.length;
    const noveltyScore = Number.isFinite(entry.noveltyScore) ? entry.noveltyScore : null;
    const belief = familiarityMap[conceptId];
    const familiar =
      (Number.isFinite(belief) && belief >= 0.7) ||
      (noveltyScore != null && noveltyScore < 0.35);

    spans.push({
      conceptId,
      start,
      end,
      noveltyScore,
      familiar,
      wordCount: label.split(/\s+/).filter(Boolean).length,
    });
  }

  return spans.sort((a, b) => a.start - b.start);
}

/**
 * Select highlight spans within word budget (highest novelty first).
 * @param {ReturnType<typeof buildConceptSpanIndex>} spans
 * @param {number} [budget]
 */
export function selectHighlightSpans(spans, budget) {
  const wordBudget = Number.isFinite(budget) ? budget : getPedagogicalFlags().HIGHLIGHT_WORD_BUDGET;
  const candidates = (Array.isArray(spans) ? spans : [])
    .filter((s) => !s.familiar)
    .sort((a, b) => (Number(b.noveltyScore) || 0) - (Number(a.noveltyScore) || 0));

  /** @type {typeof candidates} */
  const selected = [];
  let words = 0;
  for (const span of candidates) {
    if (words + span.wordCount > wordBudget) continue;
    selected.push(span);
    words += span.wordCount;
  }
  return selected;
}

/**
 * @param {string} html
 * @param {ReturnType<typeof buildConceptSpanIndex>} spans
 * @param {ReturnType<typeof selectHighlightSpans>} highlights
 */
export function applySpanClassesToHtml(html, spans, highlights) {
  const highlightIds = new Set((highlights || []).map((s) => s.conceptId));
  const spanList = Array.isArray(spans) ? spans : [];
  if (!spanList.length) return html;

  let out = String(html || "");
  for (const span of [...spanList].sort((a, b) => b.start - a.start)) {
    const classes = [];
    if (span.familiar) classes.push("pedagogy-dim");
    if (highlightIds.has(span.conceptId)) classes.push("pedagogy-highlight");
    if (!classes.length) continue;
    // Plain-text offset wrapping is handled by caller with plain offsets; this is a marker helper.
    void classes;
  }
  return out;
}

/**
 * Apply dim/highlight markers to plain text slice for reader rendering.
 * @param {string} text
 * @param {ReturnType<typeof buildConceptSpanIndex>} spans
 * @param {ReturnType<typeof selectHighlightSpans>} highlights
 */
export function wrapPlainTextWithPedagogyMarks(text, spans, highlights) {
  const slice = String(text || "");
  const highlightIds = new Set((highlights || []).map((s) => s.conceptId));
  const relevant = (Array.isArray(spans) ? spans : []).filter(
    (s) => s.familiar || highlightIds.has(s.conceptId),
  );
  if (!relevant.length) return slice;

  let out = slice;
  const offsetBase = 0;
  for (const span of [...relevant].sort((a, b) => b.start - a.start)) {
    const relStart = span.start - offsetBase;
    const relEnd = span.end - offsetBase;
    if (relStart < 0 || relEnd > out.length || relStart >= relEnd) continue;
    const inner = out.slice(relStart, relEnd);
    const cls = span.familiar
      ? "pedagogy-dim"
      : highlightIds.has(span.conceptId)
        ? "pedagogy-highlight"
        : null;
    if (!cls) continue;
    out = `${out.slice(0, relStart)}<span class="${cls}">${inner}</span>${out.slice(relEnd)}`;
  }
  return out;
}
