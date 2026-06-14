/** Global Knowledge Vault — localStorage persistence. */

import { hydrateMastery } from "./mastery-model.js";
import { addPrerequisiteSafe, recomputeImportanceScores } from "./prerequisite-graph.js";

export const VAULT_STORAGE_KEY = "pith_knowledge_vault";
export const VAULT_DATA_KEY = "pith_knowledge_vault_data";
const SIZE_THRESHOLD = 300 * 1024;

function newVaultId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `vault_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const SCHEMA_VERSION = 2;

function emptyVault() {
  return {
    schemaVersion: SCHEMA_VERSION,
    entries: [],
    reviewItems: [],
    lastUpdated: Date.now(),
    importHistory: [],
    lastInferenceAt: {},
    pendingInferredEdges: [],
  };
}

/**
 * @param {object} entry
 */
function migrateEntryCuration(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const migrated = migrateEntryV2(entry);
  if (!Array.isArray(migrated.definitions)) migrated.definitions = [];
  if (!migrated.facetCoverage || typeof migrated.facetCoverage !== "object") {
    migrated.facetCoverage = {};
  }
  return migrated;
}

/**
 * @param {object} entry
 */
function migrateEntryV2(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const now = Number(entry.masteryLastUpdated) || Date.now();
  const base = Number(entry.masteryBase) || 0;
  return {
    ...entry,
    misconceptions: Array.isArray(entry.misconceptions) ? [...entry.misconceptions] : [],
    coPrerequisites: Array.isArray(entry.coPrerequisites) ? [...entry.coPrerequisites] : [],
    manualOrigin: Boolean(entry.manualOrigin),
    masteryDeclarativeBase: Number.isFinite(entry.masteryDeclarativeBase)
      ? entry.masteryDeclarativeBase
      : base,
    masteryProceduralBase: Number.isFinite(entry.masteryProceduralBase)
      ? entry.masteryProceduralBase
      : base,
    masteryDeclarativeLastUpdated: Number(entry.masteryDeclarativeLastUpdated) || now,
    masteryProceduralLastUpdated: Number(entry.masteryProceduralLastUpdated) || now,
    useBkt: Boolean(entry.useBkt),
  };
}

/**
 * @param {object[]} entries
 */
function rebuildDependents(entries) {
  for (const entry of entries) {
    entry.dependents = [];
  }
  for (const entry of entries) {
    const id = String(entry?.id || "");
    for (const prereqId of entry.prerequisites || []) {
      const prereq = entries.find((e) => String(e?.id || "") === String(prereqId));
      if (prereq) {
        if (!Array.isArray(prereq.dependents)) prereq.dependents = [];
        if (!prereq.dependents.includes(id)) prereq.dependents.push(id);
      }
    }
  }
}

/**
 * @param {object[]} entries
 * @param {string} oldId
 * @param {string} newId
 */
function replaceEntryIdReferences(entries, oldId, newId) {
  const oldS = String(oldId);
  const newS = String(newId);
  if (oldS === newS) return;
  for (const entry of entries) {
    if (Array.isArray(entry.prerequisites)) {
      entry.prerequisites = [...new Set(
        entry.prerequisites.map((id) => (String(id) === oldS ? newS : String(id))),
      )].filter((id) => id !== String(entry.id));
    }
    if (Array.isArray(entry.dependents)) {
      entry.dependents = [...new Set(
        entry.dependents.map((id) => (String(id) === oldS ? newS : String(id))),
      )].filter((id) => id !== String(entry.id));
    }
    if (Array.isArray(entry.coPrerequisites)) {
      entry.coPrerequisites = [...new Set(
        entry.coPrerequisites.map((id) => (String(id) === oldS ? newS : String(id))),
      )].filter((id) => id !== String(entry.id));
    }
  }
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
    let entries = readEntriesFromStorage(meta).map((e) => migrateEntryCuration(e));
    const version = Number(meta.schemaVersion) || 1;
    if (version < SCHEMA_VERSION) {
      entries = entries.map((e) => migrateEntryCuration(e));
    }
    const reviewItems = Array.isArray(meta.reviewItems) ? [...meta.reviewItems] : [];
    rebuildDependents(entries);
    recomputeImportanceScores({ entries });
    return {
      schemaVersion: SCHEMA_VERSION,
      entries: entries.map((e) => hydrateMastery(e)),
      reviewItems,
      lastUpdated: Number(meta.lastUpdated) || Date.now(),
      importHistory: Array.isArray(meta.importHistory) ? [...meta.importHistory] : [],
      lastInferenceAt:
        meta.lastInferenceAt && typeof meta.lastInferenceAt === "object"
          ? { ...meta.lastInferenceAt }
          : {},
      pendingInferredEdges: Array.isArray(meta.pendingInferredEdges)
        ? [...meta.pendingInferredEdges]
        : [],
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
  const reviewItems = Array.isArray(vault?.reviewItems) ? vault.reviewItems : [];
  const now = Date.now();
  const stripped = entries.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const { mastery, ...rest } = entry;
    return rest;
  });
  const importHistory = Array.isArray(vault?.importHistory) ? vault.importHistory : [];
  const metaPayload = {
    schemaVersion: SCHEMA_VERSION,
    lastUpdated: now,
    reviewItems,
    importHistory,
    lastInferenceAt:
      vault?.lastInferenceAt && typeof vault.lastInferenceAt === "object"
        ? vault.lastInferenceAt
        : {},
    pendingInferredEdges: Array.isArray(vault?.pendingInferredEdges)
      ? vault.pendingInferredEdges
      : [],
  };
  const inline = JSON.stringify({ ...metaPayload, entries: stripped });

  if (inline.length > SIZE_THRESHOLD) {
    localStorage.setItem(VAULT_DATA_KEY, JSON.stringify(stripped));
    localStorage.setItem(
      VAULT_STORAGE_KEY,
      JSON.stringify({
        ...metaPayload,
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
      JSON.stringify({ ...metaPayload, entries: stripped }),
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

/**
 * @param {string} entryId
 * @param {string} canonicalTitle
 * @returns {object | null}
 */
export function updateEntryTitle(entryId, canonicalTitle) {
  const id = String(entryId || "").trim();
  const title = String(canonicalTitle || "").trim();
  if (!id || !title) return null;
  const vault = loadVault();
  const entry = vault.entries.find((e) => String(e?.id || "") === id);
  if (!entry) return null;
  entry.canonicalTitle = title;
  entry.lastSeen = Date.now();
  vault.lastUpdated = Date.now();
  saveVault(vault);
  return hydrateMastery(entry);
}

/**
 * @param {string} survivorId
 * @param {string} mergedId
 * @returns {object | null}
 */
export function mergeEntries(survivorId, mergedId) {
  const survivorS = String(survivorId || "").trim();
  const mergedS = String(mergedId || "").trim();
  if (!survivorS || !mergedS || survivorS === mergedS) return null;

  const vault = loadVault();
  const survivor = vault.entries.find((e) => String(e?.id || "") === survivorS);
  const merged = vault.entries.find((e) => String(e?.id || "") === mergedS);
  if (!survivor || !merged) return null;

  const aliasSet = new Set([
    ...(Array.isArray(survivor.aliases) ? survivor.aliases : []),
    merged.canonicalTitle,
    ...(Array.isArray(merged.aliases) ? merged.aliases : []),
  ]);
  aliasSet.delete(survivor.canonicalTitle);
  survivor.aliases = [...aliasSet].filter(Boolean);

  survivor.observations = [
    ...(Array.isArray(survivor.observations) ? survivor.observations : []),
    ...(Array.isArray(merged.observations) ? merged.observations : []),
  ];

  const sourceKey = (s) => `${s?.docId}|${s?.conceptId}`;
  const sourceMap = new Map();
  for (const s of [...(survivor.sources || []), ...(merged.sources || [])]) {
    if (s) sourceMap.set(sourceKey(s), s);
  }
  survivor.sources = [...sourceMap.values()];

  const prereqSet = new Set([
    ...(survivor.prerequisites || []),
    ...(merged.prerequisites || []),
  ]);
  prereqSet.delete(survivorS);
  prereqSet.delete(mergedS);
  survivor.prerequisites = [...prereqSet];

  replaceEntryIdReferences(vault.entries, mergedS, survivorS);
  vault.entries = vault.entries.filter((e) => String(e?.id || "") !== mergedS);
  rebuildDependents(vault.entries);
  recomputeImportanceScores(vault);

  survivor.lastSeen = Math.max(Number(survivor.lastSeen) || 0, Number(merged.lastSeen) || 0);
  survivor.masteryBase = Math.max(Number(survivor.masteryBase) || 0, Number(merged.masteryBase) || 0);
  vault.lastUpdated = Date.now();
  saveVault(vault);
  return hydrateMastery(survivor);
}

/**
 * @param {string} entryId
 */
export function deleteEntry(entryId) {
  const id = String(entryId || "").trim();
  if (!id) return;
  const vault = loadVault();
  if (!vault.entries.some((e) => String(e?.id || "") === id)) return;

  for (const entry of vault.entries) {
    if (Array.isArray(entry.prerequisites)) {
      entry.prerequisites = entry.prerequisites.filter((pid) => String(pid) !== id);
    }
    if (Array.isArray(entry.dependents)) {
      entry.dependents = entry.dependents.filter((did) => String(did) !== id);
    }
    if (Array.isArray(entry.coPrerequisites)) {
      entry.coPrerequisites = entry.coPrerequisites.filter((cid) => String(cid) !== id);
    }
  }
  vault.entries = vault.entries.filter((e) => String(e?.id || "") !== id);
  rebuildDependents(vault.entries);
  recomputeImportanceScores(vault);
  vault.lastUpdated = Date.now();
  saveVault(vault);
}

/**
 * @param {{ canonicalTitle: string, topic: string, masteryBase?: number, prerequisites?: string[] }} params
 * @returns {object | null}
 */
export function addManualEntry(params) {
  const title = String(params?.canonicalTitle || "").trim();
  const topic = String(params?.topic || "").trim();
  if (!title || !topic) return null;

  const now = Date.now();
  const masteryBase = Number(params?.masteryBase);
  const entry = migrateEntryV2({
    id: newVaultId(),
    canonicalTitle: title,
    aliases: [],
    topic,
    masteryBase: Number.isFinite(masteryBase) ? masteryBase : 0.5,
    masteryLastUpdated: now,
    lastSeen: now,
    sources: [],
    prerequisites: [],
    dependents: [],
    observations: [],
    manualOrigin: true,
  });

  const vault = loadVault();
  vault.entries.push(entry);
  const prereqs = (Array.isArray(params?.prerequisites) ? params.prerequisites : [])
    .map((p) => String(p || "").trim())
    .filter((p) => p && p !== entry.id);
  if (prereqs.length) {
    entry.prerequisites = prereqs;
    rebuildDependents(vault.entries);
    recomputeImportanceScores(vault);
  }
  vault.lastUpdated = now;
  saveVault(vault);
  return hydrateMastery(entry);
}

/**
 * @param {string} entryId
 * @param {string[]} prerequisiteIds
 * @returns {object | null}
 */
export function setPrerequisites(entryId, prerequisiteIds) {
  const id = String(entryId || "").trim();
  if (!id) return null;
  const vault = loadVault();
  const entry = vault.entries.find((e) => String(e?.id || "") === id);
  if (!entry) return null;

  const prereqs = [...new Set(
    (Array.isArray(prerequisiteIds) ? prerequisiteIds : [])
      .map((p) => String(p || "").trim())
      .filter((p) => p && p !== id),
  )];
  const newSet = new Set(prereqs);
  const previousPrereqs = [...(entry.prerequisites || [])].map(String);

  entry.prerequisites = (entry.prerequisites || []).filter((pid) => newSet.has(String(pid)));

  for (const prereqId of prereqs) {
    if (!previousPrereqs.includes(String(prereqId))) {
      addPrerequisiteSafe(vault, id, prereqId);
    }
  }

  rebuildDependents(vault.entries);
  recomputeImportanceScores(vault);
  entry.lastSeen = Date.now();
  vault.lastUpdated = Date.now();
  saveVault(vault);
  return hydrateMastery(entry);
}

/**
 * @param {object} record
 */
export function appendImportRecord(record) {
  if (!record || typeof record !== "object") return;
  const vault = loadVault();
  if (!Array.isArray(vault.importHistory)) vault.importHistory = [];
  vault.importHistory.unshift(record);
  vault.importHistory = vault.importHistory.slice(0, 20);
  vault.lastUpdated = Date.now();
  saveVault(vault);
}

/**
 * @returns {object[]}
 */
export function getVaultReviewItems() {
  const vault = loadVault();
  return Array.isArray(vault.reviewItems) ? [...vault.reviewItems] : [];
}

/**
 * @param {object} item
 */
export function upsertVaultReviewItem(item) {
  if (!item || typeof item !== "object") return null;
  const vault = loadVault();
  if (!Array.isArray(vault.reviewItems)) vault.reviewItems = [];
  const id = String(item.id || "").trim() || newVaultId();
  const normalized = {
    id,
    vaultEntryId: String(item.vaultEntryId || "").trim(),
    facet: String(item.facet || "synthesis").trim(),
    prompt: String(item.prompt || "").trim(),
    answer: String(item.answer || "").trim(),
    sourceDocId: String(item.sourceDocId || "").trim(),
    sm2: {
      interval: Number(item.sm2?.interval) || 0,
      easeFactor: Number(item.sm2?.easeFactor) || 2.5,
      dueDate: Number(item.sm2?.dueDate) || Date.now(),
      repetitions: Number(item.sm2?.repetitions) || 0,
    },
    createdAt: Number(item.createdAt) || Date.now(),
  };
  const idx = vault.reviewItems.findIndex((r) => String(r?.id || "") === id);
  if (idx >= 0) vault.reviewItems[idx] = { ...vault.reviewItems[idx], ...normalized };
  else vault.reviewItems.push(normalized);
  vault.lastUpdated = Date.now();
  saveVault(vault);
  return normalized;
}

/**
 * @param {string} itemId
 * @param {object} sm2
 */
export function updateVaultReviewItemSm2(itemId, sm2) {
  const id = String(itemId || "").trim();
  if (!id || !sm2) return null;
  const vault = loadVault();
  const item = (vault.reviewItems || []).find((r) => String(r?.id || "") === id);
  if (!item) return null;
  item.sm2 = {
    interval: Number(sm2.interval) ?? item.sm2?.interval ?? 0,
    easeFactor: Number(sm2.easeFactor) ?? item.sm2?.easeFactor ?? 2.5,
    dueDate: Number(sm2.dueDate) ?? item.sm2?.dueDate ?? Date.now(),
    repetitions: Number(sm2.repetitions) ?? item.sm2?.repetitions ?? 0,
  };
  vault.lastUpdated = Date.now();
  saveVault(vault);
  return item;
}

export { newVaultId, migrateEntryV2, rebuildDependents, SCHEMA_VERSION };
