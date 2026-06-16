/**
 * RSVP Pipeline Levers — pure helpers (feature 20260617-pipeline-levers).
 */

export const ZERO_QUESTION_TITLE_PATTERNS = [
  /^Key terms:/i,
  /^Overview:/i,
  /^Course map:/i,
];

export function isZeroQuestionBlockTitle(title) {
  const t = String(title || "").trim();
  return ZERO_QUESTION_TITLE_PATTERNS.some((re) => re.test(t));
}

export function isKeyTermsBlockTitle(title) {
  return /^Key terms:/i.test(String(title || "").trim());
}

export function deriveBlockType(title) {
  const t = String(title || "").trim();
  if (/^Key terms:/i.test(t)) return "key_terms";
  if (/^(Overview|Course map):/i.test(t)) return "overview";
  if (/excursus/i.test(t)) return "excursus";
  return "development";
}

export const DEFAULT_PIPELINE_LEVERS_STRICT = Object.freeze({
  dedupSignatureOverlapThreshold: 2,
  minChunkWords: 400,
  overlapPenaltyTermThreshold: 0.4,
  jaccardThreshold: { strict: 0.35, normal: 0.2 },
  claimCoverageMin: 0.6,
  inventoryCap: 120,
  semanticDedupEnabled: false,
});

export const DEFAULT_PIPELINE_LEVERS_NORMAL = Object.freeze({
  dedupSignatureOverlapThreshold: 3,
  minChunkWords: 400,
  overlapPenaltyTermThreshold: 0.4,
  jaccardThreshold: { strict: 0.35, normal: 0.2 },
  claimCoverageMin: 0.5,
  inventoryCap: 120,
  semanticDedupEnabled: false,
});

export function initPipelineLevers(strictMode = false, existing = null) {
  const defaults = strictMode
    ? { ...DEFAULT_PIPELINE_LEVERS_STRICT }
    : { ...DEFAULT_PIPELINE_LEVERS_NORMAL };
  if (existing && typeof existing === "object") {
    return { ...defaults, ...existing };
  }
  return defaults;
}

export function computeEstimatedConceptTarget(wordCount, pipelineLevers = {}) {
  const cap = Number(pipelineLevers.inventoryCap) || 120;
  const floor = 30;
  const raw = Math.round(Number(wordCount) / 300) * 2;
  return Math.max(floor, Math.min(cap, raw));
}

const BLOCK_TYPE_SCOPE = {
  key_terms: {
    allowed: ["definition", "classification", "etymology", "term contrast"],
    forbidden: ["application", "argument analysis", "consequences"],
  },
  overview: {
    allowed: [],
    forbidden: ["all"],
  },
  development: {
    allowed: ["application", "contrast", "argument", "consequence", "example"],
    forbidden: ["definition of terms in preceding Key terms of same module"],
  },
  excursus: {
    allowed: ["connection to main concept", "implication"],
    forbidden: ["standalone definition"],
  },
};

function extractModuleFromTitle(title) {
  const t = String(title || "").trim();
  const kt = t.match(/^Key terms:\s*(.+)$/i);
  if (kt) return kt[1].trim();
  return "";
}

function collectSignatureTerms(block, conceptInventory = []) {
  const terms = new Set();
  const sig = Array.isArray(block?.signature) ? block.signature : [];
  for (const s of sig) {
    const v = String(s || "").trim();
    if (v) terms.add(v);
  }
  const ids = Array.isArray(block?.concept_ids) ? block.concept_ids : [];
  const byId = new Map(
    (Array.isArray(conceptInventory) ? conceptInventory : [])
      .filter((c) => c && c.id)
      .map((c) => [String(c.id), c]),
  );
  for (const cid of ids) {
    const c = byId.get(String(cid));
    const title = String(c?.title || "").trim();
    if (title) terms.add(title);
  }
  return [...terms];
}

/**
 * @param {number} blockIndex 0-based
 * @param {object[]} blockIndexArray
 * @param {object[]} [conceptInventory]
 * @param {object[]} [coverageManifest]
 */
export function buildQuestionScopeContext(
  blockIndex,
  blockIndexArray = [],
  conceptInventory = [],
  coverageManifest = [],
) {
  const blocks = Array.isArray(blockIndexArray) ? blockIndexArray : [];
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  const entry = blocks[idx] || {};
  const title = String(entry.title || "").trim();
  const block_type = deriveBlockType(title);
  const scope = BLOCK_TYPE_SCOPE[block_type] || BLOCK_TYPE_SCOPE.development;

  let precedingKeyTermsSignature = [];
  if (block_type === "development") {
    const moduleHint =
      String(entry.module || "").trim() ||
      extractModuleFromTitle(blocks.find((b) => deriveBlockType(b?.title) === "key_terms")?.title || "");
    for (let i = idx - 1; i >= 0; i -= 1) {
      const prev = blocks[i];
      if (!prev) continue;
      const prevType = deriveBlockType(prev.title);
      if (prevType === "key_terms") {
        const prevMod = extractModuleFromTitle(prev.title) || String(prev.module || "").trim();
        if (!moduleHint || !prevMod || prevMod === moduleHint) {
          precedingKeyTermsSignature = collectSignatureTerms(prev, conceptInventory);
          break;
        }
      }
    }
  }

  const alreadyQuestionedTerms = buildAlreadyQuestionedTerms(coverageManifest, blocks, idx);

  return {
    block_type,
    allowed: [...scope.allowed],
    forbidden: [...scope.forbidden],
    precedingKeyTermsSignature,
    alreadyQuestionedTerms,
  };
}

export function buildAlreadyQuestionedTerms(coverageManifest = [], blockIndexArray = [], upToIndex = Infinity) {
  const terms = new Set();
  const cap = Number.isFinite(upToIndex) ? upToIndex : Infinity;
  for (const entry of Array.isArray(coverageManifest) ? coverageManifest : []) {
    if (!entry || typeof entry !== "object") continue;
    if (Number(entry.blockId) - 1 >= cap) continue;
    for (const t of Array.isArray(entry.keyTerms) ? entry.keyTerms : []) {
      const v = String(t || "").trim();
      if (v) terms.add(v);
    }
  }
  const blocks = Array.isArray(blockIndexArray) ? blockIndexArray : [];
  for (let i = 0; i < blocks.length && i < cap; i += 1) {
    const block = blocks[i];
    const qs = Array.isArray(block?.questions) ? block.questions : [];
    for (const q of qs) {
      extractTermsFromQuestionText(q?.question, terms);
      if (q?.options && typeof q.options === "object") {
        for (const opt of Object.values(q.options)) {
          extractTermsFromQuestionText(opt, terms);
        }
      }
    }
  }
  return [...terms];
}

function extractTermsFromQuestionText(text, termSet) {
  const raw = String(text || "").trim();
  if (!raw) return;
  const quoted = raw.match(/["«]([^"»]{3,60})["»]/g);
  if (quoted) {
    for (const m of quoted) {
      const inner = m.replace(/^["«]|["»]$/g, "").trim();
      if (inner.length >= 3) termSet.add(inner);
    }
  }
  const caps = raw.match(/\b[A-ZÁÉÍÓÚ][a-záéíóúñ]{3,}\b/g);
  if (caps) {
    for (const c of caps) termSet.add(c);
  }
}

function inferClaimTypeFromStem(stem) {
  const s = String(stem || "").toLowerCase();
  if (/qué es|what is|define|definición|definir/.test(s)) return "definition";
  if (/por qué|why|argument|razón/.test(s)) return "argument";
  if (/ejemplo|example|illustrat/.test(s)) return "example";
  if (/contraste|contrast|diferencia|difference/.test(s)) return "contrast";
  return "argument";
}

/**
 * @param {number} blockId 1-based
 * @param {object[]} questions
 * @returns {import('./pipeline-levers.js').CoveredClaim[]}
 */
export function extractClaimsFromQuestions(blockId, questions) {
  const out = [];
  const qs = Array.isArray(questions) ? questions : [];
  for (const q of qs) {
    if (!q || typeof q !== "object") continue;
    const stem = String(q.question || "").trim();
    if (!stem) continue;
    const keyTerms = [];
    const terms = new Set();
    extractTermsFromQuestionText(stem, terms);
    if (q?.options && typeof q.options === "object") {
      for (const opt of Object.values(q.options)) extractTermsFromQuestionText(opt, terms);
    }
    keyTerms.push(...terms);
    out.push({
      blockId: Number(blockId) || 1,
      claimType: inferClaimTypeFromStem(stem),
      keyTerms: keyTerms.slice(0, 8),
      questionAsked: stem.slice(0, 120),
    });
  }
  return out;
}

export function appendCoverageClaims(manifest, claims) {
  const base = Array.isArray(manifest) ? manifest.slice() : [];
  const incoming = Array.isArray(claims) ? claims : [];
  return base.concat(incoming);
}

export function replaceCoverageForBlock(manifest, blockId, claims) {
  const id = Number(blockId);
  const base = (Array.isArray(manifest) ? manifest : []).filter(
    (c) => !c || Number(c.blockId) !== id,
  );
  return base.concat(Array.isArray(claims) ? claims : []);
}

export function sliceCoverageManifestForPrompt(manifest, limit = 20) {
  const arr = Array.isArray(manifest) ? manifest : [];
  return arr.slice(-Math.max(1, limit));
}

export function annotateBlockIndexEntry(block) {
  if (!block || typeof block !== "object") return block;
  const title = String(block.title || "").trim();
  const block_type = deriveBlockType(title);
  const study_sequence = block_type === "key_terms" ? false : block.study_sequence !== false;
  return { ...block, block_type, study_sequence };
}

/**
 * Next linear study block index, skipping glossary (study_sequence: false).
 * @param {number} fromIndex 0-based current
 * @param {object[]} blockIndexArray
 * @param {number} total
 */
export function resolveNextStudyBlockIndex(fromIndex, blockIndexArray, total) {
  const n = Math.max(0, Math.floor(Number(total) || 0));
  let next = Math.max(0, Math.floor(Number(fromIndex) || 0)) + 1;
  const blocks = Array.isArray(blockIndexArray) ? blockIndexArray : [];
  while (next < n) {
    const entry = blocks[next];
    if (entry && entry.study_sequence === false) {
      next += 1;
      continue;
    }
    if (entry && isKeyTermsBlockTitle(entry.title) && entry.study_sequence !== true) {
      next += 1;
      continue;
    }
    break;
  }
  return next;
}

export function overlapAuditNeedsRetry(auditResult) {
  if (!auditResult || typeof auditResult !== "object") return false;
  if (auditResult.action === "regen" || auditResult.overlap_severity === "high") return true;
  return false;
}

export function overlapAuditOverlappingConcepts(auditResult) {
  if (!auditResult || typeof auditResult !== "object") return [];
  return Array.isArray(auditResult.redundant_claims)
    ? auditResult.redundant_claims.map((c) => String(c || "").trim()).filter(Boolean)
    : [];
}

/** Lightweight summary similarity for optional semantic dedup (L12). */
export function findSemanticDuplicatePairs(blockIndex, threshold = 0.85) {
  const blocks = Array.isArray(blockIndex) ? blockIndex : [];
  const pairs = [];
  for (let i = 0; i < blocks.length; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      const a = String(blocks[i]?.summary || blocks[i]?.title || "").trim();
      const b = String(blocks[j]?.summary || blocks[j]?.title || "").trim();
      if (!a || !b) continue;
      const sim = tokenJaccard(a, b);
      if (sim >= threshold) {
        pairs.push({ keep_id: Number(blocks[i].id), absorb_id: Number(blocks[j].id), similarity: sim });
      }
    }
  }
  return pairs;
}

function tokenJaccard(a, b) {
  const setA = new Set(
    String(a)
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length >= 4),
  );
  const setB = new Set(
    String(b)
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length >= 4),
  );
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter += 1;
  const union = setA.size + setB.size - inter;
  return union > 0 ? inter / union : 0;
}
