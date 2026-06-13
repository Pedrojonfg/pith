/** Cycle-safe prerequisite edges, co-prerequisite pairs, and cross-doc inference. */

export const INFERENCE_MIN_DOCS = 5;
export const INFERENCE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const INFERENCE_HIGH_CONFIDENCE = 0.85;
export const INFERENCE_MEDIUM_CONFIDENCE = 0.6;
export const INFERENCE_MAX_BATCH = 80;

function newPendingId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pending_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {string} topic
 * @param {string} entryTopic
 */
function topicsMatch(topic, entryTopic) {
  const needle = String(topic || "").trim().toLowerCase();
  const hay = String(entryTopic || "").trim().toLowerCase();
  if (!needle || !hay) return false;
  return hay.includes(needle) || needle.includes(hay);
}

/**
 * @param {object} vault
 * @param {string} topic
 * @returns {number}
 */
export function countDocsForTopic(vault, topic) {
  const docIds = new Set();
  for (const entry of vault?.entries || []) {
    if (!topicsMatch(topic, entry?.topic)) continue;
    for (const source of entry?.sources || []) {
      const docId = String(source?.docId || "").trim();
      if (docId) docIds.add(docId);
    }
  }
  return docIds.size;
}

/**
 * @param {object} vault
 * @param {string} topic
 * @returns {object[]}
 */
function getTopicEntries(vault, topic) {
  return (vault?.entries || [])
    .filter((entry) => topicsMatch(topic, entry?.topic))
    .sort((a, b) => (Number(b?.importanceScore) || 0) - (Number(a?.importanceScore) || 0))
    .slice(0, INFERENCE_MAX_BATCH);
}

/**
 * @param {object} vault
 * @param {string} fromId
 * @param {string} toId
 */
function edgeAlreadyExists(vault, fromId, toId) {
  const dependent = findEntry(vault, toId);
  const prereq = findEntry(vault, fromId);
  if (!dependent || !prereq) return false;
  if ((dependent.prerequisites || []).some((pid) => String(pid) === String(fromId))) return true;
  if ((dependent.coPrerequisites || []).some((pid) => String(pid) === String(fromId))) return true;
  if ((prereq.coPrerequisites || []).some((pid) => String(pid) === String(toId))) return true;
  return false;
}

/**
 * @param {object} vault
 * @param {string} topic
 * @param {number} [now]
 */
export function shouldRunInference(vault, topic, now = Date.now()) {
  if (countDocsForTopic(vault, topic) < INFERENCE_MIN_DOCS) return false;
  const key = String(topic || "").trim().toLowerCase();
  if (!key) return false;
  const lastMap = vault?.lastInferenceAt && typeof vault.lastInferenceAt === "object"
    ? vault.lastInferenceAt
    : {};
  const last = Number(lastMap[key] || lastMap[topic] || 0);
  return !last || now - last >= INFERENCE_COOLDOWN_MS;
}

/**
 * @param {object} vault
 * @param {{ fromId: string, toId: string, confidence: number, status: 'applied' | 'queued' }} edge
 */
function queuePendingEdge(vault, edge) {
  if (!Array.isArray(vault.pendingInferredEdges)) vault.pendingInferredEdges = [];
  const fromId = String(edge.fromId || "").trim();
  const toId = String(edge.toId || "").trim();
  if (!fromId || !toId || fromId === toId) return;
  const duplicate = vault.pendingInferredEdges.some(
    (row) => String(row?.fromId) === fromId && String(row?.toId) === toId,
  );
  if (duplicate) return;
  vault.pendingInferredEdges.push({
    id: newPendingId(),
    fromId,
    toId,
    confidence: Number(edge.confidence) || 0,
    topic: String(edge.topic || "").trim() || "general",
    inferredAt: Date.now(),
  });
}

/**
 * @param {object} vault
 * @param {string} pendingId
 * @returns {Promise<boolean>}
 */
export async function acceptPendingInferredEdge(vault, pendingId) {
  const id = String(pendingId || "").trim();
  if (!vault || !id) return false;
  const pending = Array.isArray(vault.pendingInferredEdges) ? vault.pendingInferredEdges : [];
  const idx = pending.findIndex((row) => String(row?.id) === id);
  if (idx < 0) return false;
  const row = pending[idx];
  addPrerequisiteSafe(vault, row.toId, row.fromId);
  const { rebuildDependents, saveVault } = await import("./vault-store.js");
  rebuildDependents(vault.entries);
  recomputeImportanceScores(vault);
  vault.pendingInferredEdges = pending.filter((_, i) => i !== idx);
  vault.lastUpdated = Date.now();
  saveVault(vault);
  return true;
}

/**
 * @param {object} vault
 * @param {string} pendingId
 * @returns {Promise<boolean>}
 */
export async function rejectPendingInferredEdge(vault, pendingId) {
  const id = String(pendingId || "").trim();
  if (!vault || !id) return false;
  const pending = Array.isArray(vault.pendingInferredEdges) ? vault.pendingInferredEdges : [];
  const next = pending.filter((row) => String(row?.id) !== id);
  if (next.length === pending.length) return false;
  vault.pendingInferredEdges = next;
  vault.lastUpdated = Date.now();
  const { saveVault } = await import("./vault-store.js");
  saveVault(vault);
  return true;
}

/**
 * Cross-document prerequisite inference when topic has enough docs.
 * @param {object} vault
 * @param {string} topic
 * @param {{ inferFn?: (payload: { entries: object[], topic: string }) => Promise<Array<{ fromId: string, toId: string, confidence: number }>>, now?: number, persist?: boolean }} [options]
 * @returns {Promise<Array<{ fromId: string, toId: string, confidence: number, status: 'applied' | 'queued' }>>}
 */
export async function maybeInferPrerequisites(vault, topic, options = {}) {
  const topicLabel = String(topic || "").trim();
  if (!vault || !topicLabel) return [];

  const now = Number(options.now) || Date.now();
  if (!shouldRunInference(vault, topicLabel, now)) return [];

  const entries = getTopicEntries(vault, topicLabel);
  if (entries.length < 2) return [];

  let rawEdges = [];
  if (typeof options.inferFn === "function") {
    rawEdges = await options.inferFn({ entries, topic: topicLabel });
  } else {
    try {
      const { inferCrossDocumentPrerequisites } = await import("../api.js");
      rawEdges = await inferCrossDocumentPrerequisites({ entries, topic: topicLabel });
    } catch (err) {
      console.warn("[maybeInferPrerequisites] inference failed", err?.message || err);
      rawEdges = [];
    }
  }

  const validIds = new Set(entries.map((e) => String(e.id)));
  const results = [];

  for (const row of Array.isArray(rawEdges) ? rawEdges : []) {
    const fromId = String(row?.fromId || "").trim();
    const toId = String(row?.toId || "").trim();
    const confidence = Number(row?.confidence);
    if (!fromId || !toId || fromId === toId) continue;
    if (!validIds.has(fromId) || !validIds.has(toId)) continue;
    if (!Number.isFinite(confidence) || confidence < INFERENCE_MEDIUM_CONFIDENCE) continue;
    if (edgeAlreadyExists(vault, fromId, toId)) continue;

    if (confidence >= INFERENCE_HIGH_CONFIDENCE) {
      addPrerequisiteSafe(vault, toId, fromId);
      results.push({ fromId, toId, confidence, status: "applied" });
    } else {
      queuePendingEdge(vault, { fromId, toId, confidence, topic: topicLabel });
      results.push({ fromId, toId, confidence, status: "queued" });
    }
  }

  if (!vault.lastInferenceAt || typeof vault.lastInferenceAt !== "object") {
    vault.lastInferenceAt = {};
  }
  vault.lastInferenceAt[topicLabel.toLowerCase()] = now;
  const { rebuildDependents, saveVault } = await import("./vault-store.js");
  rebuildDependents(vault.entries);
  recomputeImportanceScores(vault);
  vault.lastUpdated = now;

  if (options.persist !== false) saveVault(vault);
  return results;
}

/**
 * @param {object} vault
 * @param {string} id
 * @returns {object | undefined}
 */
function findEntry(vault, id) {
  const needle = String(id || "").trim();
  return vault?.entries?.find((e) => String(e?.id || "") === needle);
}

/**
 * @param {object} vault
 * @param {string} fromId
 * @param {string} targetId
 * @param {Set<string>} [visited]
 * @returns {boolean}
 */
function canReachViaPrerequisites(vault, fromId, targetId, visited = new Set()) {
  const from = String(fromId || "").trim();
  const target = String(targetId || "").trim();
  if (!from || !target) return false;
  if (from === target) return true;
  if (visited.has(from)) return false;
  visited.add(from);
  const entry = findEntry(vault, from);
  if (!entry) return false;
  for (const pid of entry.prerequisites || []) {
    if (canReachViaPrerequisites(vault, pid, target, visited)) return true;
  }
  return false;
}

/**
 * @param {object} a
 * @param {object} b
 * @param {string} idA
 * @param {string} idB
 */
function removeOneWayBetween(a, b, idA, idB) {
  if (Array.isArray(a.prerequisites)) {
    a.prerequisites = a.prerequisites.filter((pid) => String(pid) !== idB);
  }
  if (Array.isArray(b.prerequisites)) {
    b.prerequisites = b.prerequisites.filter((pid) => String(pid) !== idA);
  }
}

/**
 * @param {object} vault
 * @param {string} idA
 * @param {string} idB
 */
function addCoPrerequisitePair(vault, idA, idB) {
  const a = findEntry(vault, idA);
  const b = findEntry(vault, idB);
  if (!a || !b) return;

  removeOneWayBetween(a, b, String(idA), String(idB));

  if (!Array.isArray(a.coPrerequisites)) a.coPrerequisites = [];
  if (!Array.isArray(b.coPrerequisites)) b.coPrerequisites = [];
  const aS = String(idA);
  const bS = String(idB);
  if (!a.coPrerequisites.some((pid) => String(pid) === bS)) a.coPrerequisites.push(bS);
  if (!b.coPrerequisites.some((pid) => String(pid) === aS)) b.coPrerequisites.push(aS);
}

/**
 * Add a one-way prerequisite or convert to co-prerequisite when a cycle would form.
 * @param {object} vault
 * @param {string} entryId dependent entry
 * @param {string} prereqId prerequisite entry
 * @returns {{ type: 'one_way' | 'co_prerequisite' }}
 */
export function addPrerequisiteSafe(vault, entryId, prereqId) {
  const depId = String(entryId || "").trim();
  const preId = String(prereqId || "").trim();
  if (!vault || !depId || !preId || depId === preId) {
    return { type: "one_way" };
  }

  const dependent = findEntry(vault, depId);
  const prereq = findEntry(vault, preId);
  if (!dependent || !prereq) return { type: "one_way" };

  const depCo = (dependent.coPrerequisites || []).map(String);
  const preCo = (prereq.coPrerequisites || []).map(String);
  if (depCo.includes(preId) || preCo.includes(depId)) {
    return { type: "co_prerequisite" };
  }

  if (!Array.isArray(dependent.prerequisites)) dependent.prerequisites = [];
  if (dependent.prerequisites.some((pid) => String(pid) === preId)) {
    return { type: "one_way" };
  }

  const directReverse = (prereq.prerequisites || []).some((pid) => String(pid) === depId);
  const cycle = directReverse || canReachViaPrerequisites(vault, preId, depId);

  if (cycle) {
    addCoPrerequisitePair(vault, depId, preId);
    return { type: "co_prerequisite" };
  }

  dependent.prerequisites.push(preId);
  return { type: "one_way" };
}

/**
 * Topological importance: direct dependents + half-weight co-prerequisite partners.
 * @param {object} entry
 * @param {object} vault
 * @returns {number}
 */
export function computeImportanceScore(entry, vault) {
  if (!entry || typeof entry !== "object") return 0;
  const stored = findEntry(vault, entry.id) || entry;
  const dependents = Array.isArray(stored.dependents) ? stored.dependents : [];
  const coPrerequisites = Array.isArray(stored.coPrerequisites) ? stored.coPrerequisites : [];
  return dependents.length + 0.5 * coPrerequisites.length;
}

/**
 * @param {object} vault
 * @returns {object}
 */
export function recomputeImportanceScores(vault) {
  if (!vault?.entries) return vault;
  for (const entry of vault.entries) {
    entry.importanceScore = computeImportanceScore(entry, vault);
  }
  return vault;
}
