/**
 * Pure review filtering by project scope.
 * @see specs/20260623-study-projects/contracts/review-project-scope.md
 */

import { getDescendantIds } from "./project-store.js";
import { getAllSessions, getProjectStore } from "./session-store.js";
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
  if (projectId === "all") {
    return sessions.flatMap((session) =>
      (session.shared?.smItems || []).map((raw) =>
        normalizeSmItem({ ...raw, docId: session.docId }),
      ),
    );
  }
  const store = getProjectStore();
  const scopeIds = new Set(
    includeDescendants
      ? getDescendantIds(store, projectId, { includeSelf: true })
      : [projectId],
  );
  return sessions
    .filter((s) => scopeIds.has(String(s?.projectId || MISC_PROJECT_ID)))
    .flatMap((session) =>
      (session.shared?.smItems || []).map((raw) =>
        normalizeSmItem({ ...raw, docId: session.docId }),
      ),
    );
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
