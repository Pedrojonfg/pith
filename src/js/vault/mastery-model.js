import { deLog } from "../debug-enrich.js";
/** Mastery decay and observation weighting for Global Knowledge Vault. */

export const ALPHA = 0.3;
export const LAMBDA = 0.05;
export const PRESUMED_KNOWN_THRESHOLD = 0.7;
export const DECLARATIVE_WEIGHT = 0.4;
export const PROCEDURAL_WEIGHT = 0.6;
export const BKT_OBSERVATION_THRESHOLD = 15;

/** @type {{ pL0: number, pT: number, pG: number, pS: number }} */
export const DEFAULT_BKT_PARAMS = Object.freeze({
  pL0: 0.3,
  pT: 0.2,
  pG: 0.2,
  pS: 0.1,
});

const MS_PER_DAY = 86_400_000;

/** @type {Record<string, number>} */
export const OBSERVATION_WEIGHTS = {
  cloze_correct: 1.0,
  review_correct: 1.0,
  socratic_passed: 0.85,
  assessment_mastered: 0.75,
  mcq_correct: 0.6,
  review_partial: 0.3,
  socratic_partial: 0.2,
  assessment_partial: 0.1,
  mcq_wrong: -0.3,
  assessment_unknown: -0.1,
  cloze_wrong: -0.5,
  review_wrong: -0.5,
};

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * @param {number} base
 * @param {number} lastUpdated
 * @param {number} now
 * @returns {number}
 */
function decayBase(base, lastUpdated, now) {
  if (!Number.isFinite(base)) return 0;
  if (!Number.isFinite(lastUpdated)) return clamp01(base);
  const daysSince = (now - lastUpdated) / MS_PER_DAY;
  if (daysSince <= 0) return clamp01(base);
  return clamp01(base * Math.exp(-LAMBDA * daysSince));
}

/**
 * @param {object} entry
 * @returns {boolean}
 */
export function hasBothMasteryDimensions(entry) {
  return (
    Number.isFinite(Number(entry?.masteryDeclarativeBase)) &&
    Number.isFinite(Number(entry?.masteryProceduralBase))
  );
}

/**
 * @param {object} entry
 * @param {'declarative'|'procedural'} dimension
 * @param {number} [now]
 * @returns {number}
 */
export function getDimensionMastery(entry, dimension, now = Date.now()) {
  if (!entry || typeof entry !== "object") return 0;
  const isDeclarative = dimension !== "procedural";
  const base = Number(isDeclarative ? entry.masteryDeclarativeBase : entry.masteryProceduralBase);
  const last = Number(
    isDeclarative ? entry.masteryDeclarativeLastUpdated : entry.masteryProceduralLastUpdated,
  );
  return decayBase(base, last, now);
}

/**
 * Route observation to declarative or procedural dimension (research R4).
 * @param {{ type?: string, taskKind?: string, questionKind?: string, question_kind?: string }} observation
 * @returns {'declarative'|'procedural'}
 */
export function resolveTaskKind(observation) {
  if (!observation || typeof observation !== "object") return "declarative";
  const explicit = String(observation.taskKind || "").trim().toLowerCase();
  if (explicit === "declarative" || explicit === "procedural") return explicit;

  const qKind = String(observation.questionKind || observation.question_kind || "")
    .trim()
    .toLowerCase();
  if (qKind === "application" || qKind === "calculation" || qKind === "procedural") {
    return "procedural";
  }
  if (qKind === "declarative" || qKind === "definition") return "declarative";

  const type = String(observation.type || "").trim().toLowerCase();
  if (type.startsWith("socratic_")) return "procedural";
  if (type.startsWith("cloze_")) return "declarative";
  if (type.startsWith("assessment_")) return "declarative";
  if (type === "mcq_correct" || type === "mcq_wrong") return "declarative";
  return "declarative";
}

/**
 * @param {object} entry
 */
function ensureDimensionFields(entry) {
  const now = Number(entry.masteryLastUpdated) || Date.now();
  const base = Number(entry.masteryBase) || 0;
  if (!Number.isFinite(Number(entry.masteryDeclarativeBase))) {
    entry.masteryDeclarativeBase = base;
    entry.masteryDeclarativeLastUpdated = now;
  }
  if (!Number.isFinite(Number(entry.masteryProceduralBase))) {
    entry.masteryProceduralBase = base;
    entry.masteryProceduralLastUpdated = now;
  }
}

/**
 * @param {object} entry
 * @param {'declarative'|'procedural'} dimension
 * @param {number} rawSignal
 * @param {number} timestamp
 */
export function updateMasteryDimension(entry, dimension, rawSignal, timestamp) {
  if (!entry || typeof entry !== "object") return;
  ensureDimensionFields(entry);
  const dim = dimension === "procedural" ? "procedural" : "declarative";
  const baseKey = dim === "declarative" ? "masteryDeclarativeBase" : "masteryProceduralBase";
  const lastKey =
    dim === "declarative" ? "masteryDeclarativeLastUpdated" : "masteryProceduralLastUpdated";

  const ts = Number(timestamp) || Date.now();
  const signal = Number(rawSignal);
  if (!Number.isFinite(signal)) return;

  const base = Number(entry[baseKey]) || 0;
  const last = Number(entry[lastKey]) || ts;
  const decayed = decayBase(base, last, ts);
  entry[baseKey] = clamp01(decayed + ALPHA * signal);
  entry[lastKey] = ts;
}

/**
 * @param {object} entry
 * @returns {{ pL0: number, pT: number, pG: number, pS: number }}
 */
function getBktParams(entry) {
  const custom = entry?.bktParams && typeof entry.bktParams === "object" ? entry.bktParams : {};
  return { ...DEFAULT_BKT_PARAMS, ...custom };
}

/**
 * @param {{ type?: string, rawSignal?: number }} observation
 * @returns {boolean}
 */
function observationIsCorrect(observation) {
  if (!observation || typeof observation !== "object") return false;
  const raw = observation.rawSignal;
  if (raw != null && Number.isFinite(Number(raw))) return Number(raw) > 0;
  const weight = OBSERVATION_WEIGHTS[String(observation.type || "").trim()];
  if (weight != null) return weight > 0;
  return false;
}

/**
 * @param {number} pL
 * @param {boolean} correct
 * @param {{ pT: number, pG: number, pS: number }} params
 * @returns {number}
 */
function bktStep(pL, correct, params) {
  const { pT, pG, pS } = params;
  let pLGivenObs;
  if (correct) {
    const num = pL * (1 - pS);
    const den = num + (1 - pL) * pG;
    pLGivenObs = den > 0 ? num / den : pL;
  } else {
    const num = pL * pS;
    const den = num + (1 - pL) * (1 - pG);
    pLGivenObs = den > 0 ? num / den : pL;
  }
  return clamp01(pLGivenObs + (1 - pLGivenObs) * pT);
}

/**
 * @param {object} entry
 * @param {object[]} [observations]
 * @returns {number}
 */
export function bktMastery(entry, observations) {
  const obs = Array.isArray(observations) ? observations : entry?.observations || [];
  const params = getBktParams(entry);
  let pL = clamp01(params.pL0);
  for (const observation of obs) {
    pL = bktStep(pL, observationIsCorrect(observation), params);
  }
  return pL;
}

/**
 * @param {object} entry
 */
export function maybeEnableBkt(entry) {
  if (!entry || typeof entry !== "object") return;
  if (entry.useBkt === true) return;
  const obs = entry.observations;
  if (!Array.isArray(obs) || obs.length < BKT_OBSERVATION_THRESHOLD) return;
  entry.useBkt = true;
  if (!entry.bktParams || typeof entry.bktParams !== "object") {
    entry.bktParams = { ...DEFAULT_BKT_PARAMS };
  }
}

/**
 * @param {object} entry
 * @param {number} [now]
 * @returns {number}
 */
export function getCurrentMastery(entry, now = Date.now()) {
  if (!entry || typeof entry !== "object") return 0;
  if (entry.useBkt === true) {
    return bktMastery(entry, entry.observations);
  }
  if (hasBothMasteryDimensions(entry)) {
    const declarative = getDimensionMastery(entry, "declarative", now);
    const procedural = getDimensionMastery(entry, "procedural", now);
    return clamp01(DECLARATIVE_WEIGHT * declarative + PROCEDURAL_WEIGHT * procedural);
  }

  const base = Number(entry.masteryBase);
  const last = Number(entry.masteryLastUpdated);
  if (!Number.isFinite(base)) return 0;
  return decayBase(base, last, now);
}

/**
 * @param {object} entry
 * @param {number} [now]
 * @returns {'unknown'|'partial'|'acquired'|'mastered'}
 */
export function getMasteryLabel(entry, now = Date.now()) {
  const m = getCurrentMastery(entry, now);
  let label = "unknown";
  if (m >= 0.8) label = "mastered";
  else if (m >= 0.6) label = "acquired";
  else if (m >= 0.3) label = "partial";
  deLog('[vault.mastery-model.getMasteryLabel]', {
    entryId: entry?.id ?? null,
    mastery: Math.round(m * 1000) / 1000,
    label,
  });
  return label;
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
 * @param {{ type: string, rawSignal?: number, timestamp?: number, docId?: string, taskKind?: string, questionKind?: string }} observation
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
  const taskKind = resolveTaskKind({ ...observation, type });

  if (!Array.isArray(entry.observations)) entry.observations = [];
  const stored = {
    type,
    rawSignal,
    timestamp,
    docId: String(observation.docId || "").trim(),
    taskKind,
  };
  const wrongAnswer = String(observation.wrongAnswer || "").trim();
  if (wrongAnswer) stored.wrongAnswer = wrongAnswer;
  const wrongAnswerPattern = String(observation.wrongAnswerPattern || "").trim();
  if (wrongAnswerPattern) stored.wrongAnswerPattern = wrongAnswerPattern;
  const facet = String(observation.facet || "").trim();
  if (facet) stored.facet = facet;
  entry.observations.push(stored);

  if (facet) {
    if (!entry.facetCoverage || typeof entry.facetCoverage !== "object") {
      entry.facetCoverage = {};
    }
    entry.facetCoverage[facet] = timestamp;
  }

  maybeEnableBkt(entry);

  if (entry.useBkt === true) {
    entry.masteryBase = bktMastery(entry, entry.observations);
    entry.masteryLastUpdated = timestamp;
    return;
  }

  ensureDimensionFields(entry);
  updateMasteryDimension(entry, taskKind, rawSignal, timestamp);

  if (hasBothMasteryDimensions(entry)) {
    entry.masteryBase = getCurrentMastery(entry, timestamp);
    entry.masteryLastUpdated = timestamp;
  } else {
    const last = Number(entry.masteryLastUpdated) || timestamp;
    const decayed = decayBase(Number(entry.masteryBase) || 0, last, timestamp);
    entry.masteryBase = clamp01(decayed + ALPHA * rawSignal);
    entry.masteryLastUpdated = timestamp;
  }
}

/**
 * Mastery 0→1 as red → yellow → green node fill/stroke (vault graph).
 * @param {number} mastery
 */
export function masteryToNodeColors(mastery) {
  const m = Math.max(0, Math.min(1, Number(mastery) || 0));
  let r;
  let g;
  let b;
  if (m <= 0.5) {
    const t = m / 0.5;
    r = Math.round(239 + (251 - 239) * t);
    g = Math.round(68 + (191 - 68) * t);
    b = Math.round(68 + (36 - 68) * t);
  } else {
    const t = (m - 0.5) / 0.5;
    r = Math.round(251 + (34 - 251) * t);
    g = Math.round(191 + (197 - 191) * t);
    b = Math.round(36 + (94 - 36) * t);
  }
  return {
    fill: `rgb(${r},${g},${b})`,
    stroke: `rgb(${Math.round(r * 0.72)},${Math.round(g * 0.72)},${Math.round(b * 0.72)})`,
    text: "#0f172a",
  };
}
