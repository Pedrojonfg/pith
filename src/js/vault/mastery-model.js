/** Mastery decay and observation weighting for Global Knowledge Vault. */

export const ALPHA = 0.3;
export const LAMBDA = 0.05;
export const PRESUMED_KNOWN_THRESHOLD = 0.7;

const MS_PER_DAY = 86_400_000;

/** @type {Record<string, number>} */
export const OBSERVATION_WEIGHTS = {
  cloze_correct: 1.0,
  socratic_passed: 0.85,
  assessment_mastered: 0.75,
  mcq_correct: 0.6,
  socratic_partial: 0.2,
  assessment_partial: 0.1,
  mcq_wrong: -0.3,
  cloze_wrong: -0.5,
  assessment_unknown: -0.1,
};

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * @param {object} entry
 * @param {number} [now]
 * @returns {number}
 */
export function getCurrentMastery(entry, now = Date.now()) {
  if (!entry || typeof entry !== "object") return 0;
  const base = Number(entry.masteryBase);
  const last = Number(entry.masteryLastUpdated);
  if (!Number.isFinite(base)) return 0;
  if (!Number.isFinite(last)) return clamp01(base);
  const daysSince = (now - last) / MS_PER_DAY;
  if (daysSince <= 0) return clamp01(base);
  return clamp01(base * Math.exp(-LAMBDA * daysSince));
}

/**
 * @param {object} entry
 * @param {number} [now]
 * @returns {'unknown'|'partial'|'acquired'|'mastered'}
 */
export function getMasteryLabel(entry, now = Date.now()) {
  const m = getCurrentMastery(entry, now);
  if (m >= 0.8) return "mastered";
  if (m >= 0.6) return "acquired";
  if (m >= 0.3) return "partial";
  return "unknown";
}

/**
 * @param {object} entry
 * @param {number} [now]
 * @returns {object}
 */
export function hydrateMastery(entry, now = Date.now()) {
  if (!entry || typeof entry !== "object") return entry;
  return { ...entry, mastery: getCurrentMastery(entry, now) };
}

/**
 * @param {object} entry
 * @param {{ type: string, rawSignal?: number, timestamp?: number, docId?: string }} observation
 */
export function updateMastery(entry, observation) {
  if (!entry || typeof entry !== "object" || !observation) return;
  const type = String(observation.type || "").trim();
  const weightTable = OBSERVATION_WEIGHTS[type];
  const rawSignal =
    observation.rawSignal != null && Number.isFinite(Number(observation.rawSignal))
      ? Number(observation.rawSignal)
      : weightTable != null
        ? weightTable
        : 0;
  const timestamp = Number(observation.timestamp) || Date.now();
  const last = Number(entry.masteryLastUpdated) || timestamp;
  const daysSince = (timestamp - last) / MS_PER_DAY;
  const decayed =
    daysSince > 0
      ? clamp01(Number(entry.masteryBase) * Math.exp(-LAMBDA * daysSince))
      : clamp01(Number(entry.masteryBase) || 0);

  entry.masteryBase = clamp01(decayed + ALPHA * rawSignal);
  entry.masteryLastUpdated = timestamp;
  if (!Array.isArray(entry.observations)) entry.observations = [];
  entry.observations.push({
    type,
    rawSignal,
    timestamp,
    docId: String(observation.docId || "").trim(),
  });
}
