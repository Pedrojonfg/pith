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
 * @param {Array<object>} selections
 */
export async function commitVaultCuration(session, selections) {
  const docId = String(session?.docId || "").trim();
  if (!docId || !Array.isArray(selections) || !selections.length) {
    return { committed: 0 };
  }

  const docTopics = Array.isArray(session?.shared?.docTopics) ? session.shared.docTopics : [];
  const topic =
    docTopics.find((t) => String(t || "").trim()) || "general";

  const conceptsForNorm = [];
  for (const sel of selections) {
    const conceptId = String(sel?.conceptId || "").trim();
    if (!conceptId) continue;
    const concept = (session.shared?.conceptInventory || []).find(
      (c) => String(c?.id || c?.canonicalId || "") === conceptId,
    );
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
  }));

  let mappings = await normalizeConceptsToVault({
    existingEntries,
    newConcepts: conceptsForNorm,
    topic: String(topic),
  });
  if (!mappings.length) {
    mappings = conceptsForNorm.map((c) => ({
      conceptId: c.id,
      action: "new",
      vaultEntryId: null,
    }));
  }

  const normMap = mergeNormalizationResult(
    vault,
    mappings,
    conceptsForNorm,
    docTopics,
    docId,
  );
  vault = loadVault();

  let committed = 0;
  const now = Date.now();

  for (const sel of selections) {
    const conceptId = String(sel?.conceptId || "").trim();
    const vaultEntryId = normMap[conceptId];
    if (!vaultEntryId) continue;
    const entry = vault.entries.find((e) => String(e?.id || "") === vaultEntryId);
    if (!entry) continue;

    if (!Array.isArray(entry.definitions)) entry.definitions = [];
    if (!entry.facetCoverage || typeof entry.facetCoverage !== "object") {
      entry.facetCoverage = {};
    }

    const def = sel?.definition;
    if (def?.accepted && String(def?.text || "").trim()) {
      if (!hasDefinitionFromDoc(entry, docId)) {
        entry.definitions.push({
          text: String(def.text).trim(),
          sourceDocId: docId,
          sourceChunk: String(def.sourceChunk || "").trim() || undefined,
          addedAt: now,
        });
        committed += 1;
      }
    }

    for (const ri of sel?.reviewItems || []) {
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
      committed += 1;
    }
  }

  vault.lastUpdated = now;
  saveVault(vault);
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
