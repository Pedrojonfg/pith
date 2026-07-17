/**
 * Pure SM-2 spaced repetition + priority queue helpers.
 * No side effects — no localStorage, DOM, or session-store imports.
 */

export const MS_PER_DAY = 86_400_000;
export const THRESHOLD_RATIO = 0.7;

export const SM2_DEFAULTS = {
  interval: 1,
  easeFactor: 2.5,
  repetitions: 0,
  scheduledDue: null,
  lastReviewed: null,
  observations: [],
};

const SOURCE_TYPES = new Set([
  "rsvp_block",
  "cloze_item",
  "slow_flashcard",
  "vault_concept",
  "vault_review_item",
  "global_concept",
  "recall_question",
]);

export const REVIEW_PROVENANCE_TYPES = new Set([
  "document",
  "gap_fill",
  "mnemonic",
  "vault_curation",
]);

const LEGACY_SOURCE_MAP = {
  rsvp: "rsvp_block",
  questions: "rsvp_block",
  cloze: "cloze_item",
  slow: "slow_flashcard",
  vault_decay: "vault_concept",
  vault: "vault_concept",
  vault_review: "vault_review_item",
};

function clampQuality(quality) {
  const q = Math.round(Number(quality));
  if (!Number.isFinite(q)) return 0;
  return Math.max(0, Math.min(5, q));
}

function resolveReviewProvenance(raw) {
  const p = String(raw?.reviewProvenance || "").trim();
  if (REVIEW_PROVENANCE_TYPES.has(p)) return p;
  const legacySource = String(raw?.source || "").trim();
  if (legacySource === "mnemonic") return "mnemonic";
  if (legacySource === "vault_curation" || legacySource === "vault") return "vault_curation";
  if (legacySource === "gap_fill") return "gap_fill";
  return "document";
}

function provenancePenalty(provenance, gapFillPenalty) {
  if (provenance === "gap_fill") return Number(gapFillPenalty) || 0;
  return 0;
}

/** Due bucket width for secondary sort (1 hour). */
const DUE_BUCKET_MS = 3_600_000;

function resolveSourceType(raw) {
  if (typeof raw?.sourceType === "string" && SOURCE_TYPES.has(raw.sourceType)) {
    return raw.sourceType;
  }
  const legacy = String(raw?.sourceMode || raw?.source || "").trim();
  return LEGACY_SOURCE_MAP[legacy] || null;
}

/**
 * @param {object} params
 * @returns {object}
 */
export function createSmItem(params = {}) {
  const now = Date.now();
  const sourceType = resolveSourceType(params) || params.sourceType;
  if (!sourceType || !SOURCE_TYPES.has(sourceType)) {
    // [debug-enrich]
    console.error('[sm2.createSmItem] Invalid sourceType:', {
      sourceType: params.sourceType ?? null,
      resolved: sourceType ?? null,
    });
    throw new Error("createSmItem requires valid sourceType");
  }
  const sourceId = String(params.sourceId || "").trim();
  const docId = String(params.docId || params.originDocId || "").trim();
  if (!sourceId || !docId) {
    // [debug-enrich]
    console.error('[sm2.createSmItem] Missing sourceId or docId:', {
      hasSourceId: Boolean(sourceId),
      hasDocId: Boolean(docId),
      sourceType,
    });
    throw new Error("createSmItem requires sourceId and docId");
  }

  const item = {
    id: String(params.id || crypto.randomUUID()),
    sourceType,
    sourceId,
    docId,
    title: String(params.title || "").trim(),
    contentPreview: String(params.contentPreview || "").trim(),
    interval: Number.isFinite(params.interval) ? params.interval : SM2_DEFAULTS.interval,
    easeFactor: Number.isFinite(params.easeFactor) ? params.easeFactor : SM2_DEFAULTS.easeFactor,
    repetitions: Number.isFinite(params.repetitions) ? params.repetitions : SM2_DEFAULTS.repetitions,
    scheduledDue: Number.isFinite(params.scheduledDue) ? params.scheduledDue : now,
    lastReviewed: params.lastReviewed ?? SM2_DEFAULTS.lastReviewed,
    observations: Array.isArray(params.observations) ? [...params.observations] : [],
    createdAt: Number.isFinite(params.createdAt) ? params.createdAt : now,
    reviewProvenance: resolveReviewProvenance(params),
  };
  // [debug-enrich]
  console.debug('[sm2.createSmItem] Created:', {
    id: item.id,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    docId: item.docId,
    reviewProvenance: item.reviewProvenance,
  });
  return item;
}

/**
 * @param {object} raw
 * @returns {object | null}
 */
export function normalizeSmItem(raw) {
  if (!raw || typeof raw !== "object") return null;

  const sourceType = resolveSourceType(raw);
  if (!sourceType) return null;

  const vaultEntryId = String(raw.vaultEntryId || "").trim();
  const sourceId = String(
    raw.sourceId ||
      (sourceType === "vault_concept" && vaultEntryId ? vaultEntryId : "") ||
      (String(raw.id || "").includes(":") ? String(raw.id).split(":").slice(1).join(":") : raw.id) ||
      "",
  ).trim();
  if (!sourceId) return null;

  // originDocId alias kept for callers; empty → drop (never enter review queue)
  const docId = String(raw.docId || raw.originDocId || raw.sourceDocId || "").trim();
  if (!docId) return null;
  const scheduledDue = Number.isFinite(raw.scheduledDue)
    ? raw.scheduledDue
    : Number.isFinite(raw.nextReview)
      ? raw.nextReview
      : Date.now();

  const title =
    String(raw.title || raw.conceptTitle || raw.question || "").trim() || "Review item";
  const contentPreview = String(raw.contentPreview || raw.answer || "").trim();

  const id =
    String(raw.id || "").trim() ||
    (sourceType === "vault_concept" ? `vault:${sourceId}` : `${sourceType}:${sourceId}`);

  const repetitions = Number.isFinite(raw.repetitions)
    ? raw.repetitions
    : Number.isFinite(raw.reviewCount)
      ? raw.reviewCount
      : SM2_DEFAULTS.repetitions;

  const out = {
    id,
    sourceType,
    sourceId,
    docId,
    title,
    contentPreview,
    interval: Number.isFinite(raw.interval) ? raw.interval : SM2_DEFAULTS.interval,
    easeFactor: Number.isFinite(raw.easeFactor) ? Math.max(1.3, raw.easeFactor) : SM2_DEFAULTS.easeFactor,
    repetitions,
    scheduledDue,
    lastReviewed: Number.isFinite(raw.lastReviewed) ? raw.lastReviewed : SM2_DEFAULTS.lastReviewed,
    observations: Array.isArray(raw.observations) ? [...raw.observations] : [],
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
    reviewProvenance: resolveReviewProvenance(raw),
  };
  if (raw.source) out.source = raw.source;
  if (raw.facet) out.facet = raw.facet;
  if (raw.globalConceptId) out.globalConceptId = raw.globalConceptId;
  if (raw.vaultEntryId) out.vaultEntryId = raw.vaultEntryId;
  if (Number.isFinite(raw.lastMissAt)) out.lastMissAt = raw.lastMissAt;
  return out;
}

/**
 * @param {object} item
 * @param {number} [now]
 * @returns {boolean}
 */
export function isOnTime(item, now = Date.now()) {
  if (!item) return false;
  if (item.lastReviewed == null) return true;
  const intervalMs = Math.max(0, Number(item.interval) || 0) * MS_PER_DAY;
  const scheduledDue = Number(item.scheduledDue);
  if (!Number.isFinite(scheduledDue)) return true;
  const threshold = scheduledDue - intervalMs * (1 - THRESHOLD_RATIO);
  return now >= threshold;
}

/**
 * @param {object} item
 * @param {number} quality
 * @param {number} [now]
 * @returns {object}
 */
export function updateSmItem(item, quality, now = Date.now()) {
  const q = clampQuality(quality);
  const early = !isOnTime(item, now);
  const scheduledDue = Number(item.scheduledDue) || now;
  const daysEarly =
    early && scheduledDue > now ? (scheduledDue - now) / MS_PER_DAY : 0;

  // [debug-enrich]
  console.debug('[sm2.updateSmItem] Updating:', {
    itemId: item?.id ?? null,
    qualityRaw: quality,
    qualityClamped: q,
    early,
    daysEarly: Math.round(daysEarly * 100) / 100,
    intervalBefore: Number(item?.interval) || 0,
    easeBefore: Number(item?.easeFactor) || 0,
    repsBefore: Number(item?.repetitions) || 0,
  });

  const observation = {
    timestamp: now,
    quality: q,
    wasEarly: early,
    intervalAtTime: Number(item.interval) || 0,
    daysEarly: Math.max(0, daysEarly),
  };

  const updated = {
    ...item,
    lastReviewed: now,
    observations: [...(Array.isArray(item.observations) ? item.observations : []), observation],
  };

  if (early) {
    // [debug-enrich]
    console.debug('[sm2.updateSmItem] Early review — schedule unchanged', {
      itemId: item?.id ?? null,
    });
    return updated;
  }

  let easeFactor = Number(item.easeFactor) || SM2_DEFAULTS.easeFactor;
  let interval = Number(item.interval) || SM2_DEFAULTS.interval;
  let repetitions = Number(item.repetitions) || 0;

  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

  if (q < 3) {
    repetitions = 0;
    interval = 1;
  } else if (repetitions === 0) {
    interval = 1;
    repetitions = 1;
  } else if (repetitions === 1) {
    interval = 6;
    repetitions = 2;
  } else {
    interval = Math.max(1, Math.round(interval * easeFactor));
    repetitions += 1;
  }

  updated.easeFactor = easeFactor;
  updated.interval = interval;
  updated.repetitions = repetitions;
  updated.scheduledDue = now + interval * MS_PER_DAY;
  // [debug-enrich]
  console.debug('[sm2.updateSmItem] Schedule updated:', {
    itemId: item?.id ?? null,
    interval,
    easeFactor,
    repetitions,
    scheduledDue: updated.scheduledDue,
  });
  return updated;
}

/**
 * @param {object[]} items
 * @param {number} [now]
 * @param {{ gapFillPenalty?: number, maxGapFillPerSession?: number, applySessionCap?: boolean }} [options]
 * @returns {object[]}
 */
export function buildReviewQueue(items, now = Date.now(), options = {}) {
  void now;
  const gapFillPenalty = Number.isFinite(options.gapFillPenalty) ? options.gapFillPenalty : 2.0;
  const maxGapFill = Number.isFinite(options.maxGapFillPerSession)
    ? options.maxGapFillPerSession
    : 3;
  const applyCap = options.applySessionCap !== false;

  const normalized = (Array.isArray(items) ? items : [])
    .map((raw) => normalizeSmItem(raw))
    .filter(Boolean);

  const sorted = normalized
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const dueA = Number(a.item.scheduledDue) || 0;
      const dueB = Number(b.item.scheduledDue) || 0;
      const dueDiff = dueA - dueB;
      if (dueDiff !== 0) return dueDiff;

      const bucketA = Math.floor(dueA / DUE_BUCKET_MS);
      const bucketB = Math.floor(dueB / DUE_BUCKET_MS);
      if (bucketA !== bucketB) return dueA - dueB;

      const penA = provenancePenalty(a.item.reviewProvenance, gapFillPenalty);
      const penB = provenancePenalty(b.item.reviewProvenance, gapFillPenalty);
      if (penA !== penB) return penA - penB;
      return a.index - b.index;
    })
    .map(({ item }) => ({ ...item }));

  if (!applyCap) {
    // [debug-enrich]
    console.debug('[sm2.buildReviewQueue] Built (no cap):', {
      inputCount: Array.isArray(items) ? items.length : 0,
      normalizedCount: normalized.length,
      queueLength: sorted.length,
    });
    return sorted;
  }

  let gapFillCount = 0;
  const capped = [];
  for (const item of sorted) {
    if (item.reviewProvenance === "gap_fill") {
      if (gapFillCount >= maxGapFill) continue;
      gapFillCount += 1;
    }
    capped.push(item);
  }
  // [debug-enrich]
  console.debug('[sm2.buildReviewQueue] Built:', {
    inputCount: Array.isArray(items) ? items.length : 0,
    normalizedCount: normalized.length,
    queueLength: capped.length,
    gapFillInQueue: gapFillCount,
    maxGapFill,
  });
  return capped;
}

/**
 * @param {object[]} items
 * @param {number} [now]
 * @returns {{ dueNow: number, dueToday: number, total: number }}
 */
export function getQueueStats(items, now = Date.now()) {
  const list = (Array.isArray(items) ? items : [])
    .map((raw) => normalizeSmItem(raw))
    .filter(Boolean);
  const endToday = now + MS_PER_DAY;
  let dueNow = 0;
  let dueToday = 0;
  for (const item of list) {
    const due = Number(item.scheduledDue) || 0;
    if (due <= now) dueNow += 1;
    if (due <= endToday) dueToday += 1;
  }
  return { dueNow, dueToday, total: list.length };
}
