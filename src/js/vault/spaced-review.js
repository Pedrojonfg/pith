/** Vault decay → shared.smItems bridge for spaced review scheduling. */

import { getSession, saveActiveSession } from "../session-store.js";
import { deInfo, deWarn } from "../debug-enrich.js";
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
 * @param {string} docId
 * @param {number} [now]
 */
function buildVaultSmItem(entry, priority, docId, now = Date.now()) {
  const originDocId = String(docId || "").trim();
  if (!originDocId) {
    throw new Error("buildVaultSmItem requires docId");
  }
  const vaultEntryId = String(entry.id);
  const definition = String(entry.definition || entry.canonicalDefinition || "").trim();
  return {
    id: `${VAULT_SM_ID_PREFIX}${vaultEntryId}`,
    sourceType: "vault_concept",
    sourceId: vaultEntryId,
    docId: originDocId,
    title: String(entry.canonicalTitle || "").trim() || "Vault concept",
    contentPreview: definition.slice(0, 80),
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    scheduledDue: now - Math.floor(priority * PRIORITY_SCHEDULE_MS),
    lastReviewed: null,
    observations: [],
    createdAt: now,
    priority,
  };
}

function isVaultDecaySmItem(item) {
  return (
    item?.sourceType === "vault_concept" ||
    item?.source === "vault_decay" ||
    String(item?.id || "").startsWith(VAULT_SM_ID_PREFIX)
  );
}

/**
 * Push decaying vault concepts into session.shared.smItems (topic-scoped).
 * Preserves non-vault smItems (e.g. cloze-generated cards).
 * @param {object} session
 */
export async function syncVaultToReviewPool(session) {
  const docId = String(session?.docId || "").trim();
  if (!docId) {
    deWarn('[vault.spaced-review.syncVaultToReviewPool] Missing docId — skip');
    return;
  }

  deInfo('[vault.spaced-review.syncVaultToReviewPool] Syncing vault → review pool:', {
    docId,
  });

  const current = await getSession(docId) || session;
  if (!current?.shared) {
    deWarn('[vault.spaced-review.syncVaultToReviewPool] No shared slice — skip', {
      docId,
    });
    return;
  }

  const docTopics = Array.isArray(current.shared.docTopics) ? current.shared.docTopics : [];
  const vault = loadVault();
  const now = Date.now();
  const eligible = new Map();

  for (const entry of getEntriesByTopic(docTopics)) {
    if (!shouldIncludeInReviewPool(entry, now)) continue;
    const priority = computeVaultReviewPriority(entry, vault, now);
    if (priority == null || priority <= 0) continue;
    eligible.set(String(entry.id), buildVaultSmItem(entry, priority, docId, now));
  }

  const kept = (Array.isArray(current.shared.smItems) ? current.shared.smItems : []).filter(
    (item) => !isVaultDecaySmItem(item),
  );
  const vaultItems = [...eligible.values()].sort(
    (a, b) => (Number(a.scheduledDue) || 0) - (Number(b.scheduledDue) || 0),
  );

  deInfo('[vault.spaced-review.syncVaultToReviewPool] Pool rebuilt:', {
    docId,
    topicCount: docTopics.length,
    eligibleVaultItems: vaultItems.length,
    keptNonVaultItems: kept.length,
    totalSmItems: kept.length + vaultItems.length,
  });

  await saveActiveSession({
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
export async function applyVaultReviewObservation(session, vaultEntryId, observation = {}) {
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

  const fresh = await getSession(docId) || session;
  syncVaultToReviewPool(fresh);
}
