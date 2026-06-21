/**
 * R1 — Novelty scoring for concept inventory (DPP T1.8).
 */

import { getProjectStore } from "../session-store.js";
import { getAncestorChain } from "../project-store.js";
import { loadRegistry } from "../concept-registry/registry-store.js";
import { isVaultNoveltyScoringEnabled } from "../config/flags.js";
import {
  buildConceptEmbedText,
  embedText,
  isVaultEmbeddingsEnabled,
  computeNoveltyScore,
} from "./embeddings.js";
import { findNearestConcepts } from "./embedding-persist.js";

/**
 * @param {string} projectId
 */
export function getProjectScopeIds(projectId) {
  const pid = String(projectId || "").trim();
  if (!pid || pid === "misc") return [];
  const store = getProjectStore();
  return getAncestorChain(store, pid).map((p) => p.id);
}

/**
 * Count registry concepts with embeddings in project scope (proxy for non-empty vault).
 * @param {string[]} projectIds
 */
export function countScopedRegistryConcepts(projectIds) {
  if (!projectIds?.length) return 0;
  const registry = loadRegistry();
  const concepts = registry?.concepts || [];
  return concepts.filter((c) => {
    if (c?.merged_into) return false;
    const sources = c?.sourceDocIds || [];
    return sources.length > 0;
  }).length;
}

/**
 * @param {object} doc
 */
export async function scoreConceptNovelty(doc) {
  if (!isVaultNoveltyScoringEnabled() || !isVaultEmbeddingsEnabled()) {
    return { status: "skipped", reason: "embeddings_disabled" };
  }

  const inventory = doc?.shared?.conceptInventory;
  if (!Array.isArray(inventory) || !inventory.length) {
    return { status: "success", scored: 0 };
  }

  const projectId = String(doc?.projectId || "misc").trim();
  const projectIds = getProjectScopeIds(projectId);

  const unresolved = inventory.filter((entry) => {
    const gid = String(entry?.globalConceptId || "").trim();
    return !gid;
  });

  if (!unresolved.length) {
    return { status: "success", scored: 0 };
  }

  // Empty vault scope → all novel, no API calls (R1.3)
  if (!projectIds.length || countScopedRegistryConcepts(projectIds) === 0) {
    for (const entry of unresolved) {
      entry.noveltyScore = 1.0;
    }
    return { status: "success", scored: unresolved.length, shortCircuit: "empty_vault" };
  }

  let scored = 0;
  for (const entry of unresolved) {
    const conceptId = String(entry?.globalConceptId || entry?.canonicalId || entry?.id || "").trim();
    const text = buildConceptEmbedText(entry);
    if (!text) {
      entry.noveltyScore = null;
      continue;
    }
    try {
      const embedding = await embedText(text, {
        conceptId,
        projectId: projectId !== "misc" ? projectId : null,
        scopeType: "concept",
      });
      const nearest = await findNearestConcepts(embedding, {
        matchCount: 5,
        projectIds,
        excludeConceptId: conceptId,
      });
      const maxSim = nearest.length ? Math.max(...nearest.map((n) => n.similarity)) : 0;
      entry.noveltyScore = computeNoveltyScore(maxSim);
      scored += 1;
    } catch (err) {
      console.warn("[novelty] score failed for", conceptId, err?.message || err);
      entry.noveltyScore = null;
    }
  }

  return { status: "success", scored };
}

/**
 * @param {object[]} inventory
 */
export function computeAverageNovelty(inventory) {
  const scores = (Array.isArray(inventory) ? inventory : [])
    .map((e) => e?.noveltyScore)
    .filter((v) => v != null && Number.isFinite(v));
  if (!scores.length) return null;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(avg * 100);
}
