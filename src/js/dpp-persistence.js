/**
 * DPP persistence helpers — sole session-store entry points during pipeline runs.
 * @see specs/20260629-dpp-persistence-overhaul/spec.md
 */

import { getSession, saveActiveSession } from "./session-store.js";

/** @type {Map<string, string>} docId → active runId on this device */
const activeDppRunByDocId = new Map();

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
 * @param {object} doc
 */
export async function persistCheckpoint(doc) {
  if (!doc?.docId) throw new Error("persistCheckpoint requires docId");
  await saveActiveSession(doc);
}

/**
 * @param {object} doc
 */
export async function persistFinal(doc) {
  if (!doc?.docId) throw new Error("persistFinal requires docId");
  const runId = doc?.shared?.preparation?.runId;
  const current = await getSession(doc.docId);
  const storeRunId = current?.shared?.preparation?.runId;
  if (storeRunId && runId && storeRunId !== runId) {
    console.warn("[DPP] stale run, skipping final write", runId);
    clearDppRun(doc.docId);
    return;
  }
  await saveActiveSession(doc);
  clearDppRun(doc.docId);
}
