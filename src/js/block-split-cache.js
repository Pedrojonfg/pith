import { state } from "./session.js";

/**
 * Ephemeral RSVP create-flow cache for concept inventory + block recommendation.
 *
 * Invalidation triggers (T05 wiring will call invalidateBlockSplitCache):
 * - fileInput change (new upload / replace)
 * - studyNotesInput change (debounced)
 * - studyMode !== 'rsvp'
 *
 * Does NOT invalidate:
 * - blocksInput change alone (user may tweak N after recommend)
 */

function normalizeStudyNotes(studyNotes) {
  return String(studyNotes ?? "").trim();
}

function normalizeWordCount(wordCount) {
  const n = Number(wordCount);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function buildFileKey(file) {
  if (!file || typeof file !== "object") return "";
  const name = String(file.name ?? "");
  const size = Number(file.size);
  const lastModified = Number(file.lastModified);
  const sizePart = Number.isFinite(size) ? size : 0;
  const modPart = Number.isFinite(lastModified) ? lastModified : 0;
  return `${name}:${sizePart}:${modPart}`;
}

function fingerprintsEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.fileKey === b.fileKey &&
    a.studyNotes === b.studyNotes &&
    a.wordCount === b.wordCount
  );
}

/**
 * @param {{ file?: File | { name?: string, size?: number, lastModified?: number } | null, studyNotes?: string, wordCount?: number }} params
 * @returns {{ fileKey: string, studyNotes: string, wordCount: number }}
 */
export function buildBlockSplitFingerprint({ file, studyNotes, wordCount } = {}) {
  return {
    fileKey: buildFileKey(file),
    studyNotes: normalizeStudyNotes(studyNotes),
    wordCount: normalizeWordCount(wordCount),
  };
}

/**
 * @param {{ fingerprint?: object, conceptInventory?: object[] } | null | undefined} cache
 * @param {{ fileKey: string, studyNotes: string, wordCount: number }} fingerprint
 */
export function isBlockSplitCacheValid(cache, fingerprint) {
  if (!cache || !fingerprint) return false;
  const inventory = cache.conceptInventory;
  if (!Array.isArray(inventory) || inventory.length === 0) return false;
  return fingerprintsEqual(cache.fingerprint, fingerprint);
}

export function getBlockSplitCache() {
  return state.blockSplitCache ?? null;
}

/**
 * @param {{ fingerprint: object, conceptInventory: object[], recommendation?: object | null }} payload
 */
export function setBlockSplitCache({ fingerprint, conceptInventory, recommendation = null }) {
  state.blockSplitCache = {
    fingerprint,
    conceptInventory: Array.isArray(conceptInventory) ? conceptInventory : [],
    recommendation: recommendation ?? null,
    indexedAt: Date.now(),
  };
  return state.blockSplitCache;
}

export function invalidateBlockSplitCache() {
  state.blockSplitCache = null;
}
