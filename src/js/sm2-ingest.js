import { createSmItem, normalizeSmItem, updateSmItem } from "./sm2.js";
import { getSession, upsertSmItem } from "./session-store.js";

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

/**
 * @param {string} docId
 * @param {object} params
 * @returns {object}
 */
export function registerOrUpdateSmItem(docId, params) {
  const session = getSession(docId);
  if (!session) throw new Error("session not found");

  const sourceType = params.sourceType;
  const sourceId = String(params.sourceId || "").trim();
  if (!sourceType || !sourceId) throw new Error("registerOrUpdateSmItem requires sourceType and sourceId");

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
      });

  if (params.quality != null) {
    item = updateSmItem(item, params.quality);
  }

  upsertSmItem(docId, item);
  return item;
}
