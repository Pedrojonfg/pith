/** Vault context builders for LLM pack and block generation prompts. */

import { getCurrentMastery, getMasteryLabel } from "./mastery-model.js";
import { getEntriesByTopic } from "./vault-store.js";

/**
 * @param {string[]} docTopics
 * @returns {object[]}
 */
export function getVaultContextForDoc(docTopics) {
  return getEntriesByTopic(docTopics);
}

/**
 * @param {object[]} vaultEntries
 * @returns {string}
 */
export function buildVaultContextBlock(vaultEntries) {
  const entries = Array.isArray(vaultEntries) ? vaultEntries : [];
  if (!entries.length) return "";

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

  if (!mastered.length && !partial.length && !unstable.length) return "";

  const lines = [
    "GLOBAL KNOWLEDGE CONTEXT (from user's cross-document study history):",
    `Mastered concepts (skip or compress): ${mastered.length ? mastered.join(", ") : "none"}`,
    `Partial concepts (brief review recommended): ${partial.length ? partial.join(", ") : "none"}`,
    `Unstable prerequisites (reinforce before dependents): ${unstable.length ? unstable.join(", ") : "none"}`,
  ];
  return `\n\n${lines.join("\n")}`;
}

/**
 * @param {string[]} blockConceptIds
 * @param {object[]} vaultEntries
 * @returns {string}
 */
export function buildBlockVaultHint(blockConceptIds, vaultEntries) {
  const ids = (Array.isArray(blockConceptIds) ? blockConceptIds : [])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  if (!ids.length) return "";

  const entries = Array.isArray(vaultEntries) ? vaultEntries : [];
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

  if (!parts.length) return "";
  return `\n\nUser's mastery on concepts in this block: ${parts.join(", ")}\nCalibrate depth accordingly.`;
}

/**
 * Find vault entry for a document concept id.
 * @param {string} conceptId
 * @param {object[]} vaultEntries
 * @returns {object | null}
 */
export function findVaultEntryForConceptId(conceptId, vaultEntries) {
  const id = String(conceptId || "").trim();
  if (!id) return null;
  const entries = Array.isArray(vaultEntries) ? vaultEntries : [];
  return (
    entries.find((e) =>
      Array.isArray(e?.sources) && e.sources.some((s) => String(s?.conceptId || "") === id),
    ) || null
  );
}
