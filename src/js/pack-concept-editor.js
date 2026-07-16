/**
 * Pack concept graph editor — pure snapshot mutators.
 * Operates only on pack draft snapshot.conceptGraph + conceptInventory.
 * @see specs/20260716-pack-concept-graph-editor
 */

import { graphTermSlug } from "./graph/ids.js";
import { EDGE_TYPES } from "./graph/build.js";

/** UI picker → stored EDGE_TYPES values (research.md). */
export const PACK_EDITOR_EDGE_TYPES = [
  EDGE_TYPES.requires,
  EDGE_TYPES.contradicts,
  EDGE_TYPES.exemplifies,
  EDGE_TYPES.constitutes,
  EDGE_TYPES.relates,
];

const ALLOWED_EDGE = new Set(PACK_EDITOR_EDGE_TYPES);

function deepCloneJson(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // fall through
    }
  }
  return JSON.parse(JSON.stringify(value));
}

export function getConceptKey(entry) {
  return String(entry?.canonicalId || entry?.id || entry?.concept_id || "").trim();
}

function edgeEnds(e) {
  const from = String(e?.source_id || e?.from || e?.sourceId || "").trim();
  const to = String(e?.target_id || e?.to || e?.targetId || "").trim();
  return { from, to };
}

function ensureGraph(snapshot) {
  if (!snapshot.conceptGraph || typeof snapshot.conceptGraph !== "object") {
    snapshot.conceptGraph = { nodes: [], edges: [] };
  }
  if (!Array.isArray(snapshot.conceptGraph.nodes)) snapshot.conceptGraph.nodes = [];
  if (!Array.isArray(snapshot.conceptGraph.edges)) snapshot.conceptGraph.edges = [];
  if (!Array.isArray(snapshot.conceptInventory)) snapshot.conceptInventory = [];
}

function inventoryTitle(entry) {
  return String(entry?.title || entry?.label || "").trim();
}

function allocateConceptId(snapshot, title) {
  const base = graphTermSlug(title) || "concept";
  const used = new Set(
    (snapshot.conceptInventory || []).map(getConceptKey).filter(Boolean),
  );
  for (const n of snapshot.conceptGraph?.nodes || []) {
    const id = String(n?.id || "").trim();
    if (id) used.add(id);
  }
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

/**
 * @param {object} snapshot
 * @param {string} conceptId
 * @param {string} newTitle
 */
export function renameConcept(snapshot, conceptId, newTitle) {
  const id = String(conceptId || "").trim();
  const title = String(newTitle || "").trim();
  if (!id) throw new Error("renameConcept: conceptId required");
  if (!title) throw new Error("renameConcept: title required");

  const out = deepCloneJson(snapshot) || {};
  ensureGraph(out);

  const entry = out.conceptInventory.find((c) => getConceptKey(c) === id);
  if (!entry) throw new Error(`renameConcept: concept not found (${id})`);
  entry.title = title;
  if ("label" in entry || entry.label != null) entry.label = title;

  const node = out.conceptGraph.nodes.find((n) => String(n?.id || "").trim() === id);
  if (node) {
    node.text = title;
    if ("label" in node) node.label = title;
  }
  return out;
}

/**
 * @param {object} snapshot
 * @param {string} title
 * @returns {{ snapshot: object, conceptId: string }}
 */
export function addConcept(snapshot, title) {
  const name = String(title || "").trim();
  if (!name) throw new Error("addConcept: title required");

  const out = deepCloneJson(snapshot) || {};
  ensureGraph(out);
  const conceptId = allocateConceptId(out, name);

  out.conceptInventory.push({
    id: conceptId,
    canonicalId: conceptId,
    title: name,
    label: name,
  });
  out.conceptGraph.nodes.push({
    id: conceptId,
    text: name,
    type: "CONCEPT",
  });
  return { snapshot: out, conceptId };
}

/**
 * Physical delete. Hanging conceptId refs in modes.rsvp/questions/recall are an accepted v1 limitation.
 * @param {object} snapshot
 * @param {string} conceptId
 */
export function deleteConcept(snapshot, conceptId) {
  const id = String(conceptId || "").trim();
  if (!id) throw new Error("deleteConcept: conceptId required");

  const out = deepCloneJson(snapshot) || {};
  ensureGraph(out);
  out.conceptInventory = out.conceptInventory.filter((c) => getConceptKey(c) !== id);
  out.conceptGraph.nodes = out.conceptGraph.nodes.filter((n) => String(n?.id || "").trim() !== id);
  out.conceptGraph.edges = out.conceptGraph.edges.filter((e) => {
    const { from, to } = edgeEnds(e);
    return from !== id && to !== id;
  });
  return out;
}

/**
 * @param {object} snapshot
 * @param {string} fromId
 * @param {string} toId
 * @param {string} type
 */
export function addEdge(snapshot, fromId, toId, type) {
  const from = String(fromId || "").trim();
  const to = String(toId || "").trim();
  const edgeType = String(type || "").trim();
  if (!from || !to) throw new Error("addEdge: endpoints required");
  if (from === to) throw new Error("addEdge: self-loop rejected");
  if (!ALLOWED_EDGE.has(edgeType)) throw new Error(`addEdge: unknown type (${edgeType})`);

  const out = deepCloneJson(snapshot) || {};
  ensureGraph(out);
  const ids = new Set(out.conceptGraph.nodes.map((n) => String(n?.id || "").trim()).filter(Boolean));
  if (!ids.has(from) || !ids.has(to)) throw new Error("addEdge: endpoint node missing");

  out.conceptGraph.edges.push({
    source_id: from,
    target_id: to,
    type: edgeType,
  });
  return out;
}

/**
 * @param {object} snapshot
 * @param {string} fromId
 * @param {string} toId
 * @param {string} [type]
 */
export function removeEdge(snapshot, fromId, toId, type) {
  const from = String(fromId || "").trim();
  const to = String(toId || "").trim();
  const edgeType = type != null ? String(type).trim() : "";
  if (!from || !to) throw new Error("removeEdge: endpoints required");

  const out = deepCloneJson(snapshot) || {};
  ensureGraph(out);
  out.conceptGraph.edges = out.conceptGraph.edges.filter((e) => {
    const ends = edgeEnds(e);
    if (ends.from !== from || ends.to !== to) return true;
    if (edgeType && String(e?.type || "").trim() !== edgeType) return true;
    return false;
  });
  return out;
}

/**
 * Map epistemic snapshot graph to canvas { nodes, edges } for renderGraphCanvas.
 * @param {object} snapshot
 */
export function toCanvasGraph(snapshot) {
  const inv = Array.isArray(snapshot?.conceptInventory) ? snapshot.conceptInventory : [];
  const titleById = new Map();
  for (const c of inv) {
    const id = getConceptKey(c);
    if (id) titleById.set(id, inventoryTitle(c) || id);
  }

  const rawNodes = Array.isArray(snapshot?.conceptGraph?.nodes) ? snapshot.conceptGraph.nodes : [];
  const nodes = [];
  const seen = new Set();

  for (const n of rawNodes) {
    const id = String(n?.id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const label =
      String(n?.text || n?.label || "").trim() || titleById.get(id) || id;
    nodes.push({ id, label, layer: "concept" });
  }

  for (const [id, title] of titleById) {
    if (seen.has(id)) continue;
    seen.add(id);
    nodes.push({ id, label: title || id, layer: "concept" });
  }

  const rawEdges = Array.isArray(snapshot?.conceptGraph?.edges) ? snapshot.conceptGraph.edges : [];
  const edges = [];
  for (const e of rawEdges) {
    const { from, to } = edgeEnds(e);
    if (!from || !to || !seen.has(from) || !seen.has(to)) continue;
    edges.push({
      from,
      to,
      type: String(e?.type || "relates").trim() || "relates",
    });
  }

  return { nodes, edges, kind: "pack_concept_editor" };
}

/** Test helper: every edge endpoint exists in nodes. */
export function assertNoDanglingEdges(graph) {
  const ids = new Set((graph?.nodes || []).map((n) => String(n?.id || "").trim()).filter(Boolean));
  for (const e of graph?.edges || []) {
    const { from, to } = edgeEnds(e);
    if (!ids.has(from) || !ids.has(to)) {
      throw new Error(`dangling edge ${from}→${to}`);
    }
  }
}

/** Product labels for the edge-type picker. */
export const PACK_EDITOR_EDGE_LABELS = {
  [EDGE_TYPES.requires]: "Prerequisite",
  [EDGE_TYPES.contradicts]: "Contradicts",
  [EDGE_TYPES.exemplifies]: "Exemplifies",
  [EDGE_TYPES.constitutes]: "Part of",
  [EDGE_TYPES.relates]: "Associated",
};

/**
 * Debounced draft snapshot saver.
 * @param {(snapshot: object) => Promise<void>} saveFn
 * @param {number} [ms]
 */
export function createDebouncedPackSaver(saveFn, ms = 500) {
  let timer = null;
  let pending = null;
  let chain = Promise.resolve();
  const runSave = (snap) => {
    chain = chain.then(() => saveFn(snap), () => saveFn(snap));
    return chain;
  };
  return {
    schedule(snapshot) {
      pending = snapshot;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const snap = pending;
        pending = null;
        if (snap) {
          runSave(snap).catch(() => {
            /* caller surfaces via saveFn side effects */
          });
        }
      }, ms);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const snap = pending;
      pending = null;
      if (snap) await runSave(snap);
      else await chain;
    },
  };
}
