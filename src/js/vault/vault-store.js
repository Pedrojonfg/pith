/** Global Knowledge Vault — localStorage persistence. */

import { hydrateMastery } from "./mastery-model.js";

export const VAULT_STORAGE_KEY = "mylearning_knowledge_vault";
export const VAULT_DATA_KEY = "mylearning_knowledge_vault_data";
const SIZE_THRESHOLD = 300 * 1024;

function newVaultId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `vault_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyVault() {
  return { schemaVersion: 1, entries: [], lastUpdated: Date.now() };
}

function readEntriesFromStorage(meta) {
  if (!meta || typeof meta !== "object") return [];
  if (Array.isArray(meta.entries)) return meta.entries;
  const ref = meta.entriesRef;
  if (ref?.storageKey) {
    try {
      const raw = localStorage.getItem(ref.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * @returns {{ schemaVersion: number, entries: object[], lastUpdated: number }}
 */
export function loadVault() {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return emptyVault();
    const meta = JSON.parse(raw);
    if (!meta || typeof meta !== "object") return emptyVault();
    const entries = readEntriesFromStorage(meta).map((e) => hydrateMastery(e));
    return {
      schemaVersion: meta.schemaVersion === 1 ? 1 : 1,
      entries,
      lastUpdated: Number(meta.lastUpdated) || Date.now(),
    };
  } catch (err) {
    console.warn("[vault-store] loadVault: corrupt data", err);
    return emptyVault();
  }
}

/**
 * @param {{ schemaVersion?: number, entries?: object[], lastUpdated?: number }} vault
 */
export function saveVault(vault) {
  const entries = Array.isArray(vault?.entries) ? vault.entries : [];
  const now = Date.now();
  const stripped = entries.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const { mastery, ...rest } = entry;
    return rest;
  });
  const inline = JSON.stringify({ schemaVersion: 1, entries: stripped, lastUpdated: now });

  if (inline.length > SIZE_THRESHOLD) {
    localStorage.setItem(VAULT_DATA_KEY, JSON.stringify(stripped));
    localStorage.setItem(
      VAULT_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        lastUpdated: now,
        entriesRef: {
          storageKey: VAULT_DATA_KEY,
          entryCount: stripped.length,
        },
      }),
    );
  } else {
    try {
      localStorage.removeItem(VAULT_DATA_KEY);
    } catch {
      // ignore
    }
    localStorage.setItem(
      VAULT_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, entries: stripped, lastUpdated: now }),
    );
  }
}

/**
 * @param {string} id
 * @returns {object | null}
 */
export function getEntryById(id) {
  const needle = String(id || "").trim();
  if (!needle) return null;
  const vault = loadVault();
  const found = vault.entries.find((e) => String(e?.id || "") === needle);
  return found ? hydrateMastery(found) : null;
}

/**
 * @param {object} entry
 */
export function upsertEntry(entry) {
  if (!entry || typeof entry !== "object") return;
  const vault = loadVault();
  const id = String(entry.id || "").trim() || newVaultId();
  const normalized = {
    id,
    canonicalTitle: String(entry.canonicalTitle || "").trim() || "Untitled",
    aliases: Array.isArray(entry.aliases) ? [...entry.aliases] : [],
    topic: String(entry.topic || "general").trim() || "general",
    masteryBase: Number(entry.masteryBase) || 0,
    masteryLastUpdated: Number(entry.masteryLastUpdated) || Date.now(),
    lastSeen: Number(entry.lastSeen) || Date.now(),
    sources: Array.isArray(entry.sources) ? [...entry.sources] : [],
    prerequisites: Array.isArray(entry.prerequisites) ? [...entry.prerequisites] : [],
    dependents: Array.isArray(entry.dependents) ? [...entry.dependents] : [],
    observations: Array.isArray(entry.observations) ? [...entry.observations] : [],
  };
  const idx = vault.entries.findIndex((e) => String(e?.id || "") === id);
  if (idx >= 0) vault.entries[idx] = { ...vault.entries[idx], ...normalized };
  else vault.entries.push(normalized);
  vault.lastUpdated = Date.now();
  saveVault(vault);
}

/**
 * @param {string} entryId
 * @param {{ docId: string, conceptId: string, addedAt?: number }} source
 */
export function addSource(entryId, source) {
  const id = String(entryId || "").trim();
  if (!id || !source) return;
  const vault = loadVault();
  const entry = vault.entries.find((e) => String(e?.id || "") === id);
  if (!entry) return;
  const docId = String(source.docId || "").trim();
  const conceptId = String(source.conceptId || "").trim();
  if (!docId || !conceptId) return;
  if (!Array.isArray(entry.sources)) entry.sources = [];
  const exists = entry.sources.some(
    (s) => String(s?.docId || "") === docId && String(s?.conceptId || "") === conceptId,
  );
  if (!exists) {
    entry.sources.push({
      docId,
      conceptId,
      addedAt: Number(source.addedAt) || Date.now(),
    });
  }
  entry.lastSeen = Date.now();
  vault.lastUpdated = Date.now();
  saveVault(vault);
}

export function clearVault() {
  try {
    localStorage.removeItem(VAULT_STORAGE_KEY);
    localStorage.removeItem(VAULT_DATA_KEY);
  } catch {
    // ignore
  }
}

export function exportVaultJson() {
  const vault = loadVault();
  return JSON.stringify(vault, null, 2);
}

/**
 * Flexible substring topic match (bidirectional).
 * @param {string[]} docTopics
 * @returns {object[]}
 */
export function getEntriesByTopic(docTopics) {
  const topics = (Array.isArray(docTopics) ? docTopics : [])
    .map((t) => String(t || "").trim().toLowerCase())
    .filter(Boolean);
  const vault = loadVault();
  if (!topics.length) return vault.entries.map((e) => hydrateMastery(e));
  return vault.entries
    .filter((entry) => {
      const topic = String(entry?.topic || "").trim().toLowerCase();
      if (!topic) return false;
      return topics.some(
        (dt) => topic.includes(dt) || dt.includes(topic),
      );
    })
    .map((e) => hydrateMastery(e));
}

export { newVaultId };
