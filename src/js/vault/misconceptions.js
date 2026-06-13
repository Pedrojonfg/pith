/** Misconception detection and resolution for Knowledge Vault entries. */

import { loadVault, saveVault } from "./vault-store.js";

const MS_PER_DAY = 86_400_000;
const WINDOW_DAYS = 30;
const MIN_GROUP_SIZE = 3;
const MIN_CONFIDENCE = 0.6;
const AUTO_RESOLVE_POSITIVE_STREAK = 3;

/** @type {Set<string>} */
export const NEGATIVE_OBS_TYPES = new Set([
  "mcq_wrong",
  "socratic_partial",
  "cloze_wrong",
]);

/** @type {Set<string>} */
export const POSITIVE_OBS_TYPES = new Set([
  "mcq_correct",
  "socratic_passed",
  "cloze_correct",
  "assessment_mastered",
]);

function newMisconceptionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `misc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {{ type?: string }} obs
 * @returns {boolean}
 */
export function isNegativeObservation(obs) {
  return NEGATIVE_OBS_TYPES.has(String(obs?.type || "").trim());
}

/**
 * @param {{ type?: string }} obs
 * @returns {boolean}
 */
export function isPositiveObservation(obs) {
  return POSITIVE_OBS_TYPES.has(String(obs?.type || "").trim());
}

/**
 * Infer declarative vs procedural routing (research R4).
 * @param {string} obsType
 * @param {object | null | undefined} [question]
 * @returns {'declarative' | 'procedural'}
 */
export function inferTaskKind(obsType, question) {
  const type = String(obsType || "").trim().toLowerCase();
  const qType = String(question?.type || "").trim().toLowerCase();
  const tags = [
    question?.subtype,
    question?.kind,
    question?.category,
    question?.stem,
    question?.prompt,
  ]
    .map((v) => String(v || "").toLowerCase())
    .join(" ");

  if (type.startsWith("cloze")) return "declarative";
  if (qType === "socratic" || type.startsWith("socratic")) return "procedural";
  if (
    /application|calculate|calculation|compute|solve|procedure|procedural|implement/.test(tags)
  ) {
    return "procedural";
  }
  return "declarative";
}

/**
 * @param {object} entry
 * @param {number} [now]
 * @returns {Array<{ obs: object, index: number }>}
 */
export function getNegativeObservationsInWindow(entry, now = Date.now()) {
  const cutoff = now - WINDOW_DAYS * MS_PER_DAY;
  const observations = Array.isArray(entry?.observations) ? entry.observations : [];
  const out = [];
  for (let i = 0; i < observations.length; i += 1) {
    const obs = observations[i];
    if (!isNegativeObservation(obs)) continue;
    const ts = Number(obs?.timestamp);
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    out.push({ obs, index: i });
  }
  return out;
}

/**
 * @param {Array<{ obs: object, index: number }>} items
 * @returns {Map<string, Array<{ obs: object, index: number }>>}
 */
export function groupNegativeObservationsByAnswer(items) {
  const groups = new Map();
  for (const item of items) {
    const pattern = String(item.obs?.wrongAnswerPattern || "").trim();
    const answer = String(item.obs?.wrongAnswer || "").trim();
    const key = (pattern || answer).toLowerCase();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

/**
 * @param {object} entry
 * @param {string} patternKey
 * @returns {boolean}
 */
function hasActiveMisconceptionForKey(entry, patternKey) {
  const key = String(patternKey || "").trim().toLowerCase();
  if (!key) return false;
  return (Array.isArray(entry?.misconceptions) ? entry.misconceptions : []).some((m) => {
    if (m?.resolved) return false;
    const desc = String(m?.description || "").toLowerCase();
    return desc.includes(key);
  });
}

/**
 * @param {object} entry
 * @param {Array<{ obs: object }>} group
 * @returns {string}
 */
export function buildRuleBasedMisconceptionDescription(entry, group) {
  const wrong =
    String(group[0]?.obs?.wrongAnswer || group[0]?.obs?.wrongAnswerPattern || "").trim()
    || "incorrect answer";
  const title = String(entry?.canonicalTitle || "this concept").trim();
  return `Confuses "${title}" with repeated answer "${wrong}"`;
}

/**
 * @param {object} entry
 * @param {string} description
 * @param {number} confidence
 * @param {number[]} observationIndices
 * @param {number} [now]
 * @returns {object}
 */
export function appendMisconception(entry, description, confidence, observationIndices, now = Date.now()) {
  const misconception = {
    id: newMisconceptionId(),
    description: String(description || "").trim(),
    confidence: Math.min(1, Math.max(0, Number(confidence) || 0)),
    observationIds: observationIndices.map((i) => String(i)),
    detectedAt: now,
    resolved: false,
  };
  if (!Array.isArray(entry.misconceptions)) entry.misconceptions = [];
  entry.misconceptions.push(misconception);
  return misconception;
}

/**
 * @param {object} entry
 * @param {number} [now]
 * @returns {object | null}
 */
export async function detectMisconceptionsForEntry(entry, options = {}) {
  if (!entry || typeof entry !== "object") return null;
  const now = Number(options.now) || Date.now();
  const negatives = getNegativeObservationsInWindow(entry, now);
  const groups = groupNegativeObservationsByAnswer(negatives);
  if (!groups.size) return null;

  let largest = /** @type {Array<{ obs: object, index: number }>} */ ([]);
  let largestKey = "";
  for (const [key, group] of groups) {
    if (group.length > largest.length) {
      largest = group;
      largestKey = key;
    }
  }
  if (largest.length < MIN_GROUP_SIZE) return null;
  if (hasActiveMisconceptionForKey(entry, largestKey)) return null;

  const obsPayload = largest.map((item) => item.obs);
  let description = buildRuleBasedMisconceptionDescription(entry, largest);
  let confidence = Math.min(0.95, 0.55 + largest.length * 0.05);

  const canUseLlm = Boolean(options.useLlm) && !options.llmUsed;
  if (canUseLlm && typeof options.detectPattern === "function") {
    try {
      const result = await options.detectPattern(entry, obsPayload);
      if (result?.description) description = String(result.description).trim();
      if (Number.isFinite(Number(result?.confidence))) {
        confidence = Number(result.confidence);
      }
      if (typeof options.onLlmUsed === "function") options.onLlmUsed();
    } catch (err) {
      console.warn("[misconceptions] LLM detection failed, using rule-based", err?.message || err);
    }
  }

  if (confidence < MIN_CONFIDENCE) return null;

  return appendMisconception(
    entry,
    description,
    confidence,
    largest.map((item) => item.index),
    now,
  );
}

/**
 * Run detection for touched entries; at most one LLM call per session.
 * @param {object} vault
 * @param {Iterable<string>} entryIds
 * @param {object} [options]
 * @returns {Promise<object[]>}
 */
export async function runMisconceptionDetectionForEntries(vault, entryIds, options = {}) {
  const entries = Array.isArray(vault?.entries) ? vault.entries : [];
  const created = [];
  let llmUsed = false;

  let detectPattern = options.detectPattern;
  if (!detectPattern && options.useLlm !== false) {
    try {
      const api = await import("../api.js");
      if (typeof api.detectMisconceptionPattern === "function") {
        detectPattern = api.detectMisconceptionPattern.bind(api);
      }
    } catch {
      // optional LLM path
    }
  }

  for (const entryId of entryIds) {
    const entry = entries.find((e) => String(e?.id || "") === String(entryId));
    if (!entry) continue;
    tryAutoResolveMisconceptions(entry, options.now);
    const misconception = await detectMisconceptionsForEntry(entry, {
      now: options.now,
      useLlm: !llmUsed,
      llmUsed,
      detectPattern,
      onLlmUsed: () => {
        llmUsed = true;
      },
    });
    if (misconception) created.push(misconception);
  }
  return created;
}

/**
 * @param {object} entry
 * @param {number} [now]
 */
export function tryAutoResolveMisconceptions(entry, now = Date.now()) {
  const misconceptions = Array.isArray(entry?.misconceptions) ? entry.misconceptions : [];
  const observations = Array.isArray(entry?.observations) ? entry.observations : [];
  if (!misconceptions.length || !observations.length) return;

  let streak = 0;
  for (let i = observations.length - 1; i >= 0; i -= 1) {
    const obs = observations[i];
    if (isPositiveObservation(obs)) {
      streak += 1;
    } else if (isNegativeObservation(obs)) {
      break;
    }
  }
  if (streak < AUTO_RESOLVE_POSITIVE_STREAK) return;

  for (const m of misconceptions) {
    if (m?.resolved) continue;
    m.resolved = true;
    m.resolvedAt = now;
  }
}

/**
 * Mark a misconception resolved on an in-memory entry (persist via saveVault).
 * @param {object} entry
 * @param {string} misconceptionId
 * @param {number} [now]
 * @returns {boolean}
 */
export function markMisconceptionResolvedOnEntry(entry, misconceptionId, now = Date.now()) {
  if (!entry || typeof entry !== "object") return false;
  const misc = (Array.isArray(entry.misconceptions) ? entry.misconceptions : []).find(
    (m) => String(m?.id || "") === String(misconceptionId),
  );
  if (!misc || misc.resolved) return false;
  misc.resolved = true;
  misc.resolvedAt = now;
  return true;
}

/**
 * @param {string} entryId
 * @param {string} misconceptionId
 * @returns {boolean}
 */
export function markMisconceptionResolved(entryId, misconceptionId) {
  const id = String(entryId || "").trim();
  const miscId = String(misconceptionId || "").trim();
  if (!id || !miscId) return false;
  const vault = loadVault();
  const entry = vault.entries.find((e) => String(e?.id || "") === id);
  if (!entry) return false;
  const ok = markMisconceptionResolvedOnEntry(entry, miscId);
  if (!ok) return false;
  vault.lastUpdated = Date.now();
  saveVault(vault);
  return true;
}

/**
 * @param {object} entry
 * @returns {object[]}
 */
export function getActiveMisconceptions(entry) {
  return (Array.isArray(entry?.misconceptions) ? entry.misconceptions : []).filter(
    (m) => m && !m.resolved,
  );
}
