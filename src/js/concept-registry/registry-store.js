/**
 * Global concept registry — localStorage persistence (Supabase-ready seam).
 * @see specs/20260626-cross-doc-vault/contracts/concept-registry-store.md
 */

export const REGISTRY_STORAGE_KEY = "mylearning_concept_registry";
export const REGISTRY_SCHEMA_VERSION = 2;

function newConceptId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `concept-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

import { normalizeConnections } from "./connection-types.js";

function emptyRegistry() {
  return {
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    concepts: [],
    connections: [],
    observations: [],
    lastUpdated: Date.now(),
  };
}

/**
 * @returns {import('../session-types.js').ConceptRegistry}
 */
export function loadRegistry() {
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (!raw) return emptyRegistry();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyRegistry();
    return {
      schemaVersion: Number(parsed.schemaVersion) || REGISTRY_SCHEMA_VERSION,
      concepts: Array.isArray(parsed.concepts) ? parsed.concepts.map(normalizeConcept) : [],
      connections: normalizeConnections(parsed),
      observations: Array.isArray(parsed.observations) ? [...parsed.observations] : [],
      lastUpdated: Number(parsed.lastUpdated) || Date.now(),
    };
  } catch (err) {
    console.warn("[concept-registry] loadRegistry corrupt", err);
    return emptyRegistry();
  }
}

/**
 * @param {import('../session-types.js').ConceptRegistry} registry
 */
export function saveRegistry(registry) {
  const payload = {
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    concepts: Array.isArray(registry?.concepts) ? registry.concepts.map(normalizeConcept) : [],
    connections: normalizeConnections(registry),
    observations: Array.isArray(registry?.observations) ? [...registry.observations] : [],
    lastUpdated: Date.now(),
  };
  localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(payload));
}

/**
 * @param {object} raw
 * @returns {import('../session-types.js').Concept}
 */
export function normalizeConcept(raw) {
  const now = new Date().toISOString();
  const id = String(raw?.id || "").trim() || newConceptId();
  const maturity = raw?.maturity === "green" ? "green" : "yellow";
  const facets = Array.isArray(raw?.facets)
    ? raw.facets.map(normalizeFacetSchedule).filter(Boolean)
    : [];
  const content =
    raw?.content && typeof raw.content === "object"
      ? {
          blocks: Array.isArray(raw.content.blocks)
            ? raw.content.blocks.map((b) => normalizeContentBlock(b)).filter(Boolean)
            : [],
        }
      : maturity === "green"
        ? { blocks: [] }
        : null;

  return {
    id,
    canonicalName: String(raw?.canonicalName || "").trim(),
    slug: String(raw?.slug || "").trim(),
    aliases: Array.isArray(raw?.aliases)
      ? [...new Set(raw.aliases.map((a) => String(a || "").trim()).filter(Boolean))]
      : [],
    maturity,
    mastery: clamp01(raw?.mastery),
    facets,
    content,
    sourceDocIds: Array.isArray(raw?.sourceDocIds)
      ? [...new Set(raw.sourceDocIds.map((d) => String(d || "").trim()).filter(Boolean))]
      : [],
    relatedConceptIds: Array.isArray(raw?.relatedConceptIds)
      ? [...new Set(raw.relatedConceptIds.map((d) => String(d || "").trim()).filter(Boolean))]
      : [],
    merged_into: String(raw?.merged_into || "").trim() || undefined,
    createdAt: String(raw?.createdAt || now),
    updatedAt: String(raw?.updatedAt || now),
  };
}

/**
 * @param {object} raw
 */
function normalizeFacetSchedule(raw) {
  const facet = String(raw?.facet || "").trim();
  if (!facet) return null;
  return {
    facet,
    interval: Number.isFinite(raw?.interval) ? raw.interval : 0,
    repetitions: Number.isFinite(raw?.repetitions) ? raw.repetitions : 0,
    easeFactor: Number.isFinite(raw?.easeFactor) ? raw.easeFactor : 2.5,
    dueDate: String(raw?.dueDate || new Date().toISOString().slice(0, 10)),
    lastReviewedAt: String(raw?.lastReviewedAt || ""),
    lastQuality: Number.isFinite(raw?.lastQuality) ? raw.lastQuality : 0,
  };
}

/**
 * @param {object} raw
 */
function normalizeContentBlock(raw) {
  const id = String(raw?.id || "").trim() || newConceptId();
  const facet = String(raw?.facet || "").trim();
  const text = String(raw?.text || "").trim();
  if (!facet || !text) return null;
  return {
    id,
    facet,
    text,
    sourceDocId: String(raw?.sourceDocId || "").trim(),
    sourceSessionDate: String(raw?.sourceSessionDate || new Date().toISOString()),
    supersededBy: raw?.supersededBy ? String(raw.supersededBy) : null,
  };
}

function clamp01(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/**
 * @param {string} id
 */
export function getConceptById(id) {
  const needle = String(id || "").trim();
  if (!needle) return null;
  const registry = loadRegistry();
  return registry.concepts.find((c) => c.id === needle) || null;
}

/**
 * @param {string} slug
 */
export function getConceptBySlug(slug) {
  const needle = String(slug || "").trim().toLowerCase();
  if (!needle) return null;
  const registry = loadRegistry();
  return registry.concepts.find((c) => c.slug === needle) || null;
}

/**
 * @param {string} name
 * @param {string} [description]
 * @returns {import('../session-types.js').Concept[]}
 */
export function findConceptCandidates(name, description = "") {
  const registry = loadRegistry();
  const slug = normalizeSlug(name);
  const nameLower = String(name || "").trim().toLowerCase();
  const descLower = String(description || "").trim().toLowerCase();
  return registry.concepts.filter((c) => {
    if (c.slug === slug) return true;
    if (c.aliases.some((a) => a.toLowerCase() === nameLower)) return true;
    if (descLower && c.canonicalName.toLowerCase().includes(descLower.slice(0, 20))) return true;
    return fuzzyRatio(c.canonicalName.toLowerCase(), nameLower) >= 0.6;
  });
}

/**
 * @param {string} name
 */
export function normalizeSlug(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function fuzzyRatio(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length < b.length ? a : b;
  if (longer.includes(shorter)) return shorter.length / longer.length;
  let matches = 0;
  const setB = new Set(b.split(/\s+/));
  for (const w of a.split(/\s+/)) {
    if (setB.has(w)) matches += 1;
  }
  return matches / Math.max(a.split(/\s+/).length, b.split(/\s+/).length, 1);
}

/**
 * @param {import('../session-types.js').Concept} concept
 */
export function upsertConcept(concept) {
  const registry = loadRegistry();
  const normalized = normalizeConcept(concept);
  if (!normalized.canonicalName || !normalized.slug) {
    throw new Error("upsertConcept requires canonicalName and slug");
  }
  const idx = registry.concepts.findIndex(
    (c) => c.id === normalized.id || c.slug === normalized.slug,
  );
  const now = new Date().toISOString();
  if (idx >= 0) {
    const prev = registry.concepts[idx];
    registry.concepts[idx] = {
      ...prev,
      ...normalized,
      id: prev.id,
      createdAt: prev.createdAt,
      updatedAt: now,
      aliases: [...new Set([...(prev.aliases || []), ...(normalized.aliases || [])])],
      sourceDocIds: [...new Set([...(prev.sourceDocIds || []), ...(normalized.sourceDocIds || [])])],
    };
    saveRegistry(registry);
    return registry.concepts[idx];
  }
  normalized.createdAt = normalized.createdAt || now;
  normalized.updatedAt = now;
  registry.concepts.push(normalized);
  saveRegistry(registry);
  return normalized;
}

/**
 * @param {string} conceptId
 * @param {string} docId
 */
export function addSourceDocId(conceptId, docId) {
  const id = String(conceptId || "").trim();
  const doc = String(docId || "").trim();
  if (!id || !doc) return;
  const registry = loadRegistry();
  const concept = registry.concepts.find((c) => c.id === id);
  if (!concept) return;
  if (!concept.sourceDocIds.includes(doc)) {
    concept.sourceDocIds.push(doc);
    concept.updatedAt = new Date().toISOString();
    saveRegistry(registry);
  }
}

/**
 * @param {string} conceptId
 * @param {import('../session-types.js').ConceptFacetSchedule} schedule
 */
export function upsertFacetSchedule(conceptId, schedule) {
  const id = String(conceptId || "").trim();
  const normalized = normalizeFacetSchedule(schedule);
  if (!id || !normalized) throw new Error("upsertFacetSchedule requires conceptId and facet");
  const registry = loadRegistry();
  const concept = registry.concepts.find((c) => c.id === id);
  if (!concept) throw new Error("concept not found");
  const idx = concept.facets.findIndex((f) => f.facet === normalized.facet);
  if (idx >= 0) concept.facets[idx] = { ...concept.facets[idx], ...normalized };
  else concept.facets.push(normalized);
  concept.updatedAt = new Date().toISOString();
  saveRegistry(registry);
}

/**
 * @param {string} conceptId
 * @param {object} block
 */
export function appendContentBlock(conceptId, block) {
  const id = String(conceptId || "").trim();
  const normalized = normalizeContentBlock(block);
  if (!id || !normalized) throw new Error("appendContentBlock requires valid block");
  const registry = loadRegistry();
  const concept = registry.concepts.find((c) => c.id === id);
  if (!concept) throw new Error("concept not found");
  if (!concept.content) concept.content = { blocks: [] };
  concept.content.blocks.push(normalized);
  concept.maturity = "green";
  concept.updatedAt = new Date().toISOString();
  saveRegistry(registry);
  return normalized;
}

/**
 * @param {string} conceptId
 * @param {string} oldBlockId
 * @param {string} newBlockId
 */
export function supersedeContentBlock(conceptId, oldBlockId, newBlockId) {
  const registry = loadRegistry();
  const concept = registry.concepts.find((c) => c.id === conceptId);
  if (!concept?.content?.blocks) return;
  const oldId = String(oldBlockId || "").trim();
  const newId = String(newBlockId || "").trim();
  const block = concept.content.blocks.find((b) => b.id === oldId);
  if (block) block.supersededBy = newId;
  concept.updatedAt = new Date().toISOString();
  saveRegistry(registry);
}

/**
 * @param {import('../session-types.js').VaultObservationGlobal} obs
 */
export function appendObservation(obs) {
  const registry = loadRegistry();
  registry.observations.push({
    conceptId: String(obs?.conceptId || "").trim(),
    facet: String(obs?.facet || "recognition").trim(),
    observedAt: String(obs?.observedAt || new Date().toISOString()),
    quality: Number.isFinite(obs?.quality) ? obs.quality : 0,
    sourceDocId: String(obs?.sourceDocId || "").trim(),
  });
  if (registry.observations.length > 2000) {
    registry.observations = registry.observations.slice(-2000);
  }
  saveRegistry(registry);
}

/** @returns {import('../session-types.js').Concept[]} */
export function getAllConcepts() {
  return loadRegistry().concepts;
}

/**
 * @param {Date} [asOf]
 */
export function getDueFacetSchedules(asOf = new Date()) {
  const cutoff = asOf.toISOString().slice(0, 10);
  const out = [];
  for (const concept of getAllConcepts()) {
    for (const schedule of concept.facets || []) {
      const due = String(schedule.dueDate || "").slice(0, 10);
      if (!due || due <= cutoff) {
        out.push({ concept, schedule });
      }
    }
  }
  return out;
}

/**
 * @param {string} conceptId
 * @param {number} mastery
 */
export function setConceptMasteryCache(conceptId, mastery) {
  const registry = loadRegistry();
  const concept = registry.concepts.find((c) => c.id === conceptId);
  if (!concept) return;
  concept.mastery = clamp01(mastery);
  concept.updatedAt = new Date().toISOString();
  saveRegistry(registry);
}
