/**
 * DPP persistence helpers — sole session-store entry points during pipeline runs.
 * @see specs/20260629-dpp-persistence-overhaul/spec.md
 */

import { getSession, saveActiveSession } from "./session-store.js";
import { hasTier1Artifacts } from "./session-types.js";

/** @type {Map<string, string>} docId → active runId on this device */
const activeDppRunByDocId = new Map();

const TERMINAL_PREP_STATUSES = new Set(["ready", "partial", "failed", "legacy"]);
const IN_PROGRESS_PREP_STATUSES = new Set(["pending", "running"]);

/**
 * @param {object} session
 * @returns {object}
 */
export function deepCloneSession(session) {
  if (session == null) return session;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(session);
    } catch {
      // fall through for non-cloneable values
    }
  }
  return JSON.parse(JSON.stringify(session));
}

/**
 * @returns {string}
 */
export function generateRunId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dpp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {string} docId
 * @param {string} runId
 */
export function registerDppRun(docId, runId) {
  const id = String(docId || "").trim();
  const run = String(runId || "").trim();
  if (!id || !run) return;
  activeDppRunByDocId.set(id, run);
}

/**
 * @param {string} docId
 */
export function clearDppRun(docId) {
  const id = String(docId || "").trim();
  if (!id) return;
  activeDppRunByDocId.delete(id);
}

/**
 * @param {string} docId
 * @param {string} [runId]
 * @returns {boolean}
 */
export function isDppRunActiveOnDevice(docId, runId) {
  const id = String(docId || "").trim();
  if (!id) return false;
  const active = activeDppRunByDocId.get(id);
  if (!active) return false;
  if (runId) return active === String(runId);
  return true;
}

/**
 * @param {string} docId
 * @returns {string|null}
 */
export function getActiveDppRunId(docId) {
  return activeDppRunByDocId.get(String(docId || "").trim()) || null;
}

/**
 * True when the in-memory prepared doc is strictly ahead of what is in store.
 * @param {object} prepared
 * @param {object} store
 * @returns {boolean}
 */
export function isPreparedDocAheadOfStore(prepared, store) {
  if (!prepared?.shared) return false;
  if (!store?.shared) return true;

  const prepInv = Array.isArray(prepared.shared.conceptInventory)
    ? prepared.shared.conceptInventory.length
    : 0;
  const storeInv = Array.isArray(store.shared.conceptInventory)
    ? store.shared.conceptInventory.length
    : 0;
  if (prepInv > storeInv) return true;

  if (hasTier1Artifacts(prepared) && !hasTier1Artifacts(store)) return true;

  const prepStatus = String(prepared.shared.preparation?.status || "pending");
  const storeStatus = String(store.shared.preparation?.status || "pending");

  if (
    TERMINAL_PREP_STATUSES.has(prepStatus) &&
    IN_PROGRESS_PREP_STATUSES.has(storeStatus) &&
    prepInv >= storeInv
  ) {
    return true;
  }

  const prepRunId = prepared.shared.preparation?.runId;
  const storeRunId = store.shared.preparation?.runId;
  if (prepRunId && prepRunId === storeRunId && prepStatus !== storeStatus) return true;

  if (TERMINAL_PREP_STATUSES.has(prepStatus) && IN_PROGRESS_PREP_STATUSES.has(storeStatus)) {
    return true;
  }

  return false;
}

/**
 * @param {object} preparedDoc
 * @param {object|null|undefined} storeDoc
 * @returns {boolean}
 */
export function shouldCommitPreparedDoc(preparedDoc, storeDoc) {
  if (!preparedDoc?.shared) return false;
  if (!storeDoc?.shared) return true;
  if (isPreparedDocAheadOfStore(preparedDoc, storeDoc)) return true;
  const prepStatus = String(preparedDoc.shared.preparation?.status || "pending");
  const storeStatus = String(storeDoc.shared.preparation?.status || "pending");
  return (
    TERMINAL_PREP_STATUSES.has(prepStatus) && IN_PROGRESS_PREP_STATUSES.has(storeStatus)
  );
}

/** Tier-1 shared fields written by DPP onto the in-memory clone. */
const PREPARED_SHARED_SYNC_KEYS = [
  "preparation",
  "conceptInventory",
  "blockRecommendation",
  "modeRecommendation",
  "docHierarchy",
  "textMetrics",
  "conceptGraph",
  "docTopics",
  "relatedDocuments",
];

/**
 * Copy pipeline outputs from the working clone onto the caller's session object.
 * @param {object} callerDoc
 * @param {object} preparedDoc
 * @returns {object}
 */
export function hydrateCallerDocFromPrepared(callerDoc, preparedDoc) {
  if (!callerDoc?.shared || !preparedDoc?.shared) return callerDoc;
  if (callerDoc.docId !== preparedDoc.docId) return callerDoc;
  for (const key of PREPARED_SHARED_SYNC_KEYS) {
    if (key in preparedDoc.shared) {
      callerDoc.shared[key] = preparedDoc.shared[key];
    }
  }
  return callerDoc;
}

/**
 * Ensure store reflects the pipeline's in-memory conclusion when store is behind.
 * @param {object} preparedDoc
 * @returns {Promise<object|null>}
 */
export async function commitPreparedDocToStore(preparedDoc) {
  if (!preparedDoc?.docId) return null;
  const current = await getSession(preparedDoc.docId);
  if (shouldCommitPreparedDoc(preparedDoc, current)) {
    await saveActiveSession(preparedDoc);
    return (await getSession(preparedDoc.docId)) ?? preparedDoc;
  }
  return current ?? preparedDoc;
}

/**
 * @param {object} doc
 */
export async function persistCheckpoint(doc) {
  if (!doc?.docId) {
    // [debug-enrich]
    console.error('[dpp-persistence.persistCheckpoint] Missing docId — cannot persist');
    throw new Error("persistCheckpoint requires docId");
  }
  // [debug-enrich]
  console.info('[dpp-persistence.persistCheckpoint] Writing checkpoint:', {
    docId: doc.docId,
    prepStatus: doc?.shared?.preparation?.status ?? null,
    runId: doc?.shared?.preparation?.runId ?? null,
    currentPhase: doc?.shared?.preparation?.currentPhase ?? null,
    phaseResultKeys: doc?.shared?.preparation?.phaseResults
      ? Object.keys(doc.shared.preparation.phaseResults)
      : [],
    hasInventory: Array.isArray(doc?.shared?.conceptInventory),
    inventoryCount: Array.isArray(doc?.shared?.conceptInventory)
      ? doc.shared.conceptInventory.length
      : 0,
    hasHierarchy: Boolean(doc?.shared?.docHierarchy),
  });
  try {
    await saveActiveSession(doc);
    // [debug-enrich]
    console.info('[dpp-persistence.persistCheckpoint] Checkpoint saved:', { docId: doc.docId });
  } catch (err) {
    // [debug-enrich]
    console.error('[dpp-persistence.persistCheckpoint] Checkpoint save failed:', {
      docId: doc.docId,
      message: err?.message ?? String(err),
      name: err?.name ?? null,
    });
    throw err;
  }
}

/**
 * @param {object} doc
 * @returns {Promise<boolean>} whether the final write was applied
 */
export async function persistFinal(doc) {
  if (!doc?.docId) throw new Error("persistFinal requires docId");
  const runId = doc?.shared?.preparation?.runId;
  const docId = doc.docId;
  const activeOnDevice = getActiveDppRunId(docId);

  if (activeOnDevice && runId && activeOnDevice !== runId) {
    console.warn("[DPP] stale run, skipping final write", runId);
    clearDppRun(docId);
    return false;
  }

  const current = await getSession(docId);
  const storeRunId = current?.shared?.preparation?.runId;
  const prepStatus = String(doc?.shared?.preparation?.status || "pending");
  const forceTerminalWrite = TERMINAL_PREP_STATUSES.has(prepStatus);
  if (
    storeRunId &&
    runId &&
    storeRunId !== runId &&
    !isPreparedDocAheadOfStore(doc, current) &&
    !forceTerminalWrite
  ) {
    console.warn("[DPP] stale run, skipping final write (store runId mismatch)", {
      runId,
      storeRunId,
    });
    clearDppRun(docId);
    return false;
  }
  if (storeRunId && runId && storeRunId !== runId && isPreparedDocAheadOfStore(doc, current)) {
    console.warn("[DPP] store runId mismatch but prepared doc is ahead — forcing final write", {
      runId,
      storeRunId,
    });
  }

  await saveActiveSession(doc);
  clearDppRun(docId);
  try {
    const { upsertSharedDppCache } = await import("./shared-dpp-cache-persist.js");
    await upsertSharedDppCache(docId, doc);
  } catch (err) {
    console.warn("[DPP] shared cache upsert skipped:", err?.message || err);
  }
  return true;
}
