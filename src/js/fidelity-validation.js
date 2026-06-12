/**
 * Post-generation block fidelity validation — Phase B of 20260613-source-fidelity.
 */

const STOPWORDS = new Set([
  "about",
  "after",
  "also",
  "been",
  "before",
  "being",
  "between",
  "both",
  "could",
  "each",
  "from",
  "have",
  "into",
  "more",
  "most",
  "other",
  "over",
  "same",
  "some",
  "such",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "very",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
]);

function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function significantTokens(text) {
  return normalize(text)
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

function jaccardOverlap(a, b) {
  const setA = new Set(significantTokens(a));
  const setB = new Set(significantTokens(b));
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) inter += 1;
  }
  const union = setA.size + setB.size - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * @param {{ blockTitle?: string, signature?: string[]|string, concepts?: object[] }} meta
 */
export function extractKeyTermsFromBlockMeta({ blockTitle = "", signature = [], concepts = [] } = {}) {
  const terms = new Set();
  for (const t of significantTokens(blockTitle)) terms.add(t);

  const sig = signature;
  if (Array.isArray(sig)) {
    for (const s of sig) {
      for (const t of significantTokens(String(s || ""))) terms.add(t);
    }
  } else if (typeof sig === "string") {
    for (const t of significantTokens(sig)) terms.add(t);
  }

  const list = Array.isArray(concepts) ? concepts : [];
  for (const c of list) {
    const term = String(c?.term || "").trim();
    if (term.length >= 4) terms.add(normalize(term));
  }
  return [...terms];
}

function countChunkKeyTermsInExplanation(chunk, explanation) {
  const chunkTokens = new Set(significantTokens(chunk));
  if (!chunkTokens.size) return { ratio: 1, total: 0, covered: 0 };
  const explNorm = normalize(explanation);
  let covered = 0;
  for (const t of chunkTokens) {
    if (explNorm.includes(t)) covered += 1;
  }
  return { ratio: covered / chunkTokens.size, total: chunkTokens.size, covered };
}

function claimCoveredInExplanation(claim, explanation) {
  const text = String(claim?.text || claim?.source_phrase || "").trim();
  if (!text) return false;
  const explNorm = normalize(explanation);
  const claimNorm = normalize(text);
  if (claimNorm.length >= 8 && explNorm.includes(claimNorm.slice(0, Math.min(40, claimNorm.length)))) {
    return true;
  }
  const terms = Array.isArray(claim?.terms) ? claim.terms : [];
  if (terms.length) {
    let hit = 0;
    for (const t of terms) {
      const n = normalize(String(t || ""));
      if (n.length >= 4 && explNorm.includes(n)) hit += 1;
    }
    if (hit >= Math.ceil(terms.length * 0.5)) return true;
  }
  return jaccardOverlap(explanation, text) >= 0.2;
}

/**
 * @param {{ blockTitle?: string, signature?: string[]|string, chunk?: string, explanation?: string, concepts?: object[], anchor_quality?: string, isRetry?: boolean, strictMode?: boolean, extractedClaims?: object[], claimCoverageMin?: number }} args
 */
export function validateBlockFidelity({
  blockTitle = "",
  signature = [],
  chunk = "",
  explanation = "",
  concepts = [],
  anchor_quality = "strong",
  isRetry = false,
  strictMode = false,
  extractedClaims = null,
  claimCoverageMin = null,
} = {}) {
  const keyTerms = extractKeyTermsFromBlockMeta({ blockTitle, signature, concepts });
  const normChunk = normalize(chunk);
  const unsupported_terms = [];

  for (const term of keyTerms) {
    if (normChunk.includes(term)) continue;
    if (jaccardOverlap(explanation, chunk) >= 0.12) continue;
    unsupported_terms.push(term);
  }

  const jaccard = jaccardOverlap(explanation, chunk);
  const chunkCov = countChunkKeyTermsInExplanation(chunk, explanation);
  const chunk_coverage = chunkCov.ratio;

  const claims = Array.isArray(extractedClaims) ? extractedClaims : [];
  const uncoveredClaims = claims.filter((c) => !claimCoveredInExplanation(c, explanation));
  const claimCoverageRatio =
    claims.length > 0 ? (claims.length - uncoveredClaims.length) / claims.length : 1;

  const minCoverage =
    claimCoverageMin != null && Number.isFinite(Number(claimCoverageMin))
      ? Number(claimCoverageMin)
      : strictMode
        ? 0.6
        : 0.5;

  const chunkWarnThreshold = strictMode ? 0.5 : 0.4;
  let severity = "ok";
  let action = "accept";
  let ok = true;

  if (unsupported_terms.length > 0) {
    if (unsupported_terms.length <= 1 && anchor_quality === "weak" && !isRetry) {
      // accept weak anchor
    } else {
      ok = false;
      action = isRetry ? "warn" : "retry";
      severity = isRetry ? "warn" : "retry";
    }
  }

  if (claims.length > 0 && claimCoverageRatio < minCoverage && !isRetry) {
    ok = false;
    action = "retry";
    severity = "retry";
  } else if (claims.length > 0 && claimCoverageRatio < minCoverage && isRetry) {
    severity = "warn";
    action = "warn";
  }

  if (chunk_coverage < chunkWarnThreshold && severity === "ok") {
    severity = "warn";
  }

  if (unsupported_terms.length === 0 && severity === "ok") {
    return {
      ok: true,
      action: "accept",
      severity: "none",
      unsupported_terms: [],
      jaccard,
      chunk_coverage,
      claimCoverageRatio,
      uncoveredClaims: uncoveredClaims.map((c) => ({
        source_phrase: String(c?.text || c?.source_phrase || "").trim(),
        type: String(c?.type || "").trim(),
      })),
    };
  }

  return {
    ok,
    action,
    severity,
    unsupported_terms,
    jaccard,
    chunk_coverage,
    claimCoverageRatio,
    uncoveredClaims: uncoveredClaims.map((c) => ({
      source_phrase: String(c?.text || c?.source_phrase || "").trim(),
      type: String(c?.type || "").trim(),
    })),
  };
}
