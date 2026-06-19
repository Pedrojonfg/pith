/**
 * Bridge from study modes into global concept promotion.
 */

import { mapMcqOutcomeToQuality, RECALL_QUALITY_TO_SM2 } from "../sm2-ingest.js";
import { getSession } from "../session-store.js";
import { onConceptEngagement } from "./promotion.js";

/**
 * @param {object} params
 */
export async function promoteFromMcqBlock({
  docId,
  conceptIds,
  correct,
  firstTry,
  usedHint,
  skipped,
  source = "rsvp",
}) {
  const session = await getSession(docId);
  if (!session) return;
  const quality = mapMcqOutcomeToQuality({ correct, firstTry, usedHint, skipped });
  const ids = Array.isArray(conceptIds) ? conceptIds : [];
  for (const conceptId of ids) {
    const id = String(conceptId || "").trim();
    if (!id) continue;
    try {
      await onConceptEngagement({
        session,
        conceptId: id,
        facet: "recognition",
        quality,
        source,
      });
    } catch (err) {
      console.warn("[concept-registry] MCQ promotion failed", id, err);
    }
  }
}

/**
 * @param {object} params
 */
export async function promoteFromRecall({ docId, question }) {
  const session = await getSession(docId);
  if (!session) return;
  const q = question && typeof question === "object" ? question : null;
  if (!q) return;
  const qualityKey = String(q?.tutor_feedback?.quality || "").trim();
  const quality = RECALL_QUALITY_TO_SM2[qualityKey];
  if (quality == null) return;
  const recallType = String(q.recall_type || "").trim();
  const facet = recallType || "synthesis";
  const answer = String(q.student_answer || "").trim();
  const conceptIds = Array.isArray(q.concept_ids) ? q.concept_ids : [];
  for (const conceptId of conceptIds) {
    const id = String(conceptId || "").trim();
    if (!id) continue;
    try {
      await onConceptEngagement({
        session,
        conceptId: id,
        facet,
        quality,
        source: "recall",
        recallType,
        contentText: answer,
      });
    } catch (err) {
      console.warn("[concept-registry] Recall promotion failed", id, err);
    }
  }
}

/**
 * @param {object} params
 */
export async function promoteFromCloze({ docId, conceptId, quality }) {
  const session = await getSession(docId);
  if (!session) return;
  const id = String(conceptId || "").trim();
  if (!id) return;
  const q = Number(quality);
  if (!Number.isFinite(q)) return;
  try {
    await onConceptEngagement({
      session,
      conceptId: id,
      facet: "recognition",
      quality: q,
      source: "cloze",
    });
  } catch (err) {
    console.warn("[concept-registry] Cloze promotion failed", id, err);
  }
}
