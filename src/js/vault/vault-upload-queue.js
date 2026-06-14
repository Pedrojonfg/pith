/**
 * Resumable Upload to Vault processing queue.
 * @see specs/20260625-vault-notes-connections/contracts/vault-upload-queue.md
 */

import { normalizeConceptsToVault } from "../api.js";
import {
  applyRelatedBacklinks,
  loadVault,
  saveVault,
  VAULT_STORAGE_KEY,
} from "./vault-store.js";
import {
  buildBatchContext,
  commitVaultCurationItem,
  resolveBatchConceptById,
} from "./vault-curation.js";

export const UPLOAD_QUEUE_KEY = "pith_vault_upload_queue";

/**
 * @returns {object|null}
 */
export function loadUploadQueue() {
  try {
    const raw = localStorage.getItem(UPLOAD_QUEUE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {object|null} queue
 */
export function saveUploadQueue(queue) {
  if (!queue) {
    localStorage.removeItem(UPLOAD_QUEUE_KEY);
    return;
  }
  localStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(queue));
}

export function clearUploadQueue() {
  localStorage.removeItem(UPLOAD_QUEUE_KEY);
}

/**
 * @param {object} queue
 */
export function resetStaleProcessingItems(queue) {
  if (!queue?.items) return queue;
  for (const item of queue.items) {
    if (item?.status === "processing") item.status = "pending";
  }
  return queue;
}

/**
 * @param {object|null} queue
 */
export function getPendingQueueCount(queue = loadUploadQueue()) {
  if (!queue?.items?.length) return 0;
  return queue.items.filter(
    (item) =>
      item?.status === "pending" ||
      item?.status === "error" ||
      item?.status === "processing",
  ).length;
}

/**
 * @param {string} docId
 * @param {Array<{ conceptId: string, payload: object }>} rows
 */
export function createUploadQueue(docId, rows) {
  const now = Date.now();
  const queue = {
    docId: String(docId || "").trim(),
    createdAt: now,
    items: (Array.isArray(rows) ? rows : []).map((row) => ({
      conceptId: String(row?.conceptId || "").trim(),
      status: "pending",
      payload: row?.payload || {},
    })).filter((item) => item.conceptId),
  };
  saveUploadQueue(queue);
  return queue;
}

/**
 * @param {string} conceptId
 */
export function retryQueueItem(conceptId) {
  const queue = loadUploadQueue();
  if (!queue) return null;
  const id = String(conceptId || "").trim();
  for (const item of queue.items) {
    if (String(item?.conceptId || "") === id && item.status === "error") {
      item.status = "pending";
      item.error = undefined;
    }
  }
  saveUploadQueue(queue);
  return queue;
}

export function retryAllQueueErrors() {
  const queue = loadUploadQueue();
  if (!queue) return null;
  for (const item of queue.items) {
    if (item?.status === "error") {
      item.status = "pending";
      item.error = undefined;
    }
  }
  saveUploadQueue(queue);
  return queue;
}

let processingPromise = null;

/**
 * @param {object} session
 * @param {(info: { done: number, total: number, conceptId?: string, error?: string }) => void} [onProgress]
 */
export async function processUploadQueue(session, onProgress) {
  if (processingPromise) return processingPromise;
  processingPromise = (async () => {
    let queue = loadUploadQueue();
    if (!queue?.items?.length) return { processed: 0, errors: 0 };
    queue = resetStaleProcessingItems(queue);
    saveUploadQueue(queue);

    const docId = String(session?.docId || queue.docId || "").trim();
    if (!docId) return { processed: 0, errors: 0 };

    const batchContext = buildBatchContext(session);
    const total = queue.items.length;
    let doneCount = queue.items.filter((i) => i.status === "done").length;
    let processed = 0;
    let errors = 0;

    for (const item of queue.items) {
      if (item.status === "done") continue;
      const conceptId = String(item?.conceptId || "").trim();
      if (!conceptId) continue;

      item.status = "processing";
      item.error = undefined;
      saveUploadQueue(queue);

      try {
        const concept = resolveBatchConceptById(session, conceptId);
        const title = String(concept?.label || concept?.title || conceptId).trim();
        const vault = loadVault();
        const existingEntries = buildDedupExistingEntries(vault, batchContext, title);

        const mappings = await normalizeConceptsToVault({
          existingEntries,
          newConcepts: [{ id: conceptId, title, type: "CONCEPT" }],
          topic: batchContext.existingVaultAreas[0] || "general",
          batchContext,
        });
        const mapping = mappings.find((m) => m.conceptId === conceptId) || {
          conceptId,
          action: "new",
          vaultEntryId: null,
        };

        const result = commitVaultCurationItem({
          session,
          mapping,
          payload: item.payload,
          batchContext,
        });

        let vaultAfter = loadVault();
        applyRelatedBacklinks(vaultAfter, result.vaultEntryId, result.relatedAccepted || []);
        vaultAfter.lastUpdated = Date.now();
        saveVault(vaultAfter);

        item.status = "done";
        processed += 1;
        doneCount += 1;
        onProgress?.({ done: doneCount, total, conceptId });
      } catch (err) {
        item.status = "error";
        item.error = String(err?.message || err) || "Processing failed";
        errors += 1;
        onProgress?.({ done: doneCount, total, conceptId, error: item.error });
      }
      saveUploadQueue(queue);
    }

    if (queue.items.every((i) => i.status === "done")) {
      clearUploadQueue();
    }
    return { processed, errors };
  })();
  try {
    return await processingPromise;
  } finally {
    processingPromise = null;
  }
}

/**
 * @param {object} vault
 * @param {object} batchContext
 * @param {string} title
 */
function buildDedupExistingEntries(vault, batchContext, title) {
  const areas = new Set(batchContext?.existingVaultAreas || []);
  const titleLower = String(title || "").trim().toLowerCase();
  const scored = [];
  for (const entry of vault?.entries || []) {
    const entryAreas = [
      ...(Array.isArray(entry.area) ? entry.area : []),
      String(entry.topic || "").trim(),
    ].filter(Boolean);
    const areaOverlap = entryAreas.some((a) => areas.has(a));
    const canonical = String(entry.canonicalTitle || "").trim().toLowerCase();
    let score = 0;
    if (areaOverlap) score += 2;
    if (canonical.includes(titleLower) || titleLower.includes(canonical)) score += 3;
    if (score > 0 || areas.size === 0) {
      scored.push({
        entry,
        score,
      });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const cap = scored.slice(0, 40);
  return cap.map(({ entry }) => ({
    id: entry.id,
    canonicalTitle: entry.canonicalTitle,
    aliases: entry.aliases || [],
    area: Array.isArray(entry.area) ? entry.area : [],
    topic: entry.topic || "",
  }));
}
