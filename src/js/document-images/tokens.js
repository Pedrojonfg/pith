/** Inline anchor tokens for document images in rawMarkdown. */

export const PITH_IMAGE_TOKEN_RE = /!\[pith-image:([a-zA-Z0-9_-]+)\]/g;

const SHIELD_PREFIX = "\uE000PITHIMG";
const SHIELD_SUFFIX = "\uE001";

/** @param {string} imageId */
export function formatPithImageToken(imageId) {
  const id = String(imageId || "").trim();
  return id ? `![pith-image:${id}]` : "";
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function findPithImageTokenIds(text) {
  const ids = [];
  const re = new RegExp(PITH_IMAGE_TOKEN_RE.source, "g");
  let match;
  while ((match = re.exec(String(text || ""))) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

/**
 * @param {string} text
 * @returns {{ text: string, shields: string[] }}
 */
export function shieldPithImageTokens(text) {
  /** @type {string[]} */
  const shields = [];
  const out = String(text || "").replace(PITH_IMAGE_TOKEN_RE, (full) => {
    const idx = shields.length;
    shields.push(full);
    return `${SHIELD_PREFIX}${idx}${SHIELD_SUFFIX}`;
  });
  return { text: out, shields };
}

/**
 * @param {string} text
 * @param {string[]} shields
 */
export function unshieldPithImageTokens(text, shields) {
  if (!shields?.length) return String(text || "");
  const re = new RegExp(`${SHIELD_PREFIX}(\\d+)${SHIELD_SUFFIX}`, "g");
  return String(text || "").replace(re, (_, idx) => shields[Number(idx)] || "");
}

/**
 * @param {string} text
 * @param {(s: string) => string} transformFn
 */
export function protectMarkdownTransform(text, transformFn) {
  const { text: shielded, shields } = shieldPithImageTokens(text);
  return unshieldPithImageTokens(transformFn(shielded), shields);
}

/**
 * @param {Set<string>|string[]} existingIds
 * @param {number} [counter]
 */
export function nextImageId(existingIds, counter = 1) {
  const used = new Set(Array.isArray(existingIds) ? existingIds : [...(existingIds || [])]);
  let n = counter;
  while (used.has(`img_${String(n).padStart(4, "0")}`)) n += 1;
  const imageId = `img_${String(n).padStart(4, "0")}`;
  return { imageId, nextCounter: n + 1 };
}
