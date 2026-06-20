// Portable helpers: every block explanation must use distinct paragraphs (\n\n).

import { isBoldHeaderLine } from "./rsvp-section-headers.js";

/** @param {string} text */
export function splitExplanationParagraphs(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** @param {string} text */
export function countExplanationParagraphs(text) {
  return splitExplanationParagraphs(text).length;
}

/**
 * @param {{ blockTitle?: string, explanation_profile?: string }} [opts]
 * @returns {number}
 */
export function getMinExplanationParagraphs(opts = {}) {
  const title = String(opts.blockTitle || "").trim();
  const isVocab = opts.isVocabularyBlock === true || /^Key terms:/i.test(title);
  const profileRaw = String(opts.explanation_profile || "").trim();
  const profile =
    profileRaw === "brief_deep"
      ? "brief_deep"
      : profileRaw === "relational_compressed"
        ? "relational_compressed"
        : "thorough";
  if (isVocab) return 6;
  if (profile === "brief_deep") return 4;
  if (profile === "relational_compressed") return 3;
  return 6;
}

/** @param {{ blockTitle?: string, explanation_profile?: string, isVocabularyBlock?: boolean }} opts */
export function buildParagraphFormatOpts(blockTitle, explanation_profile) {
  const title = String(blockTitle || "").trim();
  return {
    blockTitle: title,
    explanation_profile,
    isVocabularyBlock: /^Key terms:/i.test(title),
  };
}

/**
 * Hard-rule line for LLM prompts (no imports from api.js).
 * @param {{ blockTitle?: string, explanation_profile?: string, isVocabularyBlock?: boolean }} opts
 */
export function explanationParagraphHardRule(opts = {}) {
  const min = getMinExplanationParagraphs(opts);
  return (
    `HARD RULE (explanation field): Use at least ${min} separate paragraphs. ` +
    `Put exactly one blank line between paragraphs (double newline). ` +
    `A single continuous paragraph is invalid and will be rejected.`
  );
}

/** @param {string} text */
function splitExplanationSentences(text) {
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];
  const parts = normalized.split(/(?<=[.!?…])\s+/);
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** @param {string} text */
function splitVocabularyParagraphs(text) {
  const parts = String(text || "")
    .split(/(?=\*\*[^*\n]+?\*\*)/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : splitExplanationParagraphs(text);
}

/**
 * @param {string[]} sentences
 * @param {number} targetCount
 */
function groupSentencesIntoParagraphs(sentences, targetCount) {
  const list = Array.isArray(sentences) ? sentences.filter(Boolean) : [];
  if (!list.length) return [];
  const target = Math.max(2, Math.floor(Number(targetCount) || 2));
  if (list.length <= target) return [...list];
  const buckets = Array.from({ length: target }, () => []);
  for (let i = 0; i < list.length; i += 1) {
    buckets[i % target].push(list[i]);
  }
  return buckets.map((b) => b.join(" ")).filter(Boolean);
}

/**
 * Normalize and, if needed, split a wall of text into distinct paragraphs.
 * @param {string} explanation
 * @param {{ blockTitle?: string, explanation_profile?: string, isVocabularyBlock?: boolean }} [opts]
 * @returns {string}
 */
export function enforceExplanationParagraphs(explanation, opts = {}) {
  let text = String(explanation || "").trim();
  if (!text) return "";
  if (text.startsWith("[Generation failed")) return text;

  text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  const min = getMinExplanationParagraphs(opts);
  let paragraphs = splitExplanationParagraphs(text);

  if (paragraphs.length >= min) {
    return paragraphs.join("\n\n");
  }

  const isVocab =
    opts.isVocabularyBlock === true || /^Key terms:/i.test(String(opts.blockTitle || "").trim());
  if (isVocab) {
    const termParas = splitVocabularyParagraphs(text);
    if (termParas.length >= Math.max(2, min)) {
      return termParas.join("\n\n");
    }
    if (termParas.length >= 2) {
      return termParas.join("\n\n");
    }
  }

  const sentences = splitExplanationSentences(text);
  if (sentences.length >= 2) {
    const want = Math.max(2, Math.min(min, sentences.length));
    paragraphs = groupSentencesIntoParagraphs(sentences, want);
    if (paragraphs.length >= 2) {
      return paragraphs.join("\n\n");
    }
  }

  return paragraphs.length >= 2 ? paragraphs.join("\n\n") : text;
}

/**
 * @param {string} explanation
 * @param {{ blockTitle?: string, explanation_profile?: string, isVocabularyBlock?: boolean }} [opts]
 */
export function hasValidExplanationParagraphs(explanation, opts = {}) {
  const text = String(explanation || "").trim();
  if (!text) return false;
  if (text.startsWith("[Generation failed")) return true;

  const allParagraphs = splitExplanationParagraphs(text);
  const headerCount = allParagraphs.filter(isBoldHeaderLine).length;
  const contentParagraphs = allParagraphs.filter((p) => !isBoldHeaderLine(p));

  if (headerCount >= 2) {
    return contentParagraphs.length >= Math.max(2, headerCount);
  }

  const count = contentParagraphs.length;
  if (count < 2) return false;

  const min = getMinExplanationParagraphs(opts);
  const sentences = splitExplanationSentences(text);
  const required = sentences.length >= min ? min : Math.max(2, sentences.length);
  return count >= required;
}
