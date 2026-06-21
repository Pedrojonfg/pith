/**
 * Pure embedding math helpers (no I/O).
 */

/**
 * @param {number[]} a
 * @param {number[]} b
 */
export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

/**
 * @param {number} maxSim
 */
export function computeNoveltyScore(maxSim) {
  if (!Number.isFinite(maxSim)) return null;
  return Math.max(0, Math.min(1, 1 - maxSim));
}

/**
 * @param {string} a
 * @param {string} b
 */
export function canonicalConceptPair(a, b) {
  const idA = String(a || "").trim();
  const idB = String(b || "").trim();
  return idA < idB ? [idA, idB] : [idB, idA];
}

/**
 * @param {string} docIdA
 * @param {string} docIdB
 */
export function canonicalDocPair(docIdA, docIdB) {
  return canonicalConceptPair(docIdA, docIdB);
}
