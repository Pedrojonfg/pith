/** Decay calibration instrumentation — FIFO log, no formula changes. */

export const DECAY_CALIBRATION_KEY = "mylearning_decay_calibration_log";
const MAX_ENTRIES = 1000;

/**
 * @param {object} entry
 */
export function appendDecayCalibrationLog(entry) {
  if (!entry || typeof entry !== "object") return;
  const row = {
    vaultEntryId: String(entry.vaultEntryId || "").trim(),
    facet: entry.facet ? String(entry.facet).trim() : undefined,
    daysSinceLastUpdate: Number(entry.daysSinceLastUpdate) || 0,
    predictedMastery: Number(entry.predictedMastery) || 0,
    observedSignal: Number(entry.observedSignal) || 0,
    timestamp: Number(entry.timestamp) || Date.now(),
  };
  if (!row.vaultEntryId) return;
  try {
    const raw = localStorage.getItem(DECAY_CALIBRATION_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(list) ? list : [];
    arr.push(row);
    while (arr.length > MAX_ENTRIES) arr.shift();
    localStorage.setItem(DECAY_CALIBRATION_KEY, JSON.stringify(arr));
  } catch {
    // ignore quota / parse errors
  }
}

/**
 * @returns {object[]}
 */
export function loadDecayCalibrationLog() {
  try {
    const raw = localStorage.getItem(DECAY_CALIBRATION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
