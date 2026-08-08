import {
  argNodeId,
  blockNodeId,
  conceptNodeId,
  graphTermSlug,
  LITERATURE_TERM_ID,
  termNodeId,
  textNodeId,
  userNodeId,
} from "./ids.js";
import { findNearestArgumentMapNode } from "./proximity.js";

export const EDGE_TYPES = {
  requires: "requires",
  covers: "covers",
  mentions: "mentions",
  sequence: "sequence",
  relates: "relates",
  supports: "supports",
  contradicts: "contradicts",
  refuta: "refuta",
  cuestiona: "cuestiona",
  instantiates: "instantiates",
  historically_precedes: "historically_precedes",
  reinterprets: "reinterprets",
  constitutes: "constitutes",
  contrasts_with: "contrasts_with",
  influences: "influences",
  exemplifies: "exemplifies",
};

const KNOWN_EDGE_TYPES = new Set(Object.values(EDGE_TYPES));

const RELATES_TYPES = new Set(["⟷", "🔗"]);
const CRITICAL_EDGE_TYPES = new Set(["⊘", "↯", "⚠"]);

function truncate(text, max = 72) {
  const raw = String(text || "").trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Remove nodes with no incident edges, except user-layer notes.
 * @param {{ nodes: object[], edges: object[] }} graph
 */
export function pruneOrphanNodes(graph) {
  if (!graph || !Array.isArray(graph.nodes)) return graph;
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const connectedIds = new Set(edges.flatMap((e) => [e.from, e.to]));
  const pruned = graph.nodes.filter((n) => connectedIds.has(n.id) || n.layer === "user");
  if (pruned.length < graph.nodes.length) {
    console.warn(`[graph] Pruned ${graph.nodes.length - pruned.length} orphan nodes`);
  }
  return { ...graph, nodes: pruned };
}

function argNodeLabel(node) {
  const id = String(node?.id || "").trim();
  const text = String(node?.text || "").trim();
  const period = String(node?.period || "").trim();
  const author = String(node?.author || "").trim();
  let prefix = id;
  if (period) prefix = `${id} (${period})`;
  else if (author) prefix = `${id} (${author})`;
  return `${prefix}: ${truncate(text)}`;
}

function textConceptLabel(c) {
  const term = String(c?.term || "").trim();
  const nodeType = String(c?.nodeType || "CONCEPT").trim() || "CONCEPT";
  return `[${nodeType}] ${term}`;
}

function createGraphBuilder({ validateEdgeTypes = false } = {}) {
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
    const edgeType = String(type || "").trim() || "relates";
    if (validateEdgeTypes && !KNOWN_EDGE_TYPES.has(edgeType)) return;
    const key = `${f}|${t}|${edgeType}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ from: f, to: t, type: edgeType });
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

    const blockById = new Map(sorted.map((b) => [Number(b.id), b]));
    for (const block of sorted) {
      const conceptIds = Array.isArray(block.concept_ids) ? block.concept_ids : [];
      for (const cid of conceptIds) {
        const conceptId = String(cid || "").trim();
        if (!conceptId) continue;
        const item = conceptById.get(conceptId);
        const prereqs = Array.isArray(item?.prerequisite_ids) ? item.prerequisite_ids : [];
        for (const prereq of prereqs) {
          const pid = String(prereq || "").trim();
          if (!pid) continue;
          let prereqBlockId = null;
          for (const b of sorted) {
            const ids = Array.isArray(b.concept_ids) ? b.concept_ids : [];
            if (ids.map(String).includes(pid)) {
              prereqBlockId = Number(b.id);
              break;
            }
          }
          const curId = Number(block.id);
          if (
            prereqBlockId != null &&
            Number.isFinite(prereqBlockId) &&
            Number.isFinite(curId) &&
            prereqBlockId !== curId &&
            Math.abs(prereqBlockId - curId) > 1
          ) {
            g.addEdge(blockNodeId(prereqBlockId), blockNodeId(curId), "prerequisite");
          }
        }
      }
    }
  }

  const inventoryIds = new Set(inventory.map((c) => String(c?.id || "").trim()).filter(Boolean));
  for (const block of blocks) {
    const signature = Array.isArray(block.signature) ? block.signature : [];
    for (const term of signature) {
      const t = String(term || "").trim();
      if (!t) continue;
      const matched = [...inventoryIds].some((id) => {
        const item = conceptById.get(id);
        const title = String(item?.title || "").toLowerCase();
        return title && title.includes(t.toLowerCase());
      });
      if (!matched) {
        const tid = termNodeId(t);
        if (!g.hasNode(tid)) {
          g.addNode({ id: tid, label: t, layer: "term", term: t, grey: true });
        }
        g.addEdge(blockNodeId(Number(block.id)), tid, "mentions");
      }
    }
  }

  g.sortNodes();
  return { nodes: g.nodes, edges: g.edges, kind: "rsvp_material" };
}

/** Pure: collect text-layer concepts from explicit lists (no session I/O). */
export function collectTextConceptsFromLists(sessionConcepts = [], conceptsToFind = []) {
  const map = new Map();
  for (const c of sessionConcepts) {
    const term = String(c?.term || "").trim();
    if (!term) continue;
    const termId = graphTermSlug(term);
    if (!termId) continue;
    map.set(termId, { termId, term, definition: String(c?.definition || "").trim(), source: "session" });
  }
  for (const c of conceptsToFind) {
    const term = String(c?.term || "").trim();
    if (!term) continue;
    const termId = String(c?.graphTermId || graphTermSlug(term)).trim();
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

function edgeTypeForAnnotation(type) {
  if (type === "⊘") return "contradicts";
  if (type === "★" || type === "⇑") return "supports";
  if (type === "↯" || type === "⚠") return "contradicts";
  if (RELATES_TYPES.has(type)) return "relates";
  return "relates";
}

function edgeTypeForGraphLink(ann, link) {
  const relation = String(link?.relation || "").trim();
  if (relation === "supports" || relation === "contradicts" || relation === "instantiates") {
    return relation;
  }
  if (ann?.type === "≈") return "instantiates";
  return "relates";
}

/**
 * Pure enriched graph builder — inject all inputs explicitly (testable in isolation).
 */
export function buildSlowEnrichedGraphFromInputs(inputs = {}) {
  const g = createGraphBuilder({ validateEdgeTypes: true });
  const textConceptsRaw = inputs.textConcepts;
  const textConcepts =
    textConceptsRaw instanceof Map
      ? textConceptsRaw
      : collectTextConceptsFromLists(Array.isArray(textConceptsRaw) ? textConceptsRaw : [], []);

  const argumentMap = Array.isArray(inputs.argumentMap) ? inputs.argumentMap : [];
  const annotations = Array.isArray(inputs.annotations) ? inputs.annotations : [];
  const scopeText = String(inputs.scopeText || "");
  const fillableBlanks = Array.isArray(inputs.fillableBlanks) ? inputs.fillableBlanks : [];
  const onMiss = typeof inputs.onResolveMiss === "function" ? inputs.onResolveMiss : null;

  for (const { termId, term } of textConcepts.values()) {
    g.addNode({
      id: textNodeId(termId),
      label: `[Texto] ${term}`,
      layer: "text",
      termId,
    });
  }

  for (const node of argumentMap) {
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
          termId === LITERATURE_TERM_ID
            ? "[Texto] literature"
            : `[Texto] ${termId.replace(/_/g, " ")}`;
        g.addNode({ id: textNodeId(termId), label, layer: "text", termId });
      }
      g.addEdge(uid, textNodeId(termId), edgeTypeForGraphLink(ann, link));
    }

    const needsArgLink =
      CRITICAL_EDGE_TYPES.has(ann.type) || (RELATES_TYPES.has(ann.type) && links.length === 0);
    if (needsArgLink && !ann.orphaned) {
      const match = findNearestArgumentMapNode(ann, {
        argumentMap,
        scopeText,
        fillableBlanks,
        annotations,
        charProximity: inputs.charProximity,
        minTextOverlap: inputs.minTextOverlap,
      });
      if (match.nodeId) {
        const edgeType = CRITICAL_EDGE_TYPES.has(ann.type)
          ? edgeTypeForAnnotation(ann.type)
          : "relates";
        g.addEdge(uid, argNodeId(match.nodeId), edgeType);
      } else if (onMiss) {
        onMiss(
          ann,
          CRITICAL_EDGE_TYPES.has(ann.type)
            ? `type ${ann.type}`
            : `type ${ann.type}, no graphLinks`,
        );
      }
    }
  }

  g.sortNodes();
  return pruneOrphanNodes({ nodes: g.nodes, edges: g.edges, kind: "slow_enriched" });
}

/** Pure Phase 0 preview graph. */
export function buildSlowPhase0GraphFromInputs({ phase0 = null } = {}) {
  const g = createGraphBuilder({ validateEdgeTypes: true });
  if (!phase0) return { nodes: [], edges: [], kind: "slow_phase0" };

  for (const c of phase0.conceptsToFind || []) {
    const term = String(c?.term || "").trim();
    if (!term) continue;
    const termId = String(c?.graphTermId || graphTermSlug(term)).trim();
    if (!termId) continue;
    const nodeType = String(c?.nodeType || "CONCEPT").trim() || "CONCEPT";
    const canvasNode = {
      id: textNodeId(termId),
      label: textConceptLabel(c),
      layer: "text",
      termId,
      nodeSubtype: nodeType,
    };
    if (Array.isArray(c.includes) && c.includes.length) {
      canvasNode.includes = c.includes;
    }
    g.addNode(canvasNode);
  }

  const mapEdgeType =
    String(phase0.textGenre || "").trim() === "GENEALOGY"
      ? "historically_precedes"
      : "sequence";

  const mapNodes = Array.isArray(phase0.argumentMap) ? phase0.argumentMap : [];
  for (let i = 0; i < mapNodes.length; i += 1) {
    const node = mapNodes[i];
    const id = String(node?.id || "").trim();
    const text = String(node?.text || "").trim();
    if (!id || !text) continue;
    g.addNode({
      id: argNodeId(id),
      label: argNodeLabel(node),
      layer: "arg",
      termId: id,
    });
    if (i > 0) {
      const prev = mapNodes[i - 1];
      const prevId = String(prev?.id || "").trim();
      if (prevId) g.addEdge(argNodeId(prevId), argNodeId(id), mapEdgeType);
    }
  }

  const anchorMapNode = mapNodes.length ? mapNodes[mapNodes.length - 1] : null;
  const anchorArgId = String(anchorMapNode?.id || "").trim();
  if (anchorArgId && g.hasNode(argNodeId(anchorArgId))) {
    for (const c of phase0.conceptsToFind || []) {
      const term = String(c?.term || "").trim();
      if (!term) continue;
      const termId = String(c?.graphTermId || graphTermSlug(term)).trim();
      if (!termId || !g.hasNode(textNodeId(termId))) continue;
      g.addEdge(textNodeId(termId), argNodeId(anchorArgId), "relates");
    }
  }

  g.sortNodes();
  return pruneOrphanNodes({ nodes: g.nodes, edges: g.edges, kind: "slow_phase0" });
}

function clozeNodeId(epistemicId) {
  return `cloze:${String(epistemicId || "").trim()}`;
}

/** Cloze epistemic graph from pipeline Phase 0 or shared concept inventory. */
export function buildClozeEpistemicGraph(session, options = {}) {
  const shared = options.shared ?? session?.shared ?? null;
  let epistemicGraph = session?.cloze?.epistemicGraph;
  if (!epistemicGraph?.nodes?.length && shared?.conceptGraph?.nodes?.length) {
    epistemicGraph = shared.conceptGraph;
  }
  if ((!epistemicGraph || !epistemicGraph.nodes?.length) && shared?.conceptInventory?.length) {
    const nodes = shared.conceptInventory
      .map((c, i) => ({
        id: String(c.canonicalId || c.id || `shared_${i + 1}`),
        text: String(c.text || c.label || c.title || "").trim(),
        type: "CONCEPT",
        importance: 3,
      }))
      .filter((n) => n.id && n.text);
    epistemicGraph = { nodes, edges: shared?.conceptGraph?.edges || [] };
  }
  if (!epistemicGraph || typeof epistemicGraph !== "object") {
    return { nodes: [], edges: [], kind: "cloze" };
  }

  const g = createGraphBuilder();
  const rawNodes = Array.isArray(epistemicGraph.nodes) ? epistemicGraph.nodes : [];
  const rawEdges = Array.isArray(epistemicGraph.edges) ? epistemicGraph.edges : [];

  for (const node of rawNodes) {
    const id = String(node?.id || "").trim();
    // ponytail: unified inventory may use title/label instead of legacy text
    const text = String(node?.text || node?.label || node?.title || "").trim();
    if (!id || !text) continue;
    const canvasNode = {
      id: clozeNodeId(id),
      label: text,
      layer: "concept",
      epistemicId: id,
    };
    const importance = Number(node?.importance);
    if (Number.isFinite(importance) && importance >= 1 && importance <= 5) {
      canvasNode.importance = importance;
    }
    const nodeType = String(node?.type || node?.nodeType || "").trim();
    if (nodeType) canvasNode.epistemicType = nodeType;
    g.addNode(canvasNode);
  }

  for (const edge of rawEdges) {
    const sourceId = String(edge?.source_id || "").trim();
    const targetId = String(edge?.target_id || "").trim();
    if (!sourceId || !targetId || sourceId === targetId) continue;
    const edgeType = String(edge?.type || "relates").trim() || "relates";
    g.addEdge(clozeNodeId(sourceId), clozeNodeId(targetId), edgeType);
  }

  g.sortNodes();
  return { nodes: g.nodes, edges: g.edges, kind: "cloze" };
}
