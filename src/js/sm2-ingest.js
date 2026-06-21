import { createSmItem, normalizeSmItem, updateSmItem } from "./sm2.js";
import { getSession, upsertSmItem, saveActiveSession } from "./session-store.js";
import { isComprehensionGateEnabled } from "./config/flags.js";
import {
  applyComprehensionSignal,
  mayScheduleSm2ForConcepts,
} from "./pedagogy/comprehension-gate.js";

/**
 * @param {{ correct?: boolean, firstTry?: boolean, usedHint?: boolean, skipped?: boolean }} outcome
 * @returns {number}
 */
export function mapMcqOutcomeToQuality({ correct, firstTry = true, usedHint = false, skipped = false }) {
  if (skipped) return 2;
  if (!correct) return 1;
  if (usedHint) return 3;
  if (firstTry === false) return 4;
  return 5;
}

/**
 * @param {string} result EASY | MEDIUM | HARD | FAIL
 * @returns {number}
 */
export function mapClozeResultToQuality(result) {
  const key = String(result || "").trim().toUpperCase();
  if (key === "EASY") return 5;
  if (key === "MEDIUM") return 4;
  if (key === "HARD") return 3;
  if (key === "FAIL") return 1;
  return 3;
}

/** @type {Record<string, number>} */
export const RECALL_QUALITY_TO_SM2 = {
  strong: 5,
  adequate: 4,
  partial: 2,
  insufficient: 1,
};

/**
 * @param {string} docId
 * @param {object} params
 * @returns {object}
 */
export async function registerOrUpdateSmItem(docId, params) {
  const session = await getSession(docId);
  if (!session) throw new Error("session not found");

  const sourceType = params.sourceType;
  const sourceId = String(params.sourceId || "").trim();
  if (!sourceType || !sourceId) throw new Error("registerOrUpdateSmItem requires sourceType and sourceId");

  const conceptIds = Array.isArray(params.conceptIds)
    ? params.conceptIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  if (isComprehensionGateEnabled() && conceptIds.length) {
    if (!mayScheduleSm2ForConcepts(session, conceptIds)) {
      return null;
    }
  }

  const reviewProvenance = params.reviewProvenance || "document";

  const existing = (session.shared?.smItems || [])
    .map((raw) => normalizeSmItem({ ...raw, docId }))
    .find((item) => item && item.sourceType === sourceType && item.sourceId === sourceId);

  let item = existing
    ? {
        ...existing,
        title: String(params.title || existing.title || "").trim() || existing.title,
        contentPreview:
          params.contentPreview != null
            ? String(params.contentPreview).trim()
            : existing.contentPreview,
      }
    : createSmItem({
        ...params,
        docId,
        sourceType,
        sourceId,
        title: params.title,
        contentPreview: params.contentPreview,
        reviewProvenance,
      });

  if (params.quality != null) {
    item = updateSmItem(item, params.quality);
    if (params.quality < 3) {
      item = { ...item, lastMissAt: Date.now() };
    }
  }

  await upsertSmItem(docId, item);
  return item;
}

/**
 * Mark comprehension confirmed on concept inventory entries.
 * @param {string} docId
 * @param {string[]} conceptIds
 * @param {'recall'|'socratic'} signal
 * @param {number|string} [quality]
 */
export async function confirmComprehensionForConcepts(docId, conceptIds, signal, quality) {
  const session = await getSession(docId);
  if (!session || !Array.isArray(session.shared?.conceptInventory)) return;

  const ids = new Set((conceptIds || []).map((id) => String(id || "").trim()).filter(Boolean));
  if (!ids.size) return;

  let changed = false;
  session.shared.conceptInventory = session.shared.conceptInventory.map((entry) => {
    const cid = String(entry?.canonicalId || entry?.id || "").trim();
    if (!ids.has(cid)) return entry;
    const updated = applyComprehensionSignal(entry, signal, quality);
    if (updated !== entry) changed = true;
    return updated;
  });

  if (changed) await saveActiveSession(session);
}

/**
 * @param {{ docId: string, question: object }} params
 */
export async function ingestSm2FromRecallAnswer({ docId, question }) {
  const q = question && typeof question === "object" ? question : null;
  const qualityKey = String(q?.tutor_feedback?.quality || "").trim();
  const quality = RECALL_QUALITY_TO_SM2[qualityKey];
  if (quality == null) return;

  const conceptIds = Array.isArray(q.concept_ids) ? q.concept_ids : [];
  await confirmComprehensionForConcepts(docId, conceptIds, "recall", qualityKey);

  const title = String(q.question || "").trim();
  const preview = conceptIds.join(", ");
  for (const conceptId of conceptIds) {
    const id = String(conceptId || "").trim();
    if (!id) continue;
    await registerOrUpdateSmItem(docId, {
      sourceType: "recall_question",
      sourceId: `${String(q.id || "").trim()}:${id}`,
      title: title.slice(0, 80),
      contentPreview: preview,
      conceptIds: [id],
      quality,
      reviewProvenance: "document",
    });
  }
}
