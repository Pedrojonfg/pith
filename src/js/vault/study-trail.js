/** Vault Study Trail — map observations to display rows (read-only UI). */

export const MAX_STUDY_TRAIL_EVENTS = 50;

const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

/** @type {Record<string, { mode: string, modeLabel: string, icon: string }>} */
const MODE_BY_TYPE_PREFIX = {
  mcq: { mode: "rsvp", modeLabel: "RSVP", icon: "zap" },
  socratic: { mode: "rsvp", modeLabel: "RSVP", icon: "zap" },
  assessment: { mode: "rsvp", modeLabel: "RSVP", icon: "zap" },
  cloze: { mode: "cloze", modeLabel: "Cloze", icon: "puzzle" },
  recall: { mode: "recall", modeLabel: "Recall", icon: "mic" },
  review: { mode: "review", modeLabel: "Review", icon: "repeat" },
  slow: { mode: "slow", modeLabel: "Slow read", icon: "book-open" },
};

/** @type {Record<string, { result: string, badgeClass: string }>} */
const RESULT_BY_TYPE = {
  mcq_correct: { result: "correct", badgeClass: "vault-trail-badge--correct" },
  cloze_correct: { result: "correct", badgeClass: "vault-trail-badge--correct" },
  review_correct: { result: "correct", badgeClass: "vault-trail-badge--correct" },
  socratic_passed: { result: "correct", badgeClass: "vault-trail-badge--correct" },
  assessment_mastered: { result: "correct", badgeClass: "vault-trail-badge--correct" },
  recall_strong: { result: "correct", badgeClass: "vault-trail-badge--correct" },
  recall_adequate: { result: "correct", badgeClass: "vault-trail-badge--correct" },
  mcq_wrong: { result: "incorrect", badgeClass: "vault-trail-badge--incorrect" },
  cloze_wrong: { result: "incorrect", badgeClass: "vault-trail-badge--incorrect" },
  review_wrong: { result: "incorrect", badgeClass: "vault-trail-badge--incorrect" },
  assessment_unknown: { result: "incorrect", badgeClass: "vault-trail-badge--incorrect" },
  recall_insufficient: { result: "incorrect", badgeClass: "vault-trail-badge--incorrect" },
  review_partial: { result: "reviewed", badgeClass: "vault-trail-badge--neutral" },
  socratic_partial: { result: "reviewed", badgeClass: "vault-trail-badge--neutral" },
  assessment_partial: { result: "reviewed", badgeClass: "vault-trail-badge--neutral" },
  recall_partial: { result: "reviewed", badgeClass: "vault-trail-badge--neutral" },
  vault_added: { result: "promoted", badgeClass: "vault-trail-badge--accent" },
  vault_promoted: { result: "promoted", badgeClass: "vault-trail-badge--accent" },
  concept_added: { result: "added", badgeClass: "vault-trail-badge--accent" },
};

const RESULT_LABELS = {
  correct: "Correct",
  incorrect: "Missed",
  promoted: "Added to vault",
  reviewed: "Reviewed",
  added: "Added",
  unknown: "—",
};

const ICON_SVG = {
  zap: '<svg class="vault-trail-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"/></svg>',
  "book-open":
    '<svg class="vault-trail-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path fill="none" stroke="currentColor" stroke-width="2" d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  puzzle:
    '<svg class="vault-trail-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M14.5 10a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0z"/><path fill="none" stroke="currentColor" stroke-width="2" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  mic: '<svg class="vault-trail-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path fill="none" stroke="currentColor" stroke-width="2" d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/></svg>',
  repeat:
    '<svg class="vault-trail-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M17 1l4 4-4 4"/><path fill="none" stroke="currentColor" stroke-width="2" d="M3 11V9a4 4 0 0 1 4-4h14"/><path fill="none" stroke="currentColor" stroke-width="2" d="M7 23l-4-4 4-4"/><path fill="none" stroke="currentColor" stroke-width="2" d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
};

/**
 * @param {number} ts
 * @param {number} [now]
 * @returns {string}
 */
export function formatStudyTrailRelativeTime(ts, now = Date.now()) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const diff = Math.max(0, now - n);
  const mins = Math.floor(diff / MS_MINUTE);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(diff / MS_HOUR);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(diff / MS_DAY);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/**
 * @param {string} type
 * @returns {{ mode: string, modeLabel: string, iconHtml: string }}
 */
export function resolveTrailMode(type) {
  const normalized = String(type || "").trim().toLowerCase();
  const prefix = normalized.split("_")[0] || "";
  const meta = MODE_BY_TYPE_PREFIX[prefix] || {
    mode: "study",
    modeLabel: "Study",
    icon: "zap",
  };
  return {
    mode: meta.mode,
    modeLabel: meta.modeLabel,
    iconHtml: ICON_SVG[meta.icon] || ICON_SVG.zap,
  };
}

/**
 * @param {string} type
 * @returns {{ result: string, badgeClass: string, resultLabel: string }}
 */
export function resolveTrailResult(type) {
  const normalized = String(type || "").trim().toLowerCase();
  const mapped = RESULT_BY_TYPE[normalized];
  const result = mapped?.result || "unknown";
  return {
    result,
    badgeClass: mapped?.badgeClass || "vault-trail-badge--neutral",
    resultLabel: RESULT_LABELS[result] || RESULT_LABELS.unknown,
  };
}

/**
 * @param {object} observation
 * @returns {{ mode: string, modeLabel: string, iconHtml: string, result: string, badgeClass: string, resultLabel: string, relativeTime: string, timestamp: number, type: string }}
 */
export function mapObservationToTrailRow(observation) {
  const type = String(observation?.type || "").trim();
  const timestamp = Number(observation?.timestamp) || 0;
  const mode = resolveTrailMode(type);
  const result = resolveTrailResult(type);
  return {
    ...mode,
    ...result,
    relativeTime: formatStudyTrailRelativeTime(timestamp),
    timestamp,
    type,
  };
}

/**
 * @param {object[]} observations
 * @param {number} [maxEvents]
 * @returns {{ rows: ReturnType<typeof mapObservationToTrailRow>[], total: number, overflow: number }}
 */
export function buildStudyTrailRows(observations, maxEvents = MAX_STUDY_TRAIL_EVENTS) {
  const list = Array.isArray(observations) ? observations : [];
  const sorted = [...list].sort((a, b) => (Number(b?.timestamp) || 0) - (Number(a?.timestamp) || 0));
  const total = sorted.length;
  const capped = sorted.slice(0, maxEvents);
  const rows = capped.map((obs) => mapObservationToTrailRow(obs));
  return {
    rows,
    total,
    overflow: Math.max(0, total - maxEvents),
  };
}
