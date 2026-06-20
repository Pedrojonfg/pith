/**
 * Concept maturity promotion — gray→yellow, yellow→green.
 * @see specs/20260626-cross-doc-vault/contracts/promotion-rules.md
 */

import { updateSmItem, SM2_DEFAULTS } from "../sm2.js";
import { getSession, saveActiveSession } from "../session-store.js";
import { REGISTRY_CONCEPT_FACETS } from "../session-types.js";
import { resolveGlobalConcept } from "./identity-resolution.js";
import {
  appendContentBlock,
  getConceptById,
  supersedeContentBlock,
  upsertFacetSchedule,
} from "./registry-store.js";
import { recordObservationAndRecompute } from "./mastery.js";
import { promoteGraphConnectionsToRegistry } from "./connection-promotion.js";

const GREEN_FACETS = new Set(["synthesis", "relational", "argumentative"]);
const GREEN_QUALITY_MIN = 2;

function newBlockId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `block-${Date.now()}`;
}

/**
 * @param {string} facet
 * @param {number} quality
 * @param {string} source
 */
export function qualifiesForGreen(facet, quality, source) {
  const f = String(facet || "").trim();
  const q = Number(quality);
  if (source === "slow" && f === "argumentative") return q >= GREEN_QUALITY_MIN;
  if (!GREEN_FACETS.has(f)) return false;
  return q >= GREEN_QUALITY_MIN;
}

/**
 * @param {object} session
 * @param {string} globalConceptId
 * @param {string} inventoryEntryId
 */
export async function backfillGlobalConceptIds(session, globalConceptId, inventoryEntryId) {
  if (!session?.shared) return;
  const invId = String(inventoryEntryId || "").trim();
  const globalId = String(globalConceptId || "").trim();
  if (!globalId) return;

  for (const entry of session.shared.conceptInventory || []) {
    const cid = String(entry?.canonicalId || entry?.id || "").trim();
    if (cid === invId || entry.globalConceptId === globalId) {
      entry.globalConceptId = globalId;
    }
  }

  for (const sig of session.shared.assessmentSignals || []) {
    const cid = String(sig?.conceptId || sig?.canonicalId || "").trim();
    if (cid === invId) sig.globalConceptId = globalId;
  }
  await saveActiveSession(session);
}

function findInventoryEntry(session, conceptId) {
  const needle = String(conceptId || "").trim();
  return (session?.shared?.conceptInventory || []).find(
    (c) => String(c?.canonicalId || c?.id || "").trim() === needle,
  );
}

function applySm2ToSchedule(existing, quality) {
  const base = existing || {
    facet: "recognition",
    interval: 0,
    repetitions: 0,
    easeFactor: SM2_DEFAULTS.easeFactor,
    dueDate: new Date().toISOString().slice(0, 10),
    lastReviewedAt: "",
    lastQuality: 0,
  };
  const smItem = updateSmItem(
    {
      interval: base.interval || SM2_DEFAULTS.interval,
      easeFactor: base.easeFactor || SM2_DEFAULTS.easeFactor,
      repetitions: base.repetitions || 0,
      scheduledDue: Date.parse(base.dueDate) || Date.now(),
      lastReviewed: Date.parse(base.lastReviewedAt) || null,
    },
    quality,
  );
  return {
    facet: base.facet,
    interval: smItem.interval,
    repetitions: smItem.repetitions,
    easeFactor: smItem.easeFactor,
    dueDate: new Date(smItem.scheduledDue).toISOString().slice(0, 10),
    lastReviewedAt: new Date(smItem.lastReviewed || Date.now()).toISOString(),
    lastQuality: quality,
  };
}

function resolveFacetForMode(facet, source, recallType) {
  const f = String(facet || recallType || "").trim();
  if (f && REGISTRY_CONCEPT_FACETS.includes(f)) return f;
  if (source === "recall" && f) return f;
  return "recognition";
}

/**
 * @param {object} params
 */
export async function onConceptEngagement({
  session,
  conceptId,
  facet,
  quality,
  source,
  contentText,
  recallType,
}) {
  const docId = String(session?.docId || "").trim();
  const invId = String(conceptId || "").trim();
  if (!docId || !invId) {
    throw new Error("onConceptEngagement requires session and conceptId");
  }

  const entry = findInventoryEntry(session, invId);
  const label = String(entry?.label || entry?.name || invId).trim();
  const description = String(entry?.definition || entry?.description || "").trim();
  const resolvedFacet = resolveFacetForMode(facet, source, recallType);
  const q = Number.isFinite(quality) ? quality : 0;

  let globalConceptId = String(entry?.globalConceptId || "").trim();
  if (!globalConceptId) {
    const resolved = await resolveGlobalConcept({
      canonicalName: label,
      description,
      sourceDocId: docId,
      inventoryEntryId: invId,
    });
    globalConceptId = resolved.conceptId;
    if (entry) entry.globalConceptId = globalConceptId;
    backfillGlobalConceptIds(session, globalConceptId, invId);
  }

  const concept = getConceptById(globalConceptId);
  const existingSchedule = concept?.facets?.find((f) => f.facet === resolvedFacet);
  const schedule = applySm2ToSchedule(
    existingSchedule ? { ...existingSchedule, facet: resolvedFacet } : { facet: resolvedFacet },
    q,
  );
  upsertFacetSchedule(globalConceptId, schedule);
  recordObservationAndRecompute({
    conceptId: globalConceptId,
    facet: resolvedFacet,
    quality: q,
    sourceDocId: docId,
  });

  let promotedToGreen = false;
  const text = String(contentText || "").trim();
  if (text && qualifiesForGreen(resolvedFacet, q, source)) {
    const blockId = newBlockId();
    const prior = (concept?.content?.blocks || []).find(
      (b) => b.facet === resolvedFacet && !b.supersededBy,
    );
    appendContentBlock(globalConceptId, {
      id: blockId,
      facet: resolvedFacet,
      text,
      sourceDocId: docId,
      sourceSessionDate: new Date().toISOString(),
      supersededBy: null,
    });
    if (prior && q > (prior.lastQuality || 0)) {
      supersedeContentBlock(globalConceptId, prior.id, blockId);
    }
    promotedToGreen = true;
  }

  const updated = getConceptById(globalConceptId);
  try {
    promoteGraphConnectionsToRegistry(session);
  } catch (err) {
    console.warn("[concept-registry] connection promotion failed", err?.message || err);
  }
  return {
    globalConceptId,
    maturity: updated?.maturity || "yellow",
    promotedToGreen,
  };
}
