import { getSortedSessionConcepts } from "../dictionary.js?v=20260606_1";
import { slugGraphTermId } from "../slow/phase0.js?v=20260528_1";
import { PROXIMITY, resolveArgumentMapNodeAnchor } from "../slow/phase3.js?v=20260528_1";
import { getScopeText } from "../slow/reader.js?v=20260528_1";
import {
  argNodeId,
  blockNodeId,
  conceptNodeId,
  termNodeId,
  textNodeId,
  userNodeId,
} from "./ids.js";

const RELATES_TYPES = new Set(["⟷", "🔗"]);
const CRITICAL_EDGE_TYPES = new Set(["⊘", "↯", "⚠"]);

function truncate(text, max = 72) {
  const raw = String(text || "").trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, Math.max(0, max - 1))}…`;
}

function createGraphBuilder() {
  const nodes = [];
  const edges = [];
  const nodeIds = new Set();
  const edgeKeys = new Set();

  const addNode = (node) => {
    if (!node?.id || nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  };

  const addEdge = (from, to, type) => {
    const f = String(from || "").trim();
    const t = String(to || "").trim();
    if (!f || !t || f === t) return;
    const key = `${f}|${t}|${type}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ from: f, to: t, type });
  };

  const sortNodes = () => {
    const layerOrder = { concept: 0, block: 1, text: 2, arg: 2, term: 2, user: 3 };
    nodes.sort((a, b) => {
      const la = layerOrder[a.layer] ?? 9;
      const lb = layerOrder[b.layer] ?? 9;
      if (la !== lb) return la - lb;
      return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });
  };

  return { nodes, edges, addNode, addEdge, sortNodes, hasNode: (id) => nodeIds.has(id) };
}

/**
 * RSVP / block-index graph from concept inventory + block mapping.
 * @param {{ conceptInventory?: object[], blockIndex?: object[] }} params
 */
export function buildRsvpMaterialGraph({ conceptInventory = [], blockIndex = [] } = {}) {
  const g = createGraphBuilder();
  const inventory = Array.isArray(conceptInventory) ? conceptInventory : [];
  const blocks = Array.isArray(blockIndex) ? blockIndex : [];

  const conceptById = new Map();
  for (const item of inventory) {
    if (!item || typeof item !== "object") continue;
    const id = String(item.id || "").trim();
    if (!id) continue;
    conceptById.set(id, item);
    const title = String(item.title || id).trim();
    const moduleName = String(item.module || "").trim();
    const label = moduleName ? `${title} (${moduleName})` : title;
    g.addNode({
      id: conceptNodeId(id),
      label,
      layer: "concept",
      conceptId: id,
      order: Number(item.order) || 0,
      module: moduleName || undefined,
    });
  }

  for (const item of inventory) {
    const id = String(item?.id || "").trim();
    if (!id) continue;
    const prereqs = Array.isArray(item.prerequisite_ids) ? item.prerequisite_ids : [];
    for (const prereq of prereqs) {
      const pid = String(prereq || "").trim();
      if (!pid || pid === id) continue;
      if (!g.hasNode(conceptNodeId(pid))) {
        g.addNode({
          id: conceptNodeId(pid),
          label: pid,
          layer: "concept",
          conceptId: pid,
        });
      }
      g.addEdge(conceptNodeId(pid), conceptNodeId(id), "requires");
    }
  }

  for (const block of blocks) {
    const id = Number(block?.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    const title = String(block?.title || `Block ${id}`).trim();
    g.addNode({
      id: blockNodeId(id),
      label: `#${id} ${truncate(title, 56)}`,
      layer: "block",
      blockId: id,
    });

    const conceptIds = Array.isArray(block.concept_ids) ? block.concept_ids : [];
    for (const cid of conceptIds) {
      const conceptId = String(cid || "").trim();
      if (!conceptId) continue;
      if (!g.hasNode(conceptNodeId(conceptId))) {
        const fromInv = conceptById.get(conceptId);
        g.addNode({
          id: conceptNodeId(conceptId),
          label: String(fromInv?.title || conceptId).trim(),
          layer: "concept",
          conceptId,
        });
      }
      g.addEdge(blockNodeId(id), conceptNodeId(conceptId), "covers");
    }

    const signature = Array.isArray(block.signature) ? block.signature : [];
    for (const term of signature) {
      const t = String(term || "").trim();
      if (!t) continue;
      const tid = termNodeId(t);
      if (!g.hasNode(tid)) {
        g.addNode({ id: tid, label: t, layer: "term", term: t });
      }
      g.addEdge(blockNodeId(id), tid, "mentions");
    }
  }

  if (blocks.length > 1) {
    const sorted = blocks.slice().sort((a, b) => Number(a.id) - Number(b.id));
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = Number(sorted[i - 1].id);
      const cur = Number(sorted[i].id);
      if (Number.isFinite(prev) && Number.isFinite(cur)) {
        g.addEdge(blockNodeId(prev), blockNodeId(cur), "sequence");
      }
    }
  }

  g.sortNodes();
  return { nodes: g.nodes, edges: g.edges, kind: "rsvp_material" };
}

function collectTextConcepts(session) {
  const map = new Map();
  for (const c of getSortedSessionConcepts()) {
    const term = String(c?.term || "").trim();
    if (!term) continue;
    const termId = slugGraphTermId(term);
    if (!termId) continue;
    map.set(termId, { termId, term, definition: String(c?.definition || "").trim(), source: "session" });
  }
  for (const c of session?.slow?.phase0?.conceptsToFind || []) {
    const term = String(c?.term || "").trim();
    if (!term) continue;
    const termId = String(c?.graphTermId || slugGraphTermId(term)).trim();
    if (!termId || map.has(termId)) continue;
    map.set(termId, {
      termId,
      term,
      definition: String(c?.authorUsage || "").trim(),
      source: "phase0",
    });
  }
  return map;
}

function annotationMid(ann) {
  return (Number(ann?.charStart) + Number(ann?.charEnd)) / 2;
}

function nearestArgumentMapNodeId(session, ann) {
  const phase0 = session?.slow?.phase0;
  const map = Array.isArray(phase0?.argumentMap) ? phase0.argumentMap : [];
  if (!map.length || !ann) return null;
  const scopeText = getScopeText(session);
  const fillableBlanks = phase0?.fillableBlanks || [];
  const annotations = session?.slow?.annotations || [];
  const mid = annotationMid(ann);
  let bestId = null;
  let bestDist = Infinity;
  for (const node of map) {
    const resolved = resolveArgumentMapNodeAnchor(node, scopeText, fillableBlanks, annotations);
    if (resolved.anchor == null) continue;
    const dist = Math.abs(resolved.anchor - mid);
    if (dist <= PROXIMITY && dist < bestDist) {
      bestDist = dist;
      bestId = node.id;
    }
  }
  return bestId;
}

function edgeTypeForAnnotation(type) {
  if (type === "⊘") return "refuta";
  if (type === "↯" || type === "⚠") return "cuestiona";
  if (RELATES_TYPES.has(type)) return "relates";
  return "relates";
}

/**
 * Slow-mode enriched graph (text + user layers, annotations, argument map).
 * @param {object} session
 */
export function buildSlowEnrichedGraph(session) {
  const g = createGraphBuilder();

  const textConcepts = collectTextConcepts(session);
  for (const { termId, term } of textConcepts.values()) {
    g.addNode({
      id: textNodeId(termId),
      label: `[Texto] ${term}`,
      layer: "text",
      termId,
    });
  }

  for (const node of session?.slow?.phase0?.argumentMap || []) {
    const id = String(node?.id || "").trim();
    const text = String(node?.text || "").trim();
    if (!id || !text) continue;
    g.addNode({
      id: argNodeId(id),
      label: `[Texto] ${id}: ${truncate(text)}`,
      layer: "arg",
      termId: id,
    });
  }

  const annotations = Array.isArray(session?.slow?.annotations) ? session.slow.annotations : [];
  for (const ann of annotations) {
    const userText = String(ann?.userText || "").trim();
    if (!userText) continue;
    const uid = userNodeId(ann.id);
    g.addNode({
      id: uid,
      label: `[Pedro:${ann.type}] ${truncate(userText, 96)}`,
      layer: "user",
      sourceAnnotationId: ann.id,
      annotationType: ann.type,
    });

    const links = Array.isArray(ann.graphLinks) ? ann.graphLinks : [];
    for (const link of links) {
      const termId = String(link?.termId || "").trim();
      if (!termId) continue;
      if (!g.hasNode(textNodeId(termId))) {
        const label =
          termId === "literature"
            ? "[Texto] literature"
            : `[Texto] ${termId.replace(/_/g, " ")}`;
        g.addNode({ id: textNodeId(termId), label, layer: "text", termId });
      }
      g.addEdge(uid, textNodeId(termId), "relates");
    }

    if (CRITICAL_EDGE_TYPES.has(ann.type)) {
      const argId = nearestArgumentMapNodeId(session, ann);
      if (argId) {
        g.addEdge(uid, argNodeId(argId), edgeTypeForAnnotation(ann.type));
      }
    } else if (RELATES_TYPES.has(ann.type) && links.length === 0) {
      const argId = nearestArgumentMapNodeId(session, ann);
      if (argId) {
        g.addEdge(uid, argNodeId(argId), "relates");
      }
    }
  }

  g.sortNodes();
  return { nodes: g.nodes, edges: g.edges, kind: "slow_enriched" };
}

/**
 * Phase 0 preview graph (argument map + concepts, no user layer).
 * @param {object} session
 */
export function buildSlowPhase0Graph(session) {
  const g = createGraphBuilder();
  const phase0 = session?.slow?.phase0;
  if (!phase0) return { nodes: [], edges: [], kind: "slow_phase0" };

  for (const c of phase0.conceptsToFind || []) {
    const term = String(c?.term || "").trim();
    if (!term) continue;
    const termId = String(c?.graphTermId || slugGraphTermId(term)).trim();
    if (!termId) continue;
    g.addNode({
      id: textNodeId(termId),
      label: term,
      layer: "text",
      termId,
    });
  }

  const mapNodes = Array.isArray(phase0.argumentMap) ? phase0.argumentMap : [];
  for (let i = 0; i < mapNodes.length; i += 1) {
    const node = mapNodes[i];
    const id = String(node?.id || "").trim();
    const text = String(node?.text || "").trim();
    if (!id || !text) continue;
    g.addNode({
      id: argNodeId(id),
      label: `${id}: ${truncate(text)}`,
      layer: "arg",
      termId: id,
    });
    if (i > 0) {
      const prev = mapNodes[i - 1];
      const prevId = String(prev?.id || "").trim();
      if (prevId) g.addEdge(argNodeId(prevId), argNodeId(id), "sequence");
    }
  }

  g.sortNodes();
  return { nodes: g.nodes, edges: g.edges, kind: "slow_phase0" };
}

/**
 * Mode-agnostic entry: pick the best graph for the current context.
 * @param {object} session
 * @param {{ conceptInventory?: object[], blockIndex?: object[], mode?: 'auto'|'rsvp'|'slow'|'slow_phase0'|'slow_enriched' }} [options]
 */
export function buildSessionGraph(session, options = {}) {
  const mode = String(options.mode || "auto").trim();
  const blockIndex = options.blockIndex ?? session?._meta?.material_graph?.blockIndex ?? null;
  const conceptInventory =
    options.conceptInventory ?? session?._meta?.material_graph?.conceptInventory ?? null;

  if (mode === "slow_phase0") {
    return buildSlowPhase0Graph(session);
  }

  if (mode === "slow_enriched") {
    return buildSlowEnrichedGraph(session);
  }

  if (
    mode === "rsvp" ||
    (mode === "auto" && session?.studyMode !== "slow" && Array.isArray(blockIndex) && blockIndex.length)
  ) {
    if (Array.isArray(blockIndex) && blockIndex.length) {
      return buildRsvpMaterialGraph({
        conceptInventory: conceptInventory || [],
        blockIndex,
      });
    }
  }

  if (mode === "auto" && session?.slow?.graphEnrichedUnlocked) {
    const enriched = buildSlowEnrichedGraph(session);
    if (enriched.nodes.length) return enriched;
  }

  if (session?.slow?.phase0) {
    return buildSlowPhase0Graph(session);
  }

  if (Array.isArray(blockIndex) && blockIndex.length) {
    return buildRsvpMaterialGraph({
      conceptInventory: conceptInventory || [],
      blockIndex,
    });
  }

  return { nodes: [], edges: [], kind: "empty" };
}

/** @deprecated Use buildSlowEnrichedGraph */
export function buildEnrichedGraph(session) {
  return buildSlowEnrichedGraph(session);
}
