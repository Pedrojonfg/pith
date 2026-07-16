/** Project membership for vault entries (resolve + filter). */

export const MISC_PROJECT_ID = "misc";

/**
 * @param {string} [raw]
 * @returns {string}
 */
export function normalizePlaceNameForCache(raw) {
  return String(raw || "").trim().toLowerCase();
}

/**
 * @param {object} entry
 * @param {Record<string, { projectId?: string }|null|undefined>} [sessionsByDocId]
 * @returns {string[]}
 */
export function resolveVaultEntryProjectIds(entry, sessionsByDocId = {}) {
  const denorm = Array.isArray(entry?.projectIds)
    ? entry.projectIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  if (denorm.length) return [...new Set(denorm)];

  const out = new Set();
  for (const s of entry?.sources || []) {
    const docId = String(s?.docId || "").trim();
    if (!docId) continue;
    const session = sessionsByDocId[docId];
    const pid = String(session?.projectId || "").trim() || MISC_PROJECT_ID;
    out.add(pid);
  }
  if (out.size === 0) out.add(MISC_PROJECT_ID);
  return [...out];
}

/**
 * @param {object} entry
 * @param {Set<string>|string[]} checkedProjectIds
 * @param {Record<string, { projectId?: string }|null|undefined>} [sessionsByDocId]
 * @returns {boolean}
 */
export function entryMatchesProjectFilter(entry, checkedProjectIds, sessionsByDocId = {}) {
  const checked =
    checkedProjectIds instanceof Set
      ? checkedProjectIds
      : new Set((checkedProjectIds || []).map((id) => String(id || "").trim()).filter(Boolean));
  if (checked.size === 0) return false;
  const membership = resolveVaultEntryProjectIds(entry, sessionsByDocId);
  return membership.some((pid) => checked.has(pid));
}

/**
 * Additive denormalized projectIds on a vault entry.
 * @param {object} entry
 * @param {string} [projectId]
 */
export function mergeProjectIdsOntoEntry(entry, projectId) {
  if (!entry) return;
  const pid = String(projectId || "").trim() || MISC_PROJECT_ID;
  if (!Array.isArray(entry.projectIds)) entry.projectIds = [];
  if (!entry.projectIds.includes(pid)) entry.projectIds.push(pid);
}
