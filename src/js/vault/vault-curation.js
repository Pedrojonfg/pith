/**
 * Vault curation — studied concepts, upload commit, review observations.
 * @see specs/20260624-knowledge-vault-curation/contracts/vault-curation-api.md
 */

import { normalizeConceptsToVault } from "../api.js";
import { CONCEPT_FACETS } from "../session-types.js";
import { updateSmItem } from "../sm2.js";
import { appendDecayCalibrationLog } from "./decay-calibration.js";
import { getCurrentMastery, LAMBDA } from "./mastery-model.js";
import { mergeNormalizationResult } from "./normalization.js";
import { applyObservations } from "./session-close.js";
import {
  applyRelatedBacklinks,
  getDistinctAreas,
  getEntriesByTopic,
  getEntryById,
  loadVault,
  newVaultId,
  saveVault,
  updateVaultReviewItemSm2,
} from "./vault-store.js";

const MS_PER_DAY = 86_400_000;

/**
 * @param {object} session
 * @returns {Set<string>}
 */
export function collectStudiedConceptIds(session) {
  const touchedIds = new Set();
  const docId = String(session?.docId || "").trim();

  const rsvpBlocks = session?.modes?.rsvp?.blockIndex;
  const questionBlocks = session?.modes?.questions?.blockIndex;
  const blockLists = [rsvpBlocks, questionBlocks].filter(Array.isArray);
  for (const blocks of blockLists) {
    for (const block of blocks) {
      for (const id of block?.concept_ids || []) {
        const s = String(id || "").trim();
        if (s) touchedIds.add(s);
      }
    }
  }

  for (const sig of session?.shared?.assessmentSignals || []) {
    const id = String(sig?.conceptId || sig?.canonicalId || "").trim();
    if (id) touchedIds.add(id);
  }

  for (const item of session?.modes?.cloze?.items || []) {
    if (item?.studyProgress) {
      const id = String(item?.concept_id || item?.conceptId || "").trim();
      if (id) touchedIds.add(id);
    }
  }

  for (const q of session?.modes?.recall?.questions || []) {
    if (q?.answered) {
      const id = String(q?.concept_id || q?.conceptId || "").trim();
      if (id) touchedIds.add(id);
    }
  }

  return touchedIds;
}

/**
 * @param {object} session
 * @returns {object[]}
 */
export function getStudiedConcepts(session) {
  const inventory = Array.isArray(session?.shared?.conceptInventory)
    ? session.shared.conceptInventory
    : [];
  const touched = collectStudiedConceptIds(session);
  return inventory.filter((c) => {
    const id = String(c?.id || c?.canonicalId || "").trim();
    return id && touched.has(id);
  });
}

/**
 * @param {object} entry
 * @param {string} docId
 */
export function hasDefinitionFromDoc(entry, docId) {
  const id = String(docId || "").trim();
  if (!entry || !id) return false;
  return (entry.definitions || []).some((d) => String(d?.sourceDocId || "") === id);
}

/**
 * @param {object} vault
 * @param {string} vaultEntryId
 */
export function getExistingFacetsForEntry(vault, vaultEntryId) {
  const entryId = String(vaultEntryId || "").trim();
  const facets = new Set();
  for (const item of vault.reviewItems || []) {
    if (String(item?.vaultEntryId || "") === entryId && item?.facet) {
      facets.add(String(item.facet));
    }
  }
  return [...facets];
}

/**
 * @param {number} quality
 */
export function mapQualityToReviewObservation(quality) {
  const q = Number(quality);
  if (q >= 4) return { type: "review_correct", rawSignal: 1.0 };
  if (q === 3) return { type: "review_partial", rawSignal: 0.3 };
  return { type: "review_wrong", rawSignal: -0.5 };
}

/**
 * @param {string} vaultEntryId
 * @param {string} reviewItemId
 * @param {number} quality
 * @param {{ facet?: string, docId?: string }} [meta]
 */
export function applyVaultReviewItemObservation(vaultEntryId, reviewItemId, quality, meta = {}) {
  const entryId = String(vaultEntryId || "").trim();
  const itemId = String(reviewItemId || "").trim();
  if (!entryId) return;

  const vault = loadVault();
  const entry = vault.entries.find((e) => String(e?.id || "") === entryId);
  if (!entry) return;

  const now = Date.now();
  const predicted = getCurrentMastery(entry, now);
  const daysSince = (now - (Number(entry.masteryLastUpdated) || now)) / MS_PER_DAY;
  const base = Number(entry.masteryBase) || 0;
  const predictedAtReview =
    daysSince > 0 ? base * Math.exp(-LAMBDA * daysSince) : base;

  const { type, rawSignal } = mapQualityToReviewObservation(quality);
  const facet = String(meta.facet || "").trim() || undefined;
  const docId = String(meta.docId || "").trim();

  applyObservations(
    vault,
    [
      {
        conceptId: entryId,
        type,
        rawSignal,
        timestamp: now,
        docId,
        facet,
      },
    ],
    { [entryId]: entryId },
  );

  const reviewItem = (vault.reviewItems || []).find((r) => String(r?.id || "") === itemId);
  if (reviewItem) {
    const sm2Base = {
      id: reviewItem.id,
      sourceType: "vault_review_item",
      sourceId: reviewItem.id,
      docId: reviewItem.sourceDocId,
      interval: reviewItem.sm2?.interval ?? 0,
      easeFactor: reviewItem.sm2?.easeFactor ?? 2.5,
      repetitions: reviewItem.sm2?.repetitions ?? 0,
      scheduledDue: reviewItem.sm2?.dueDate ?? now,
      lastReviewed: null,
      observations: [],
    };
    const updated = updateSmItem(sm2Base, quality, now);
    updateVaultReviewItemSm2(itemId, {
      interval: updated.interval,
      easeFactor: updated.easeFactor,
      repetitions: updated.repetitions,
      dueDate: updated.scheduledDue,
    });
  }

  appendDecayCalibrationLog({
    vaultEntryId: entryId,
    facet,
    daysSinceLastUpdate: Math.max(0, daysSince),
    predictedMastery: predictedAtReview,
    observedSignal: rawSignal,
    timestamp: now,
  });

  vault.lastUpdated = now;
  saveVault(vault);
}

/**
 * Build vault context for extractVaultCandidates per concept.
 * @param {object} session
 * @param {object[]} concepts
 */
export function buildVaultCandidateContext(session, concepts) {
  const vault = loadVault();
  const docTopics = Array.isArray(session?.shared?.docTopics) ? session.shared.docTopics : [];
  const topicEntries = getEntriesByTopic(docTopics);
  const docId = String(session?.docId || "").trim();

  return (Array.isArray(concepts) ? concepts : []).map((concept) => {
    const conceptId = String(concept?.id || concept?.canonicalId || "").trim();
    let existingEntry = null;
    for (const entry of vault.entries) {
      const match = (entry.sources || []).some(
        (s) =>
          String(s?.docId || "") === docId &&
          String(s?.conceptId || "") === conceptId,
      );
      if (match) {
        existingEntry = entry;
        break;
      }
    }
    if (!existingEntry) {
      const label = String(concept?.label || concept?.title || "").trim().toLowerCase();
      existingEntry = topicEntries.find(
        (e) =>
          String(e?.canonicalTitle || "").trim().toLowerCase() === label ||
          (e.aliases || []).some((a) => String(a).trim().toLowerCase() === label),
      );
    }
    const vaultEntryId = existingEntry?.id || null;
    return {
      concept,
      conceptId,
      existingEntry,
      existingFacets: vaultEntryId ? getExistingFacetsForEntry(vault, vaultEntryId) : [],
      facetCoverage: existingEntry?.facetCoverage || {},
    };
  });
}

/**
 * @param {object} session
 * @param {object[]} [studiedOverride]
 */
export function buildBatchContext(session, studiedOverride) {
  const docId = String(session?.docId || "").trim();
  const studied = Array.isArray(studiedOverride) ? studiedOverride : getStudiedConcepts(session);
  const vault = loadVault();
  return {
    docId,
    concepts: studied.map((c) => ({
      id: String(c?.id || c?.canonicalId || "").trim(),
      title: String(c?.label || c?.title || "").trim(),
      module: String(c?.module || c?.module_id || "").trim(),
      prerequisite_ids: Array.isArray(c?.prerequisite_ids)
        ? c.prerequisite_ids.map((id) => String(id))
        : [],
      concept_type: String(c?.concept_type || c?.type || "CONCEPT").trim(),
    })),
    existingVaultAreas: getDistinctAreas(vault),
  };
}

/**
 * @param {object} session
 * @param {string} conceptId
 */
export function resolveBatchConceptById(session, conceptId) {
  const id = String(conceptId || "").trim();
  return (session?.shared?.conceptInventory || []).find(
    (c) => String(c?.id || c?.canonicalId || "") === id,
  );
}

/**
 * @param {string[]|string} value
 * @returns {string[]}
 */
export function normalizeAreaArray(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((a) => String(a || "").trim()).filter(Boolean))];
  }
  const single = String(value || "").trim();
  return single ? [single] : [];
}

/**
 * @param {object} entry
 * @param {string} newNotes
 * @param {number} now
 */
export function mergeNotesForEntry(entry, newNotes, now) {
  const incoming = String(newNotes || "").trim();
  if (!incoming) return;
  const existing = String(entry?.notes || "").trim();
  if (!existing) {
    entry.notes = incoming;
    entry.notesUpdatedAt = now;
    return;
  }
  const dateLabel = new Date(now).toISOString().slice(0, 10);
  entry.notes = `${existing}\n\n## Update ${dateLabel}\n\n${incoming}`;
  entry.notesUpdatedAt = now;
}

/**
 * @param {object} entry
 * @param {{ area?: string[], tags?: string[], notes?: string, relatedAccepted?: string[] }} payload
 * @param {number} now
 * @param {{ isMerge?: boolean }} [opts]
 */
export function applyPersonalFieldsToEntry(entry, payload, now, opts = {}) {
  const area = normalizeAreaArray(payload?.area);
  if (area.length) {
    if (opts.isMerge && Array.isArray(entry.area)) {
      entry.area = [...new Set([...entry.area, ...area])];
    } else {
      entry.area = area;
    }
    entry.topic = entry.area[0] || entry.topic || "general";
  }
  const tags = Array.isArray(payload?.tags)
    ? payload.tags.map((t) => String(t || "").trim()).filter(Boolean)
    : [];
  if (tags.length) {
    entry.tags = [...new Set([...(entry.tags || []), ...tags])];
  } else if (!Array.isArray(entry.tags)) {
    entry.tags = [];
  }
  if (String(payload?.notes || "").trim()) {
    mergeNotesForEntry(entry, payload.notes, now);
  }
  const related = Array.isArray(payload?.relatedAccepted)
    ? payload.relatedAccepted.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  if (related.length) {
    entry.related = [...new Set([...(entry.related || []), ...related])];
  } else if (!Array.isArray(entry.related)) {
    entry.related = [];
  }
  entry.type = entry.type || "CONCEPT";
  entry.status = "ready";
}

/**
 * @param {{ session: object, mapping: object, payload: object, batchContext?: object }} params
 */
export function commitVaultCurationItem({ session, mapping, payload, batchContext }) {
  const docId = String(session?.docId || "").trim();
  const conceptId = String(mapping?.conceptId || "").trim();
  if (!docId || !conceptId) throw new Error("Missing doc or concept id");

  const docTopics = Array.isArray(session?.shared?.docTopics) ? session.shared.docTopics : [];
  const topic =
    docTopics.find((t) => String(t || "").trim()) ||
    batchContext?.existingVaultAreas?.[0] ||
    "general";
  const concept = resolveBatchConceptById(session, conceptId);
  const title = String(concept?.label || concept?.title || conceptId).trim();

  let vault = loadVault();
  const normMap = mergeNormalizationResult(
    vault,
    [mapping],
    [{ id: conceptId, title }],
    docTopics.length ? docTopics : normalizeAreaArray(payload?.area),
    docId,
  );
  saveVault(vault);
  vault = loadVault();
  const vaultEntryId = normMap[conceptId];
  if (!vaultEntryId) throw new Error("Could not resolve vault entry");

  void import("./metadata-extraction.js")
    .then(({ enqueueVaultMetadataExtraction }) => {
      enqueueVaultMetadataExtraction([vaultEntryId]);
    })
    .catch((err) => {
      console.warn("[vault-curation] metadata extraction enqueue failed", err?.message || err);
    });

  const entry = vault.entries.find((e) => String(e?.id || "") === vaultEntryId);
  if (!entry) throw new Error("Vault entry missing after normalization");

  const now = Date.now();
  const isMerge = String(mapping?.action || "").toLowerCase() === "merge";

  if (!Array.isArray(entry.definitions)) entry.definitions = [];
  if (!entry.facetCoverage || typeof entry.facetCoverage !== "object") {
    entry.facetCoverage = {};
  }

  const def = payload?.definition;
  if (def?.accepted && String(def?.text || "").trim()) {
    if (!hasDefinitionFromDoc(entry, docId)) {
      entry.definitions.push({
        text: String(def.text).trim(),
        sourceDocId: docId,
        sourceChunk: String(def.sourceChunk || "").trim() || undefined,
        addedAt: now,
      });
    }
  }

  for (const ri of payload?.reviewItems || []) {
    if (!ri?.accepted) continue;
    const facet = String(ri?.facet || "").trim();
    if (!CONCEPT_FACETS.includes(facet)) continue;
    const prompt = String(ri?.prompt || "").trim();
    const answer = String(ri?.answer || "").trim();
    if (!prompt) continue;
    if (!Array.isArray(vault.reviewItems)) vault.reviewItems = [];
    vault.reviewItems.push({
      id: newVaultId(),
      vaultEntryId,
      facet,
      prompt,
      answer,
      sourceDocId: docId,
      sm2: { interval: 0, easeFactor: 2.5, repetitions: 0, dueDate: now },
      createdAt: now,
    });
  }

  applyPersonalFieldsToEntry(entry, payload, now, { isMerge });

  vault.lastUpdated = now;
  saveVault(vault);

  const relatedResolved = resolveRelatedAcceptedIds(session, payload?.relatedAccepted || []);

  return {
    vaultEntryId,
    relatedAccepted: relatedResolved,
  };
}

/**
 * Build sibling concept IDs in the same batch for related candidates.
 * @param {object} batchContext
 * @param {string} conceptId
 */
export function getSiblingRelatedCandidates(batchContext, conceptId) {
  const self = String(conceptId || "").trim();
  return (batchContext?.concepts || [])
    .map((c) => String(c?.id || "").trim())
    .filter((id) => id && id !== self);
}

/**
 * Resolve related targets to vault entry IDs (sibling concept IDs → entries with matching source).
 * @param {object} session
 * @param {string[]} relatedAccepted
 */
export function resolveRelatedAcceptedIds(session, relatedAccepted) {
  const docId = String(session?.docId || "").trim();
  const vault = loadVault();
  const out = new Set();
  for (const raw of Array.isArray(relatedAccepted) ? relatedAccepted : []) {
    const id = String(raw || "").trim();
    if (!id) continue;
    const byEntry = vault.entries.find((e) => String(e?.id || "") === id);
    if (byEntry) {
      out.add(id);
      continue;
    }
    const bySource = vault.entries.find((e) =>
      (e.sources || []).some(
        (s) => String(s?.docId || "") === docId && String(s?.conceptId || "") === id,
      ),
    );
    if (bySource) out.add(String(bySource.id));
  }
  return [...out];
}

/**
 * @param {object} session
 * @param {Array<object>} selections
 */
export async function commitVaultCuration(session, selections) {
  const docId = String(session?.docId || "").trim();
  if (!docId || !Array.isArray(selections) || !selections.length) {
    return { committed: 0 };
  }

  const batchContext = buildBatchContext(session);
  const docTopics = Array.isArray(session?.shared?.docTopics) ? session.shared.docTopics : [];
  const topic =
    docTopics.find((t) => String(t || "").trim()) ||
    batchContext.existingVaultAreas[0] ||
    "general";

  const conceptsForNorm = [];
  for (const sel of selections) {
    const conceptId = String(sel?.conceptId || "").trim();
    if (!conceptId) continue;
    const concept = resolveBatchConceptById(session, conceptId);
    if (concept) {
      conceptsForNorm.push({
        id: conceptId,
        title: String(concept.label || concept.title || conceptId).trim(),
      });
    }
  }
  if (!conceptsForNorm.length) return { committed: 0 };

  let vault = loadVault();
  const existingEntries = getEntriesByTopic(docTopics).map((e) => ({
    id: e.id,
    canonicalTitle: e.canonicalTitle,
    aliases: e.aliases || [],
    area: Array.isArray(e.area) ? e.area : [],
    topic: e.topic || "",
  }));

  let mappings = await normalizeConceptsToVault({
    existingEntries,
    newConcepts: conceptsForNorm,
    topic: String(topic),
    batchContext,
  });
  if (!mappings.length) {
    mappings = conceptsForNorm.map((c) => ({
      conceptId: c.id,
      action: "new",
      vaultEntryId: null,
      areaSuggestion: [],
      relatedCandidates: [],
    }));
  }

  let committed = 0;
  for (const sel of selections) {
    const conceptId = String(sel?.conceptId || "").trim();
    const mapping = mappings.find((m) => m.conceptId === conceptId) || {
      conceptId,
      action: "new",
      vaultEntryId: null,
    };
    const payload = {
      definition: sel?.definition,
      reviewItems: sel?.reviewItems || [],
      notes: sel?.notes || "",
      area: sel?.area || [],
      tags: sel?.tags || [],
      relatedAccepted: sel?.relatedAccepted || [],
    };
    const result = commitVaultCurationItem({ session, mapping, payload, batchContext });
    let vaultAfter = loadVault();
    applyRelatedBacklinks(vaultAfter, result.vaultEntryId, result.relatedAccepted);
    vaultAfter.lastUpdated = Date.now();
    saveVault(vaultAfter);
    committed += 1;
  }

  return { committed };
}

/**
 * @param {object} raw VaultReviewItem
 * @returns {object | null}
 */
export function normalizeVaultReviewItemForQueue(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "").trim();
  const docId = String(raw.sourceDocId || "").trim();
  if (!id || !docId) return null;
  const sm2 = raw.sm2 && typeof raw.sm2 === "object" ? raw.sm2 : {};
  const scheduledDue = Number.isFinite(sm2.dueDate) ? sm2.dueDate : Date.now();
  return {
    id: `vaultri:${id}`,
    source: "vault",
    sourceType: "vault_review_item",
    sourceId: id,
    vaultEntryId: String(raw.vaultEntryId || "").trim(),
    facet: String(raw.facet || "").trim(),
    docId,
    title: String(raw.prompt || "").trim() || "Vault review",
    contentPreview: String(raw.answer || "").trim(),
    interval: Number(sm2.interval) || 0,
    easeFactor: Number(sm2.easeFactor) || 2.5,
    repetitions: Number(sm2.repetitions) || 0,
    scheduledDue,
    lastReviewed: null,
    observations: [],
    createdAt: Number(raw.createdAt) || Date.now(),
  };
}

/**
 * @param {string} vaultEntryId
 */
export function getVaultEntryForReview(vaultEntryId) {
  return getEntryById(vaultEntryId);
}
