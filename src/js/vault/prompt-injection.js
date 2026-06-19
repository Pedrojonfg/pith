/** Vault context builders for LLM pack and block generation prompts. */

import { getAncestorChain } from "../project-store.js";
import { getAllSessions, getProjectStore } from "../session-store.js";
import { MISC_PROJECT_ID } from "../session-types.js";
import { getCurrentMastery, getMasteryLabel } from "./mastery-model.js";
import { getActiveMisconceptions } from "./misconceptions.js";
import { getEntriesByTopic } from "./vault-store.js";

/**
 * @typedef {{ entry: object, scopeDepth: number }} VaultContextScoredEntry
 */

/**
 * @param {object} entry
 * @param {string[]} ancestorIds
 * @param {Map<string, string>} docIdToProjectId
 * @returns {number}
 */
export function getProjectScopeDepth(entry, ancestorIds, docIdToProjectId) {
  const sources = Array.isArray(entry?.sources) ? entry.sources : [];
  let minDepth = Infinity;
  for (const src of sources) {
    const docId = String(src?.docId || "").trim();
    if (!docId) continue;
    const projectId = docIdToProjectId.get(docId);
    if (!projectId) continue;
    const depth = ancestorIds.indexOf(projectId);
    if (depth >= 0 && depth < minDepth) minDepth = depth;
  }
  return minDepth;
}

async function buildDocIdToProjectIdMap() {
  /** @type {Map<string, string>} */
  const map = new Map();
  const sessions = await getAllSessions();
  for (const session of sessions) {
    if (!session?.docId) continue;
    map.set(session.docId, String(session.projectId || MISC_PROJECT_ID));
  }
  return map;
}

/**
 * @param {object} session Must provide projectId and shared.docTopics
 * @returns {VaultContextScoredEntry[]}
 */
export function getVaultContextForDoc(session) {
  const docTopics = Array.isArray(session?.shared?.docTopics)
    ? session.shared.docTopics
    : Array.isArray(session)
      ? session
      : [];
  const projectId = String(session?.projectId || MISC_PROJECT_ID);
  const store = getProjectStore();
  const ancestorIds = getAncestorChain(store, projectId).map((p) => p.id);
  const docIdToProjectId = buildDocIdToProjectIdMap();
  const topicEntries = getEntriesByTopic(docTopics);
  const scored = topicEntries.map((entry) => ({
    entry,
    scopeDepth: getProjectScopeDepth(entry, ancestorIds, docIdToProjectId),
  }));
  scored.sort((a, b) => a.scopeDepth - b.scopeDepth);
  return scored;
}

/**
 * @param {VaultContextScoredEntry[]|object[]} scoredOrEntries
 * @returns {object[]}
 */
function entriesFromScored(scoredOrEntries) {
  return (Array.isArray(scoredOrEntries) ? scoredOrEntries : []).map((item) =>
    item?.entry ? item.entry : item,
  );
}

/**
 * @param {object[]} vaultEntries
 * @returns {string[]}
 */
export function buildMisconceptionPromptLines(vaultEntries) {
  const entries = entriesFromScored(vaultEntries);
  const lines = [];
  for (const entry of entries) {
    const title = String(entry?.canonicalTitle || "").trim();
    if (!title) continue;
    for (const misconception of getActiveMisconceptions(entry)) {
      const description = String(misconception?.description || "").trim();
      if (!description) continue;
      lines.push(
        `Known misconception for "${title}": ${description}. Design explanation to contrast correct vs incorrect understanding.`,
      );
    }
  }
  return lines;
}

function classifyBandEntries(entries) {
  const mastered = [];
  const partial = [];
  const unstable = [];
  for (const entry of entries) {
    const title = String(entry?.canonicalTitle || "").trim();
    if (!title) continue;
    const m = getCurrentMastery(entry);
    if (m >= 0.7) mastered.push(title);
    else if (m >= 0.3) partial.push(title);
    const dependents = Array.isArray(entry.dependents) ? entry.dependents : [];
    if (dependents.length > 0 && m < 0.5) unstable.push(title);
  }
  return { mastered, partial, unstable };
}

function formatBandSection(title, entries) {
  if (!entries.length) return [];
  const { mastered, partial, unstable } = classifyBandEntries(entries);
  return [
    `${title}:`,
    `  Mastered concepts (skip or compress): ${mastered.length ? mastered.join(", ") : "none"}`,
    `  Partial concepts (brief review recommended): ${partial.length ? partial.join(", ") : "none"}`,
    `  Unstable prerequisites (reinforce before dependents): ${unstable.length ? unstable.join(", ") : "none"}`,
  ];
}

/**
 * @param {VaultContextScoredEntry[]|object[]} scoredEntries
 * @returns {string}
 */
export function buildVaultContextBlock(scoredEntries) {
  const scored = (Array.isArray(scoredEntries) ? scoredEntries : []).map((item) =>
    item?.entry
      ? item
      : { entry: item, scopeDepth: Infinity },
  );
  if (!scored.length) return "";

  const sameSubject = [];
  const relatedSubject = [];
  const general = [];
  for (const { entry, scopeDepth } of scored) {
    if (scopeDepth === 0) sameSubject.push(entry);
    else if (scopeDepth < Infinity) relatedSubject.push(entry);
    else general.push(entry);
  }

  const misconceptionLines = buildMisconceptionPromptLines(scored.map((s) => s.entry));
  const bandLines = [
    ...formatBandSection(
      "Same-subject mastery (calibrate depth on these first)",
      sameSubject,
    ),
    ...formatBandSection(
      "Related-subject mastery (background, lower priority)",
      relatedSubject,
    ),
    ...formatBandSection(
      "General mastery (other subjects, awareness only)",
      general,
    ),
    ...misconceptionLines,
  ].filter(Boolean);

  if (!bandLines.length) return "";

  return `\n\nGLOBAL KNOWLEDGE CONTEXT (from user's cross-document study history):\n${bandLines.join("\n")}`;
}

/**
 * @param {string[]} blockConceptIds
 * @param {VaultContextScoredEntry[]|object[]} vaultEntries
 * @returns {string}
 */
export function buildBlockVaultHint(blockConceptIds, vaultEntries) {
  const ids = (Array.isArray(blockConceptIds) ? blockConceptIds : [])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  if (!ids.length) return "";

  const entries = entriesFromScored(vaultEntries);
  const parts = [];

  for (const conceptId of ids) {
    const entry = entries.find((e) =>
      Array.isArray(e?.sources) &&
      e.sources.some((s) => String(s?.conceptId || "") === conceptId),
    );
    if (!entry) continue;
    const label = getMasteryLabel(entry);
    parts.push(`${entry.canonicalTitle} (${label})`);
  }

  const misconceptionLines = [];
  const seenEntryIds = new Set();
  for (const conceptId of ids) {
    const entry = entries.find((e) =>
      Array.isArray(e?.sources) &&
      e.sources.some((s) => String(s?.conceptId || "") === conceptId),
    );
    if (!entry || seenEntryIds.has(entry.id)) continue;
    seenEntryIds.add(entry.id);
    const title = String(entry.canonicalTitle || "").trim();
    if (!title) continue;
    for (const misconception of getActiveMisconceptions(entry)) {
      const description = String(misconception?.description || "").trim();
      if (!description) continue;
      misconceptionLines.push(
        `Known misconception for "${title}": ${description}. Design explanation to contrast correct vs incorrect understanding.`,
      );
    }
  }

  if (!parts.length && !misconceptionLines.length) return "";

  const lines = [];
  if (parts.length) {
    lines.push(`User's mastery on concepts in this block: ${parts.join(", ")}`);
    lines.push("Calibrate depth accordingly.");
  }
  lines.push(...misconceptionLines);
  return `\n\n${lines.join("\n")}`;
}

/**
 * Find vault entry for a document concept id.
 * @param {string} conceptId
 * @param {VaultContextScoredEntry[]|object[]} vaultEntries
 * @returns {object | null}
 */
export function findVaultEntryForConceptId(conceptId, vaultEntries) {
  const id = String(conceptId || "").trim();
  if (!id) return null;
  const entries = entriesFromScored(vaultEntries);
  return (
    entries.find((e) =>
      Array.isArray(e?.sources) && e.sources.some((s) => String(s?.conceptId || "") === id),
    ) || null
  );
}
