// Portable helper to derive a compact sneak peek from an explanation.

/**
 * Extract a sneak peek from the given explanation text.
 * - Normalizes whitespace.
 * - Splits into sentences using a conservative regex.
 * - Returns at most `maxSentences` sentences joined with single spaces.
 *
 * @param {string} explanation
 * @param {number} [maxSentences=4]
 * @returns {string}
 */
export function extractSneakPeek(explanation, maxSentences = 4) {
  if (typeof explanation !== "string") {
    // [debug-enrich]
    console.debug('[sneakPeek.extractSneakPeek] Non-string explanation:', {
      type: typeof explanation,
    });
    return "";
  }

  // Normalize maxSentences to a sensible positive integer.
  if (typeof maxSentences !== "number" || !Number.isFinite(maxSentences) || maxSentences <= 0) {
    maxSentences = 4;
  } else {
    maxSentences = Math.floor(maxSentences);
  }

  let text = explanation.trim();
  if (!text) {
    // [debug-enrich]
    console.debug('[sneakPeek.extractSneakPeek] Empty explanation');
    return "";
  }

  // Collapse all whitespace (including newlines) to single spaces so that
  // sentence boundaries aren't affected by paragraph formatting.
  text = text.replace(/\s+/g, " ");
  // Sentence splitter: split on punctuation end followed by whitespace.
  // This intentionally treats punctuation inside inline LaTeX-like blocks
  // as sentence-ending tokens too; it matches the expectations of the test suite.
  const sentenceSeparator = /(?<=[.!?])\s+/g;
  const rawSentences = text.split(sentenceSeparator);

  const sentences = [];
  for (const part of rawSentences) {
    const trimmed = part.trim();
    if (trimmed) {
      sentences.push(trimmed);
      if (sentences.length >= maxSentences) break;
    }
  }

  if (sentences.length === 0) {
    // [debug-enrich]
    console.debug('[sneakPeek.extractSneakPeek] No sentences parsed', {
      inputLen: explanation.length,
    });
    return "";
  }

  const result = sentences.join(" ");
  // [debug-enrich]
  console.debug('[sneakPeek.extractSneakPeek] Extracted:', {
    inputLen: explanation.length,
    sentenceCount: sentences.length,
    peekLen: result.length,
  });
  return result;
}
