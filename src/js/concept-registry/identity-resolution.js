/**
 * Identity resolution for global concepts — slug/alias fuzzy match, split bias.
 * @see specs/20260626-cross-doc-vault/contracts/identity-resolution.md
 */

import {
  findConceptCandidates,
  getConceptBySlug,
  normalizeSlug,
  upsertConcept,
  addSourceDocId,
} from "./registry-store.js";

const HIGH_CONFIDENCE = 0.85;
const MEDIUM_CONFIDENCE = 0.6;

function scoreMatch(candidate, name, slug) {
  const nameLower = String(name || "").trim().toLowerCase();
  if (candidate.slug === slug) return 1;
  if (candidate.aliases.some((a) => a.toLowerCase() === nameLower)) return 0.95;
  return tokenOverlap(candidate.canonicalName.toLowerCase(), nameLower);
}

function tokenOverlap(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const setB = new Set(b.split(/\s+/));
  let matches = 0;
  const wordsA = a.split(/\s+/);
  for (const w of wordsA) {
    if (setB.has(w)) matches += 1;
  }
  return matches / Math.max(wordsA.length, b.split(/\s+/).length, 1);
}

function newConceptId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `concept-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @param {object} params
 * @returns {Promise<{ conceptId: string, created: boolean, relatedHintIds?: string[] }>}
 */
export async function resolveGlobalConcept({
  canonicalName,
  description = "",
  sourceDocId,
  inventoryEntryId = "",
}) {
  const name = String(canonicalName || "").trim();
  const slug = normalizeSlug(name);
  if (!name || !slug) {
    // [debug-enrich]
    console.error('[identity-resolution.resolveGlobalConcept] Empty canonicalName');
    throw new Error("resolveGlobalConcept requires canonicalName");
  }

  // [debug-enrich]
  console.debug('[identity-resolution.resolveGlobalConcept] Resolving:', {
    name: name.slice(0, 80),
    slug,
    sourceDocId: sourceDocId ?? null,
    inventoryEntryId: inventoryEntryId || null,
  });

  const exact = getConceptBySlug(slug);
  if (exact) {
    addSourceDocId(exact.id, sourceDocId);
    // [debug-enrich]
    console.info('[identity-resolution.resolveGlobalConcept] Exact slug match:', {
      conceptId: exact.id,
      slug,
      created: false,
    });
    return { conceptId: exact.id, created: false };
  }

  const candidates = findConceptCandidates(name, description);
  let best = null;
  let bestScore = 0;
  const relatedHintIds = [];

  for (const c of candidates) {
    const score = scoreMatch(c, name, slug);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
    if (score >= MEDIUM_CONFIDENCE && score < HIGH_CONFIDENCE) {
      relatedHintIds.push(c.id);
    }
  }

  if (best && bestScore >= HIGH_CONFIDENCE) {
    const aliases = best.aliases.includes(name) ? best.aliases : [...best.aliases, name];
    upsertConcept({ ...best, aliases });
    addSourceDocId(best.id, sourceDocId);
    // [debug-enrich]
    console.info('[identity-resolution.resolveGlobalConcept] High-confidence fuzzy match:', {
      conceptId: best.id,
      bestScore,
      candidateCount: candidates.length,
      created: false,
    });
    return { conceptId: best.id, created: false };
  }

  const id = newConceptId();
  const concept = upsertConcept({
    id,
    canonicalName: name,
    slug,
    aliases: name !== slug ? [name] : [],
    maturity: "yellow",
    mastery: 0,
    facets: [],
    content: null,
    sourceDocIds: sourceDocId ? [sourceDocId] : [],
    relatedConceptIds:
      best && bestScore >= MEDIUM_CONFIDENCE ? [best.id, ...relatedHintIds] : relatedHintIds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // [debug-enrich]
  console.info('[identity-resolution.resolveGlobalConcept] Created new concept:', {
    conceptId: concept.id,
    slug,
    bestScore,
    relatedHintCount: relatedHintIds.length,
    created: true,
  });

  return {
    conceptId: concept.id,
    created: true,
    relatedHintIds: concept.relatedConceptIds,
  };
}

export { normalizeSlug };
