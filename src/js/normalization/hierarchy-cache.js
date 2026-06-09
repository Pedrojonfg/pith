/**
 * localStorage cache for document hierarchy trees (LLM / deterministic).
 * TTL 7 days, LRU max 20 entries.
 */

const CACHE_PREFIX = "mylearning_hierarchy_";
const INDEX_KEY = "mylearning_hierarchy_index";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 20;

function cacheKey(textHash) {
  return `${CACHE_PREFIX}${textHash}`;
}

function readIndex() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeIndex(hashes) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(hashes));
}

function touchIndex(textHash) {
  const hash = String(textHash);
  const index = readIndex().filter((h) => h !== hash);
  index.unshift(hash);
  writeIndex(index);
}

function removeFromIndex(textHash) {
  const hash = String(textHash);
  const next = readIndex().filter((h) => h !== hash);
  if (next.length !== readIndex().length) {
    writeIndex(next);
  }
}

function evictOverflow() {
  let index = readIndex();
  while (index.length > MAX_ENTRIES) {
    const evicted = index.pop();
    if (evicted) {
      localStorage.removeItem(cacheKey(evicted));
    }
  }
  writeIndex(index);
}

/**
 * Stable non-cryptographic hash for cache keys (djb2).
 * @param {string} text
 * @returns {string}
 */
export function hashText(text) {
  let hash = 5381;
  const s = String(text ?? "");
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) ^ s.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * @param {string} textHash
 * @returns {{ tree: unknown[], method: string, pedagogicalMeta?: import("../session-types.js").PedagogicalMeta | null } | null}
 */
export function getCachedHierarchy(textHash) {
  const hash = String(textHash);
  const raw = localStorage.getItem(cacheKey(hash));
  if (!raw) {
    removeFromIndex(hash);
    return null;
  }

  let entry;
  try {
    entry = JSON.parse(raw);
  } catch {
    localStorage.removeItem(cacheKey(hash));
    removeFromIndex(hash);
    return null;
  }

  const cachedAt = Number(entry?.cachedAt);
  if (!Number.isFinite(cachedAt) || Date.now() - cachedAt > TTL_MS) {
    localStorage.removeItem(cacheKey(hash));
    removeFromIndex(hash);
    return null;
  }

  if (!Array.isArray(entry.tree) || typeof entry.method !== "string") {
    localStorage.removeItem(cacheKey(hash));
    removeFromIndex(hash);
    return null;
  }

  touchIndex(hash);
  const out = { tree: entry.tree, method: entry.method };
  if (entry.pedagogicalMeta != null) {
    out.pedagogicalMeta = entry.pedagogicalMeta;
  }
  return out;
}

/**
 * @param {string} textHash
 * @param {{ tree: unknown[], method: string, pedagogicalMeta?: import("../session-types.js").PedagogicalMeta | null }} payload
 */
export function setCachedHierarchy(textHash, { tree, method, pedagogicalMeta }) {
  const hash = String(textHash);
  const entry = {
    tree,
    method: String(method),
    cachedAt: Date.now(),
  };
  if (pedagogicalMeta != null) {
    entry.pedagogicalMeta = pedagogicalMeta;
  }
  localStorage.setItem(cacheKey(hash), JSON.stringify(entry));
  touchIndex(hash);
  evictOverflow();
}

export const _internals = {
  CACHE_PREFIX,
  INDEX_KEY,
  TTL_MS,
  MAX_ENTRIES,
};
