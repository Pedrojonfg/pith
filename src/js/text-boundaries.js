/**
 * Deterministic text boundary helpers (sentence/paragraph snap).
 * @see specs/20260703-semantic-concept-anchoring — R1
 */

// Known limitation: does not treat abbreviations (Dr., Sr., etc.) as non-sentence-enders.

function isSentenceEndAt(text, index) {
  const ch = text[index];
  if (ch !== "." && ch !== "!" && ch !== "?") return false;
  const rest = text.slice(index + 1);
  return /^\s+(?:[A-Z\u00C0-\u024F]|$)/.test(rest);
}

function findParagraphBreakAfter(text, from, limit) {
  const idx = text.indexOf("\n\n", from);
  if (idx < 0 || idx >= limit) return -1;
  return idx + 2;
}

function findSentenceEndAfter(text, from, limit) {
  for (let i = from; i < limit; i += 1) {
    if (!isSentenceEndAt(text, i)) continue;
    const rest = text.slice(i + 1);
    const m = rest.match(/^\s+/);
    const advance = 1 + (m ? m[0].length : 0);
    return i + advance;
  }
  return -1;
}

function findBoundaryAfter(text, from, limit) {
  const para = findParagraphBreakAfter(text, from, limit);
  const sent = findSentenceEndAfter(text, from, limit);
  if (para < 0) return sent;
  if (sent < 0) return para;
  return Math.min(para, sent);
}

function findBoundaryBefore(text, from, searchStart) {
  let best = -1;
  const para = text.lastIndexOf("\n\n", from - 1);
  if (para >= searchStart) best = para + 2;
  for (let i = from - 1; i >= searchStart; i -= 1) {
    if (!isSentenceEndAt(text, i)) continue;
    const rest = text.slice(i + 1);
    const m = rest.match(/^\s+/);
    const end = i + 1 + (m ? m[0].length : 0);
    if (end <= from) {
      best = Math.max(best, end);
      break;
    }
  }
  return best;
}

/**
 * @param {string} text
 * @param {number} charOffset
 * @param {"start"|"end"} direction
 * @param {number} [maxSearchChars]
 * @returns {number}
 */
export function snapToSentenceBoundary(text, charOffset, direction, maxSearchChars = 200) {
  const raw = String(text ?? "");
  const len = raw.length;
  if (!len) return 0;

  let offset = Math.floor(Number(charOffset) || 0);
  if (!Number.isFinite(offset)) offset = 0;
  offset = Math.max(0, Math.min(offset, len));

  const window = Math.max(0, Math.floor(Number(maxSearchChars) || 200));
  if (!window) return offset;

  if (direction === "end") {
    const limit = Math.min(len, offset + window);
    const found = findBoundaryAfter(raw, offset, limit);
    return found >= 0 ? found : offset;
  }

  if (direction === "start") {
    const searchStart = Math.max(0, offset - window);
    const found = findBoundaryBefore(raw, offset, searchStart);
    return found >= 0 ? found : offset;
  }

  return offset;
}

/**
 * Snap interior mechanical char offsets (keeps 0 and totalLen fixed).
 * @param {string} text
 * @param {number[]} offsets
 * @returns {number[]}
 */
export function snapInteriorCharOffsets(text, offsets) {
  const material = String(text ?? "");
  const total = material.length;
  const sorted = (Array.isArray(offsets) ? offsets : [])
    .map((n) => Math.floor(Number(n) || 0))
    .filter((n, i, arr) => i === 0 || n > arr[i - 1]);
  if (sorted.length < 2) return sorted.length ? sorted : [0, total];

  const out = [...sorted];
  out[0] = 0;
  out[out.length - 1] = total;

  for (let i = 1; i < out.length - 1; i += 1) {
    const snapped = snapToSentenceBoundary(material, out[i], "start");
    const min = out[i - 1] + 1;
    const max = out[i + 1] - 1;
    out[i] = Math.max(min, Math.min(max, snapped));
  }
  return out;
}
