/** External knowledge import into the vault (document path). */

import { extractConceptsFromImportText, normalizeConceptsToVault } from "../api.js";
import { buildDocumentHierarchy } from "../normalization/hierarchy.js";
import { runConceptInventory } from "../session.js";
import { computeDocId } from "../session-store.js";
import { buildAllNewMappings, mergeNormalizationResult } from "./normalization.js";
import { filterNewConcepts } from "./session-close.js";
import {
  appendImportRecord,
  getEntriesByTopic,
  loadVault,
  newVaultId,
  rebuildDependents,
  saveVault,
} from "./vault-store.js";

export const DOCUMENT_IMPORT_DEFAULT_MASTERY = 0.8;
export const DEFAULT_TEXT_IMPORT_MASTERY = 0.7;
export const DEFAULT_STRUCT_IMPORT_MASTERY = 0.7;

/**
 * @param {File | { name?: string, text?: () => Promise<string>, content?: string }} file
 */
async function readImportFileContent(file) {
  if (typeof file === "string") return file;
  if (file && typeof file.content === "string") return file.content;
  if (file && typeof file.text === "function") return file.text();
  throw new Error("Invalid file input.");
}

/**
 * Parse CSV text into row objects (header: canonicalTitle, topic, mastery, prerequisites).
 * @param {string} text
 * @returns {{ rows: object[], errors: string[] }}
 */
export function parseCsvText(text) {
  const raw = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!raw) return { rows: [], errors: ["CSV is empty."] };

  /** @type {string[][]} */
  const lines = [];
  /** @type {string[]} */
  let current = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      current.push(field);
      field = "";
    } else if (ch === "\r") {
      // skip
    } else if (ch === "\n") {
      current.push(field);
      lines.push(current);
      current = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length || current.length) {
    current.push(field);
    lines.push(current);
  }

  const nonEmpty = lines.filter((line) => line.some((cell) => String(cell || "").trim()));
  if (!nonEmpty.length) return { rows: [], errors: ["CSV is empty."] };

  const headerCells = nonEmpty[0].map((h) => String(h || "").trim().toLowerCase());
  const idx = {
    title: headerCells.indexOf("canonicaltitle"),
    topic: headerCells.indexOf("topic"),
    mastery: headerCells.indexOf("mastery"),
    prerequisites: headerCells.indexOf("prerequisites"),
  };
  if (idx.title < 0 || idx.topic < 0) {
    return {
      rows: [],
      errors: ["CSV header must include canonicalTitle and topic columns."],
    };
  }

  /** @type {object[]} */
  const rows = [];
  const errors = [];
  for (let r = 1; r < nonEmpty.length; r += 1) {
    const line = nonEmpty[r];
    rows.push({
      canonicalTitle: idx.title >= 0 ? line[idx.title] : "",
      topic: idx.topic >= 0 ? line[idx.topic] : "",
      mastery: idx.mastery >= 0 ? line[idx.mastery] : "",
      prerequisites: idx.prerequisites >= 0 ? line[idx.prerequisites] : "",
      _rowLabel: `Row ${r + 1}`,
    });
  }
  return { rows, errors };
}

/**
 * @param {string} text
 * @returns {{ rows: object[], errors: string[] }}
 */
export function parseJsonImportText(text) {
  const raw = String(text || "").trim();
  if (!raw) return { rows: [], errors: ["JSON is empty."] };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { rows: [], errors: [`Invalid JSON: ${err?.message || String(err)}`] };
  }

  const list = Array.isArray(parsed?.entries)
    ? parsed.entries
    : Array.isArray(parsed)
      ? parsed
      : null;
  if (!list) {
    return { rows: [], errors: ['JSON must contain an "entries" array.'] };
  }

  const rows = list.map((entry, i) => ({
    canonicalTitle: entry?.canonicalTitle ?? entry?.title ?? "",
    topic: entry?.topic ?? "",
    mastery: entry?.masteryBase ?? entry?.mastery ?? "",
    prerequisites: entry?.prerequisites ?? [],
    _rowLabel: `Entry ${i + 1}`,
  }));
  return { rows, errors: [] };
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
function normalizePrerequisiteLabels(raw) {
  if (Array.isArray(raw)) {
    return raw.map((p) => String(p || "").trim()).filter(Boolean);
  }
  const text = String(raw || "").trim();
  if (!text) return [];
  return text.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
}

/**
 * @param {object} vault
 * @param {string} label
 * @param {string} topic
 */
function resolvePrerequisiteId(vault, label, topic) {
  const needle = String(label || "").trim();
  if (!needle) return null;
  const byId = vault.entries.find((e) => String(e?.id || "") === needle);
  if (byId) return byId.id;
  const titleNeedle = needle.toLowerCase();
  const topicNeedle = String(topic || "").trim().toLowerCase();
  const byTitle = vault.entries.find((e) => {
    const t = String(e?.canonicalTitle || "").trim().toLowerCase();
    const tp = String(e?.topic || "").trim().toLowerCase();
    return t === titleNeedle && (!topicNeedle || tp === topicNeedle);
  });
  if (byTitle) return byTitle.id;
  return vault.entries.find((e) => String(e?.canonicalTitle || "").trim().toLowerCase() === titleNeedle)?.id || null;
}

/**
 * @param {object} vault
 * @param {string} title
 * @param {string} topic
 */
function findEntryByTitleTopic(vault, title, topic) {
  const titleNeedle = String(title || "").trim().toLowerCase();
  const topicNeedle = String(topic || "").trim().toLowerCase();
  if (!titleNeedle || !topicNeedle) return null;
  return (
    vault.entries.find(
      (e) =>
        String(e?.canonicalTitle || "").trim().toLowerCase() === titleNeedle &&
        String(e?.topic || "").trim().toLowerCase() === topicNeedle,
    ) || null
  );
}

/**
 * @param {object} vault
 * @param {object} row
 * @param {string} rowLabel
 * @param {string[]} errors
 * @returns {"added" | "merged" | null}
 */
function upsertStructuredRow(vault, row, rowLabel, errors) {
  const title = String(row?.canonicalTitle || "").trim();
  const topic = String(row?.topic || "").trim();
  if (!title) {
    errors.push(`${rowLabel}: canonicalTitle is required`);
    return null;
  }
  if (!topic) {
    errors.push(`${rowLabel}: topic is required`);
    return null;
  }

  let masteryRaw = row?.mastery ?? row?.masteryBase;
  if (masteryRaw === "" || masteryRaw == null) masteryRaw = DEFAULT_STRUCT_IMPORT_MASTERY;
  const mastery = Number(masteryRaw);
  if (!Number.isFinite(mastery) || mastery < 0 || mastery > 1) {
    errors.push(`${rowLabel}: mastery must be between 0 and 1`);
    return null;
  }

  const now = Date.now();
  let entry = findEntryByTitleTopic(vault, title, topic);
  let action = /** @type {"added" | "merged"} */ ("added");

  if (entry) {
    action = "merged";
    const base = Number(entry.masteryBase) || 0;
    const next = Math.max(base, mastery);
    entry.masteryBase = next;
    entry.masteryDeclarativeBase = Math.max(Number(entry.masteryDeclarativeBase) || base, next);
    entry.masteryProceduralBase = Math.max(Number(entry.masteryProceduralBase) || base, next);
    entry.masteryLastUpdated = now;
    entry.masteryDeclarativeLastUpdated = now;
    entry.masteryProceduralLastUpdated = now;
    entry.lastSeen = now;
  } else {
    entry = {
      id: newVaultId(),
      canonicalTitle: title,
      aliases: [],
      topic,
      masteryBase: mastery,
      masteryDeclarativeBase: mastery,
      masteryProceduralBase: mastery,
      masteryLastUpdated: now,
      masteryDeclarativeLastUpdated: now,
      masteryProceduralLastUpdated: now,
      lastSeen: now,
      sources: [],
      prerequisites: [],
      dependents: [],
      observations: [],
      misconceptions: [],
      coPrerequisites: [],
      manualOrigin: false,
    };
    vault.entries.push(entry);
  }

  const prereqLabels = normalizePrerequisiteLabels(row?.prerequisites);
  if (prereqLabels.length) {
    const prereqSet = new Set((entry.prerequisites || []).map(String));
    for (const label of prereqLabels) {
      const resolved = resolvePrerequisiteId(vault, label, topic);
      if (resolved && resolved !== entry.id) {
        prereqSet.add(String(resolved));
      } else if (label) {
        errors.push(`${rowLabel}: prerequisite "${label}" not found (skipped)`);
      }
    }
    entry.prerequisites = [...prereqSet];
  }

  return action;
}

/**
 * @param {object[]} rows
 * @param {{ parseErrors?: string[], fileName?: string, importType?: string }} [options]
 * @returns {{ added: number, merged: number, errors: string[] }}
 */
export function importStructuredRows(rows, options = {}) {
  const errors = [...(options.parseErrors || [])];
  if (!Array.isArray(rows) || !rows.length) {
    if (!errors.length) errors.push("No import rows found.");
    return { added: 0, merged: 0, errors };
  }

  const vault = loadVault();
  let added = 0;
  let merged = 0;

  for (const row of rows) {
    const rowLabel = String(row?._rowLabel || "Row").trim() || "Row";
    const outcome = upsertStructuredRow(vault, row, rowLabel, errors);
    if (outcome === "added") added += 1;
    else if (outcome === "merged") merged += 1;
  }

  if (added > 0 || merged > 0) {
    rebuildDependents(vault.entries);
    vault.lastUpdated = Date.now();
    saveVault(vault);
  }

  return { added, merged, errors };
}

/**
 * @param {File | { name?: string, text?: () => Promise<string>, content?: string }} file
 * @returns {Promise<{ added: number, merged: number, errors: string[] }>}
 */
export async function importFromCsv(file) {
  const startedAt = Date.now();
  let result = { added: 0, merged: 0, errors: [] };
  try {
    const content = await readImportFileContent(file);
    const parsed = parseCsvText(content);
    result = importStructuredRows(parsed.rows, { parseErrors: parsed.errors });
  } catch (err) {
    result.errors.push(String(err?.message || err || "CSV import failed."));
  }

  appendImportRecord({
    id: newVaultId(),
    type: "csv",
    startedAt,
    completedAt: Date.now(),
    conceptsAdded: result.added,
    conceptsMerged: result.merged,
    errors: [...result.errors],
    fileName: String(file?.name || "").trim() || undefined,
  });

  return result;
}

/**
 * @param {File | { name?: string, text?: () => Promise<string>, content?: string }} file
 * @returns {Promise<{ added: number, merged: number, errors: string[] }>}
 */
export async function importFromJson(file) {
  const startedAt = Date.now();
  let result = { added: 0, merged: 0, errors: [] };
  try {
    const content = await readImportFileContent(file);
    const parsed = parseJsonImportText(content);
    result = importStructuredRows(parsed.rows, { parseErrors: parsed.errors });
  } catch (err) {
    result.errors.push(String(err?.message || err || "JSON import failed."));
  }

  appendImportRecord({
    id: newVaultId(),
    type: "json",
    startedAt,
    completedAt: Date.now(),
    conceptsAdded: result.added,
    conceptsMerged: result.merged,
    errors: [...result.errors],
    fileName: String(file?.name || "").trim() || undefined,
  });

  return result;
}

/**
 * @param {object} vault
 * @param {Record<string, string>} normalizationMap
 * @param {number} defaultMastery
 */
export function applyImportDefaultMastery(vault, normalizationMap, defaultMastery) {
  const mastery = Number(defaultMastery);
  if (!Number.isFinite(mastery) || mastery <= 0) return;
  const now = Date.now();
  const seen = new Set();
  for (const vaultId of Object.values(normalizationMap || {})) {
    const id = String(vaultId || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const entry = vault.entries.find((e) => String(e?.id || "") === id);
    if (!entry) continue;
    const base = Number(entry.masteryBase) || 0;
    const next = Math.max(base, mastery);
    entry.masteryBase = next;
    entry.masteryDeclarativeBase = Math.max(Number(entry.masteryDeclarativeBase) || base, next);
    entry.masteryProceduralBase = Math.max(Number(entry.masteryProceduralBase) || base, next);
    entry.masteryLastUpdated = now;
    entry.masteryDeclarativeLastUpdated = now;
    entry.masteryProceduralLastUpdated = now;
    entry.lastSeen = now;
  }
}

/**
 * Apply text-import normalization mappings to an in-memory vault.
 * @param {object} vault
 * @param {Array<{ conceptId: string, action: string, vaultEntryId?: string | null }>} mappings
 * @param {Map<string, { id?: string, title?: string, label?: string, topic?: string }>} conceptsById
 * @param {number} defaultMastery
 */
export function applyImportMappings(vault, mappings, conceptsById, defaultMastery) {
  const mastery = Number.isFinite(Number(defaultMastery))
    ? Number(defaultMastery)
    : DEFAULT_TEXT_IMPORT_MASTERY;
  const now = Date.now();

  for (const row of Array.isArray(mappings) ? mappings : []) {
    const conceptId = String(row?.conceptId || "").trim();
    if (!conceptId) continue;
    const concept = conceptsById.get(conceptId);
    const title = String(concept?.title || concept?.label || conceptId).trim();
    const topic = String(concept?.topic || "general").trim() || "general";
    const action = String(row?.action || "new").trim().toLowerCase();
    const targetId = String(row?.vaultEntryId || "").trim();

    if ((action === "merge" || action === "alias") && targetId) {
      const entry = vault.entries.find((e) => String(e?.id || "") === targetId);
      if (entry) {
        if (action === "alias" && title && !(entry.aliases || []).includes(title)) {
          if (!Array.isArray(entry.aliases)) entry.aliases = [];
          entry.aliases.push(title);
        }
        const base = Number(entry.masteryBase) || 0;
        const next = Math.max(base, mastery);
        entry.masteryBase = next;
        entry.masteryDeclarativeBase = Math.max(Number(entry.masteryDeclarativeBase) || base, next);
        entry.masteryProceduralBase = Math.max(Number(entry.masteryProceduralBase) || base, next);
        entry.masteryLastUpdated = now;
        entry.masteryDeclarativeLastUpdated = now;
        entry.masteryProceduralLastUpdated = now;
        entry.lastSeen = now;
        continue;
      }
    }

    vault.entries.push({
      id: newVaultId(),
      canonicalTitle: title || conceptId,
      aliases: [],
      topic,
      masteryBase: mastery,
      masteryDeclarativeBase: mastery,
      masteryProceduralBase: mastery,
      masteryLastUpdated: now,
      masteryDeclarativeLastUpdated: now,
      masteryProceduralLastUpdated: now,
      lastSeen: now,
      sources: [],
      prerequisites: [],
      dependents: [],
      observations: [],
      misconceptions: [],
      coPrerequisites: [],
      manualOrigin: false,
    });
  }
}

/**
 * @param {string} text
 * @param {{ defaultMastery?: number, extractFn?: Function, normalizeFn?: Function, llmModel?: string }} [options]
 * @returns {Promise<{ added: number, merged: number, errors: string[] }>}
 */
export async function importFromText(text, options = {}) {
  const startedAt = Date.now();
  const errors = [];
  const raw = String(text || "").trim();
  const defaultMastery = Number.isFinite(Number(options.defaultMastery))
    ? Number(options.defaultMastery)
    : DEFAULT_TEXT_IMPORT_MASTERY;

  if (!raw) {
    return { added: 0, merged: 0, errors: ["Text is empty."] };
  }

  const extractFn =
    typeof options.extractFn === "function"
      ? options.extractFn
      : (value) => extractConceptsFromImportText(value, options);

  let extracted = [];
  try {
    extracted = await extractFn(raw);
  } catch (err) {
    const message = String(err?.message || err || "Concept extraction failed.");
    const result = { added: 0, merged: 0, errors: [message] };
    appendImportRecord({
      id: newVaultId(),
      type: "text",
      startedAt,
      completedAt: Date.now(),
      conceptsAdded: 0,
      conceptsMerged: 0,
      errors: [...result.errors],
    });
    return result;
  }

  if (!Array.isArray(extracted) || !extracted.length) {
    const result = { added: 0, merged: 0, errors: ["No concepts extracted from text."] };
    appendImportRecord({
      id: newVaultId(),
      type: "text",
      startedAt,
      completedAt: Date.now(),
      conceptsAdded: 0,
      conceptsMerged: 0,
      errors: [...result.errors],
    });
    return result;
  }

  const conceptRows = extracted.map((c, index) => {
    const title = String(c?.title || c?.canonicalTitle || "").trim();
    const topic = String(c?.topic || "general").trim() || "general";
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40) || "concept";
    return {
      id: `import_text_${index}_${slug}`,
      title,
      label: title,
      topic,
    };
  }).filter((c) => c.title);

  const topics = [...new Set(conceptRows.map((c) => c.topic))];
  const existingEntries = getEntriesByTopic(topics).map((e) => ({
    id: e.id,
    canonicalTitle: e.canonicalTitle,
    aliases: e.aliases || [],
  }));

  const normalizeFn =
    typeof options.normalizeFn === "function"
      ? options.normalizeFn
      : (params) =>
          normalizeConceptsToVault({
            existingEntries: params?.existingEntries ?? existingEntries,
            newConcepts: params?.newConcepts ?? conceptRows.map((c) => ({
              id: c.id,
              title: c.title,
              type: "CONCEPT",
            })),
            topic: params?.topic ?? topics[0] ?? "general",
          });

  let mappings = [];
  try {
    mappings = await normalizeFn({
      existingEntries,
      newConcepts: conceptRows.map((c) => ({ id: c.id, title: c.title, type: "CONCEPT" })),
      topic: topics[0] || "general",
    });
  } catch (err) {
    errors.push(String(err?.message || err || "Normalization failed."));
    mappings = conceptRows.map((c) => ({
      conceptId: c.id,
      action: "new",
      vaultEntryId: null,
    }));
  }

  const vault = loadVault();
  const conceptsById = new Map(conceptRows.map((c) => [c.id, c]));
  applyImportMappings(vault, mappings, conceptsById, defaultMastery);
  const { added, merged } = countImportResults(mappings);
  vault.lastUpdated = Date.now();
  saveVault(vault);

  appendImportRecord({
    id: newVaultId(),
    type: "text",
    startedAt,
    completedAt: Date.now(),
    conceptsAdded: added,
    conceptsMerged: merged,
    errors: [...errors],
  });

  return { added, merged, errors };
}

/**
 * @param {Array<{ conceptId: string, action: string }>} mappings
 */
function countImportResults(mappings) {
  let added = 0;
  let merged = 0;
  for (const row of Array.isArray(mappings) ? mappings : []) {
    const action = String(row?.action || "new").toLowerCase();
    if (action === "merge" || action === "alias") merged += 1;
    else added += 1;
  }
  return { added, merged };
}

function inventoryToNewConcepts(inventory) {
  return (Array.isArray(inventory) ? inventory : [])
    .map((c) => {
      const id = String(c?.id || c?.canonicalId || "").trim();
      if (!id) return null;
      return {
        id,
        title: String(c?.title || c?.label || id).trim(),
        label: String(c?.title || c?.label || id).trim(),
        type: c?.type || "CONCEPT",
      };
    })
    .filter(Boolean);
}

/**
 * Import concepts from a normalized document into the vault without creating a study session.
 * @param {File | { name?: string }} file
 * @param {{
 *   cleanedText: string,
 *   wordCount?: number,
 *   originalFormat?: string,
 *   normalizedFormat?: string,
 *   warnings?: string[],
 *   fallbackSections?: object | null,
 * }} normalizedDoc
 * @param {{ llmModel?: string, language?: string, onProgress?: (msg: string) => void, defaultMastery?: number }} [options]
 * @returns {Promise<{ added: number, merged: number, errors: string[] }>}
 */
export async function importFromDocument(file, normalizedDoc, options = {}) {
  const startedAt = Date.now();
  const errors = [];
  const defaultMastery = Number.isFinite(Number(options.defaultMastery))
    ? Number(options.defaultMastery)
    : DOCUMENT_IMPORT_DEFAULT_MASTERY;

  const cleanedText = String(normalizedDoc?.cleanedText || "").trim();
  if (!cleanedText) {
    return { added: 0, merged: 0, errors: ["Document appears to be empty."] };
  }

  let docTopics = ["general"];
  try {
    const hierarchy = await buildDocumentHierarchy(cleanedText, null, { useCache: true });
    if (Array.isArray(hierarchy?.topics) && hierarchy.topics.length) {
      docTopics = hierarchy.topics.map((t) => String(t || "").trim()).filter(Boolean);
    }
  } catch (err) {
    errors.push(`Topic detection skipped: ${err?.message || String(err)}`);
  }
  if (!docTopics.length) docTopics = ["general"];

  let inventory = [];
  try {
    options.onProgress?.("Indexing concepts…");
    const invResult = await runConceptInventory(cleanedText, {
      llmModel: options.llmModel,
      language: options.language,
      onProgress: options.onProgress,
      docHierarchy: null,
    });
    inventory = Array.isArray(invResult?.inventory) ? invResult.inventory : [];
  } catch (err) {
    return {
      added: 0,
      merged: 0,
      errors: [String(err?.message || err || "Concept extraction failed.")],
    };
  }

  if (!inventory.length) {
    return { added: 0, merged: 0, errors: ["No concepts extracted from document."] };
  }

  const docId = await computeDocId(cleanedText);
  let vault = loadVault();
  const newConcepts = filterNewConcepts(inventory, vault, docId);

  let added = 0;
  let merged = 0;
  let mappings = [];

  if (newConcepts.length) {
    const conceptRows = inventoryToNewConcepts(newConcepts);
    const existingEntries = getEntriesByTopic(docTopics).map((e) => ({
      id: e.id,
      canonicalTitle: e.canonicalTitle,
      aliases: e.aliases || [],
    }));

    if (!existingEntries.length) {
      mappings = buildAllNewMappings(conceptRows);
    } else {
      try {
        mappings = await normalizeConceptsToVault({
          existingEntries,
          newConcepts: conceptRows.map((c) => ({
            id: c.id,
            title: c.title,
            type: c.type || "CONCEPT",
          })),
          topic: docTopics[0] || "general",
        });
      } catch (err) {
        console.warn("[importFromDocument] normalization failed, fallback all-new", err);
        mappings = buildAllNewMappings(conceptRows);
        errors.push(`Normalization fallback: ${err?.message || String(err)}`);
      }
    }

    const normalizationMap = mergeNormalizationResult(
      vault,
      mappings,
      conceptRows,
      docTopics,
      docId,
    );
    applyImportDefaultMastery(vault, normalizationMap, defaultMastery);
    ({ added, merged } = countImportResults(mappings));
    vault.lastUpdated = Date.now();
    saveVault(vault);
  } else {
    errors.push("All concepts from this document are already in the vault.");
  }

  appendImportRecord({
    id: newVaultId(),
    type: "document",
    startedAt,
    completedAt: Date.now(),
    conceptsAdded: added,
    conceptsMerged: merged,
    errors: [...errors],
    fileName: String(file?.name || "").trim() || undefined,
  });

  return { added, merged, errors };
}
