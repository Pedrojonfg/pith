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
    .split(/[^a-z0-9áéíóúüñ]+/i)
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

/**
 * @param {{ blockTitle?: string, signature?: string[]|string, chunk?: string, explanation?: string, concepts?: object[], anchor_quality?: string, isRetry?: boolean }} args
 */
export function validateBlockFidelity({
  blockTitle = "",
  signature = [],
  chunk = "",
  explanation = "",
  concepts = [],
  anchor_quality = "strong",
  isRetry = false,
} = {}) {
  const keyTerms = extractKeyTermsFromBlockMeta({ blockTitle, signature, concepts });
  const normChunk = normalize(chunk);
  const unsupported_terms = [];

  for (const term of keyTerms) {
    if (normChunk.includes(term)) continue;
    if (jaccardOverlap(explanation, chunk) >= 0.12) continue;
    unsupported_terms.push(term);
  }

  if (unsupported_terms.length === 0) {
    return { ok: true, action: "accept", severity: "none", unsupported_terms: [] };
  }

  if (
    unsupported_terms.length <= 1 &&
    anchor_quality === "weak" &&
    !isRetry
  ) {
    return { ok: true, action: "accept", severity: "none", unsupported_terms };
  }

  return {
    ok: false,
    action: isRetry ? "warn" : "retry",
    severity: isRetry ? "warn" : "retry",
    unsupported_terms,
  };
}
