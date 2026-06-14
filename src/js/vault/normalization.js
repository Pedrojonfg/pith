/** Merge LLM normalization mappings into the vault. */

import { newVaultId } from "./vault-store.js";

function appendSource(entry, docId, conceptId, now) {
  if (!entry || !docId || !conceptId) return;
  if (!Array.isArray(entry.sources)) entry.sources = [];
  const exists = entry.sources.some(
    (s) => String(s?.docId || "") === docId && String(s?.conceptId || "") === conceptId,
  );
  if (!exists) {
    entry.sources.push({ docId, conceptId, addedAt: now });
  }
  entry.lastSeen = now;
}

/**
 * @param {object} vault
 * @param {Array<{ conceptId: string, action: string, vaultEntryId?: string | null }>} mappings
 * @param {Array<{ id?: string, title?: string, label?: string }>} newConcepts
 * @param {string[]} docTopics
 * @param {string} docId
 * @returns {Record<string, string>}
 */
export function mergeNormalizationResult(
  vault,
  mappings,
  newConcepts,
  docTopics,
  docId,
) {
  const map = /** @type {Record<string, string>} */ ({});
  const topic =
    (Array.isArray(docTopics) ? docTopics.find((t) => String(t || "").trim()) : null) ||
    "general";
  const now = Date.now();
  const conceptsById = new Map();
  for (const c of Array.isArray(newConcepts) ? newConcepts : []) {
    const id = String(c?.id || c?.canonicalId || "").trim();
    if (id) conceptsById.set(id, c);
  }

  for (const row of Array.isArray(mappings) ? mappings : []) {
    const conceptId = String(row?.conceptId || "").trim();
    if (!conceptId) continue;
    const concept = conceptsById.get(conceptId);
    const title = String(concept?.title || concept?.label || conceptId).trim();
    const action = String(row?.action || "new").trim().toLowerCase();
    const targetId = String(row?.vaultEntryId || "").trim();

    if (action === "merge" && targetId) {
      const entry = vault.entries.find((e) => String(e?.id || "") === targetId);
      if (entry) {
        appendSource(entry, docId, conceptId, now);
        map[conceptId] = targetId;
        continue;
      }
    }

    if (action === "alias" && targetId) {
      const entry = vault.entries.find((e) => String(e?.id || "") === targetId);
      if (entry) {
        if (!Array.isArray(entry.aliases)) entry.aliases = [];
        if (title && !entry.aliases.includes(title)) entry.aliases.push(title);
        appendSource(entry, docId, conceptId, now);
        map[conceptId] = targetId;
        continue;
      }
    }

    const entryId = newVaultId();
    vault.entries.push({
      id: entryId,
      canonicalTitle: title || conceptId,
      aliases: [],
      topic: String(topic),
      type: "CONCEPT",
      area: topic ? [String(topic)] : [],
      tags: [],
      notes: "",
      notesUpdatedAt: null,
      related: [],
      status: "pending",
      masteryBase: 0,
      masteryLastUpdated: now,
      lastSeen: now,
      sources: [{ docId, conceptId, addedAt: now }],
      prerequisites: [],
      dependents: [],
      observations: [],
      definitions: [],
      facetCoverage: {},
    });
    map[conceptId] = entryId;
  }

  vault.lastUpdated = now;
  return map;
}

/**
 * Build all-new mappings without LLM.
 * @param {Array<{ id?: string, canonicalId?: string }>} newConcepts
 * @returns {Array<{ conceptId: string, action: 'new', vaultEntryId: null }>}
 */
export function buildAllNewMappings(newConcepts) {
  return (Array.isArray(newConcepts) ? newConcepts : [])
    .map((c) => {
      const conceptId = String(c?.id || c?.canonicalId || "").trim();
      if (!conceptId) return null;
      return { conceptId, action: /** @type {'new'} */ ("new"), vaultEntryId: null };
    })
    .filter(Boolean);
}
