/**
 * Global concept facet review queue.
 * @see specs/20260626-cross-doc-vault/contracts/review-global-queue.md
 */

import { buildReviewQueue, normalizeSmItem, updateSmItem } from "../sm2.js";
import { getAllSessions, loadProjectStore } from "../session-store.js";
import { getSessionsByProject } from "../project-store.js";
import {
  getDueFacetSchedules,
  getConceptById,
  upsertFacetSchedule,
} from "./registry-store.js";
import { recordObservationAndRecompute } from "./mastery.js";

/**
 * @param {{ projectId?: string }} [options]
 */
export async function buildGlobalReviewQueue(options = {}) {
  const projectId = String(options?.projectId || "all").trim();
  const items = [];
  const seen = new Set();

  for (const { concept, schedule } of getDueFacetSchedules()) {
    if (projectId !== "all") {
      const scoped = getSessionsByProject(loadProjectStore(), await getAllSessions(), projectId, {
        includeDescendants: true,
      });
      const docIds = new Set(scoped.map((s) => s.docId));
      if (!(concept.sourceDocIds || []).some((d) => docIds.has(d))) continue;
    }
    const key = `${concept.id}:${schedule.facet}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      source: "global",
      conceptId: concept.id,
      globalConceptId: concept.id,
      facet: schedule.facet,
      canonicalName: concept.canonicalName,
      title: concept.canonicalName,
      contentPreview: `${schedule.facet} facet`,
      sourceType: "global_concept",
      sourceId: key,
      docId: (concept.sourceDocIds || [])[0] || "",
      interval: schedule.interval,
      easeFactor: schedule.easeFactor,
      repetitions: schedule.repetitions,
      scheduledDue: Date.parse(schedule.dueDate) || Date.now(),
      lastReviewed: Date.parse(schedule.lastReviewedAt) || null,
      facetSchedule: schedule,
    });
  }

  for (const session of await getAllSessions()) {
    if (projectId !== "all") {
      const scoped = getSessionsByProject(loadProjectStore(), await getAllSessions(), projectId, {
        includeDescendants: true,
      });
      if (!scoped.some((s) => s.docId === session.docId)) continue;
    }
    const smItems = (session.shared?.smItems || [])
      .map((raw) => normalizeSmItem({ ...raw, docId: session.docId }))
      .filter(Boolean);
    for (const item of smItems) {
      const inv = (session.shared?.conceptInventory || []).find(
        (e) => e.globalConceptId && item.contentPreview?.includes(e.canonicalId),
      );
      if (inv?.globalConceptId) continue;
      items.push({ ...item, source: "session_legacy" });
    }
  }

  return buildReviewQueue(items);
}

/**
 * @param {object} params
 */
export function onGlobalReviewAnswer({ globalConceptId, facet, quality, sourceDocId }) {
  const id = String(globalConceptId || "").trim();
  const f = String(facet || "recognition").trim();
  const q = Number(quality);
  if (!id) return;

  const concept = getConceptById(id);
  const existing = concept?.facets?.find((s) => s.facet === f);
  const smItem = updateSmItem(
    {
      interval: existing?.interval ?? 1,
      easeFactor: existing?.easeFactor ?? 2.5,
      repetitions: existing?.repetitions ?? 0,
      scheduledDue: Date.parse(existing?.dueDate) || Date.now(),
      lastReviewed: Date.parse(existing?.lastReviewedAt) || null,
    },
    q,
  );
  upsertFacetSchedule(id, {
    facet: f,
    interval: smItem.interval,
    repetitions: smItem.repetitions,
    easeFactor: smItem.easeFactor,
    dueDate: new Date(smItem.scheduledDue).toISOString().slice(0, 10),
    lastReviewedAt: new Date(smItem.lastReviewed || Date.now()).toISOString(),
    lastQuality: q,
  });
  recordObservationAndRecompute({
    conceptId: id,
    facet: f,
    quality: q,
    sourceDocId: String(sourceDocId || ""),
  });
}

/**
 * @returns {number}
 */
export function getGlobalReviewDueCount() {
  return getDueFacetSchedules().length;
}
