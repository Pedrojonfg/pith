/**
 * Pure review filtering by project scope — dual pool (session smItems + vault reviewItems).
 * @see specs/20260624-knowledge-vault-curation/contracts/review-dual-pool.md
 */

import { normalizeVaultReviewItemForQueue } from "./vault/vault-curation.js";
import { loadVault } from "./vault/vault-store.js";
import { getDescendantIds } from "./project-store.js";
import { getAllSessions, getProjectStore, getSession } from "./session-store.js";
import { MISC_PROJECT_ID } from "./session-types.js";
import { normalizeSmItem } from "./sm2.js";

/**
 * @param {string} projectId
 * @param {{ includeDescendants?: boolean }} [opts]
 * @returns {object[]}
 */
export function getReviewableItemsForProject(projectId, opts = {}) {
  const includeDescendants = opts.includeDescendants !== false;
  const sessions = getAllSessions();
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
    return [...smPool.filter((i) => i?.id), ...vaultPool];
  }

  const store = getProjectStore();
  const scopeIds = new Set(
    includeDescendants
      ? getDescendantIds(store, projectId, { includeSelf: true })
      : [projectId],
  );

  const smPoolItems = sessions
    .filter((s) => scopeIds.has(String(s?.projectId || MISC_PROJECT_ID)))
    .flatMap((session) =>
      (session.shared?.smItems || []).map((raw) => ({
        ...normalizeSmItem({ ...raw, docId: session.docId }),
        source: "session",
      })),
    );

  const vaultPoolItems = (vault.reviewItems || [])
    .filter((item) => {
      const origin = getSession(item?.sourceDocId);
      if (!origin) return false;
      return scopeIds.has(String(origin?.projectId || MISC_PROJECT_ID));
    })
    .map((item) => normalizeVaultReviewItemForQueue(item))
    .filter(Boolean);

  return [...smPoolItems.filter((i) => i?.id), ...vaultPoolItems];
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
