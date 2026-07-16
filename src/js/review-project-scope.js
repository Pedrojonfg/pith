/**
 * Pure review filtering by project scope — dual pool (session smItems + vault reviewItems).
 * @see specs/20260624-knowledge-vault-curation/contracts/review-dual-pool.md
 */

import { normalizeVaultReviewItemForQueue } from "./vault/vault-curation.js";
import { loadVault } from "./vault/vault-store.js";
import { getDescendantIds } from "./project-store.js";
import { getAllSessions, getProjectStore, getSession } from "./session-store.js";
import { normalizeSmItem } from "./sm2.js";

/**
 * @param {string} projectId
 * @param {{ includeDescendants?: boolean }} [opts]
 * @returns {object[]}
 */
export async function getReviewableItemsForProject(projectId, opts = {}) {
  const includeDescendants = opts.includeDescendants !== false;
  // [debug-enrich]
  console.info('[review-project-scope.getReviewableItemsForProject] Filtering:', {
    projectId,
    includeDescendants,
  });
  const sessions = await getAllSessions();
  const vault = loadVault();

  if (projectId === "all") {
    const smPool = sessions.flatMap((session) =>
      (session.shared?.smItems || []).map((raw) => ({
        ...normalizeSmItem({ ...raw, docId: session.docId }),
        source: "session",
      })),
    );
    const vaultPool = (vault.reviewItems || [])
      .map((item) => normalizeVaultReviewItemForQueue(item))
      .filter(Boolean);
    const result = [...smPool.filter((i) => i?.id), ...vaultPool];
    // [debug-enrich]
    console.info('[review-project-scope.getReviewableItemsForProject] All-projects pool:', {
      sessionCount: sessions.length,
      smCount: smPool.filter((i) => i?.id).length,
      vaultCount: vaultPool.length,
      total: result.length,
    });
    return result;
  }

  const store = getProjectStore();
  const scopeIds = new Set(
    includeDescendants
      ? getDescendantIds(store, projectId, { includeSelf: true })
      : [projectId],
  );

  const scopedSessions = sessions.filter(
    (s) => s?.projectId && scopeIds.has(String(s.projectId)),
  );
  const smPoolItems = scopedSessions.flatMap((session) =>
    (session.shared?.smItems || []).map((raw) => ({
      ...normalizeSmItem({ ...raw, docId: session.docId }),
      source: "session",
    })),
  );

  const vaultPoolItems = [];
  let vaultSkippedNoOrigin = 0;
  let vaultSkippedOutOfScope = 0;
  for (const item of vault.reviewItems || []) {
    const origin = await getSession(item?.sourceDocId);
    if (!origin) {
      vaultSkippedNoOrigin += 1;
      continue;
    }
    if (!origin?.projectId || !scopeIds.has(String(origin.projectId))) {
      vaultSkippedOutOfScope += 1;
      continue;
    }
    const normalized = normalizeVaultReviewItemForQueue(item);
    if (normalized) vaultPoolItems.push(normalized);
  }

  const result = [...smPoolItems.filter((i) => i?.id), ...vaultPoolItems];
  // [debug-enrich]
  console.info('[review-project-scope.getReviewableItemsForProject] Scoped pool:', {
    projectId,
    scopeIdCount: scopeIds.size,
    scopedSessionCount: scopedSessions.length,
    smCount: smPoolItems.filter((i) => i?.id).length,
    vaultCount: vaultPoolItems.length,
    vaultSkippedNoOrigin,
    vaultSkippedOutOfScope,
    total: result.length,
  });
  return result;
}

export function filterDueSmItems(items) {
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const cutoff = endOfDay.getTime();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const scheduledDue = Number(item?.scheduledDue);
    return !Number.isFinite(scheduledDue) || scheduledDue <= cutoff;
  });
}

/**
 * @param {object[]} [items]
 */
export function countDueReviewItems(items) {
  return filterDueSmItems(items).length;
}
