/**
 * Lazy migration: legacy sessions with normalizedFormat "html_min" → markdown.
 * Deterministic; no LLM or source re-upload.
 */

const BLOCK_TAG =
  /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>|<p[^>]*>([\s\S]*?)<\/p>|<li[^>]*>([\s\S]*?)<\/li>|<br\s*\/?>/gi;

function decodeEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripInnerTags(text) {
  return decodeEntities(
    String(text || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

/**
 * Convert html_min fragment to markdown (h1-h6, p, li, br).
 * @param {string} html
 * @returns {string}
 */
export function htmlMinToMarkdown(html) {
  const raw = String(html || "").trim();
  if (!raw) return "";

  const parts = [];
  let lastIndex = 0;
  let match;
  BLOCK_TAG.lastIndex = 0;

  while ((match = BLOCK_TAG.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      const between = stripInnerTags(raw.slice(lastIndex, match.index));
      if (between) parts.push(between);
    }

    if (/^<br/i.test(match[0])) {
      parts.push("\n");
    } else if (match[1]) {
      const level = Number(match[1]) || 1;
      const label = stripInnerTags(match[2]);
      if (label) parts.push(`${"#".repeat(Math.min(6, Math.max(1, level)))} ${label}\n\n`);
    } else if (match[3] !== undefined) {
      const label = stripInnerTags(match[3]);
      if (label) parts.push(`${label}\n\n`);
    } else if (match[4] !== undefined) {
      const label = stripInnerTags(match[4]);
      if (label) parts.push(`- ${label}\n`);
    }

    lastIndex = BLOCK_TAG.lastIndex;
  }

  if (lastIndex < raw.length) {
    const tail = stripInnerTags(raw.slice(lastIndex));
    if (tail) parts.push(tail);
  }

  return parts
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Migrate a Slow/Cloze session slot from html_min to markdown in place.
 * Idempotent via _migratedFromHtmlMin.
 * @param {object} session
 * @returns {object}
 */
export function migrateLegacyHtmlMinSession(session) {
  if (!session || typeof session !== "object") return session;

  const slot = session.slow || session.cloze;
  if (!slot || slot.normalizedFormat !== "html_min") return session;
  if (slot._migratedFromHtmlMin) return session;

  const text = String(slot.normalizedTextFull || slot.normalizedText || "");
  const markdown = htmlMinToMarkdown(text);

  if (Object.prototype.hasOwnProperty.call(slot, "normalizedTextFull")) {
    slot.normalizedTextFull = markdown;
  }
  slot.normalizedText = markdown;
  slot.normalizedFormat = "markdown";
  slot._migratedFromHtmlMin = true;

  return session;
}
