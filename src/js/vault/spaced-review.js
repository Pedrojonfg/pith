/** Vault decay → shared.smItems bridge for spaced review scheduling. */

import { getSession, saveActiveSession } from "../session-store.js";
import { getCurrentMastery } from "./mastery-model.js";
import { getActiveMisconceptions } from "./misconceptions.js";
import { computeImportanceScore } from "./prerequisite-graph.js";
import { applyObservations } from "./session-close.js";
import { getEntriesByTopic, loadVault, saveVault } from "./vault-store.js";

export const PARTIAL_MASTERY_THRESHOLD = 0.5;
const PRIORITY_SCHEDULE_MS = 30 * 86_400_000;
const VAULT_SM_ID_PREFIX = "vault:";

/**
 * @param {object} entry
 * @param {object} vault
 * @param {number} [now]
 * @returns {number | null}
 */
export function computeVaultReviewPriority(entry, vault, now = Date.now()) {
  if (!entry || typeof entry !== "object") return null;
  const mastery = getCurrentMastery(entry, now);
  const hasMisconception = getActiveMisconceptions(entry).length > 0;
  const decayGap = Math.max(
    PARTIAL_MASTERY_THRESHOLD - mastery,
    hasMisconception ? 0.05 : 0,
  );
  if (decayGap <= 0 && !hasMisconception) return null;

  const storedImportance = Number(entry.importanceScore);
  const importanceScore = Number.isFinite(storedImportance)
    ? storedImportance
    : computeImportanceScore(entry, vault);

  return decayGap * (1 + importanceScore / 10);
}

/**
 * @param {object} entry
 * @param {number} [now]
 * @returns {boolean}
 */
export function shouldIncludeInReviewPool(entry, now = Date.now()) {
  if (!entry?.id) return false;
  if (getCurrentMastery(entry, now) < PARTIAL_MASTERY_THRESHOLD) return true;
  return getActiveMisconceptions(entry).length > 0;
}

/**
 * @param {object} entry
 * @param {number} priority
 * @param {number} [now]
 */
function buildVaultSmItem(entry, priority, now = Date.now()) {
  const vaultEntryId = String(entry.id);
  return {
    id: `${VAULT_SM_ID_PREFIX}${vaultEntryId}`,
    vaultEntryId,
    conceptTitle: String(entry.canonicalTitle || "").trim(),
    priority,
    source: "vault_decay",
    nextReview: now - Math.floor(priority * PRIORITY_SCHEDULE_MS),
    easeFactor: 2.5,
    interval: 0,
    reviewCount: 0,
  };
}

function isVaultDecaySmItem(item) {
  return (
    item?.source === "vault_decay" ||
    String(item?.id || "").startsWith(VAULT_SM_ID_PREFIX)
  );
}

/**
 * Push decaying vault concepts into session.shared.smItems (topic-scoped).
 * Preserves non-vault smItems (e.g. cloze-generated cards).
 * @param {object} session
 */
export function syncVaultToReviewPool(session) {
  const docId = String(session?.docId || "").trim();
  if (!docId) return;

  const current = getSession(docId) || session;
  if (!current?.shared) return;

  const docTopics = Array.isArray(current.shared.docTopics) ? current.shared.docTopics : [];
  const vault = loadVault();
  const now = Date.now();
  const eligible = new Map();

  for (const entry of getEntriesByTopic(docTopics)) {
    if (!shouldIncludeInReviewPool(entry, now)) continue;
    const priority = computeVaultReviewPriority(entry, vault, now);
    if (priority == null || priority <= 0) continue;
    eligible.set(String(entry.id), buildVaultSmItem(entry, priority, now));
  }

  const kept = (Array.isArray(current.shared.smItems) ? current.shared.smItems : []).filter(
    (item) => !isVaultDecaySmItem(item),
  );
  const vaultItems = [...eligible.values()].sort(
    (a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0),
  );

  saveActiveSession({
    ...current,
    shared: {
      ...current.shared,
      smItems: [...kept, ...vaultItems],
    },
  });
}

/**
 * Record a vault review answer, update mastery, and refresh the review pool.
 * @param {object} session
 * @param {string} vaultEntryId
 * @param {{ type?: string, correct?: boolean, timestamp?: number }} [observation]
 */
export function applyVaultReviewObservation(session, vaultEntryId, observation = {}) {
  const docId = String(session?.docId || "").trim();
  const entryId = String(vaultEntryId || "").trim();
  if (!docId || !entryId) return;

  const vault = loadVault();
  const type =
    String(observation.type || "").trim() ||
    (observation.correct === false ? "mcq_wrong" : "mcq_correct");
  const timestamp = Number(observation.timestamp) || Date.now();

  applyObservations(
    vault,
    [{ conceptId: entryId, type, timestamp, docId }],
    { [entryId]: entryId },
  );
  vault.lastUpdated = Date.now();
  saveVault(vault);

  const fresh = getSession(docId) || session;
  syncVaultToReviewPool(fresh);
}
