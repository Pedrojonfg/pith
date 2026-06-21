/**
 * R0 — Probe graph construction (PREREQUISITE DAG only).
 * @see specs/20260630-adaptive-knowledge-probing/
 */

import { deriveInventoryEdges } from "../assessment-coverage.js";
import { CONNECTION_TYPES, mapEpistemicTypeToRegistry } from "../concept-registry/connection-types.js";

function getConceptId(c) {
  return String(c?.id || c?.concept_id || "").trim();
}

function edgeWeight(e) {
  const w = Number(e?.weight ?? e?.strength);
  return Number.isFinite(w) ? w : 1.0;
}

function isPrerequisiteEdge(e) {
  const type = mapEpistemicTypeToRegistry(e?.type || e?.relation, e?.registry_type);
  return type === CONNECTION_TYPES.PREREQUISITE;
}

/**
 * @param {object[]} inventory
 * @param {{ edges?: object[] } | null} conceptGraph
 */
function collectPrerequisiteEdges(inventory, conceptGraph) {
  const edgeMap = new Map();
  const add = (from, to, weight) => {
    const f = String(from || "").trim();
    const t = String(to || "").trim();
    if (!f || !t || f === t) return;
    const key = `${f}\u2192${t}`;
    const w = Number.isFinite(Number(weight)) ? Number(weight) : 1;
    const prev = edgeMap.get(key);
    if (!prev || w < prev.weight) edgeMap.set(key, { from: f, to: t, weight: w });
  };

  const derived = deriveInventoryEdges(inventory, conceptGraph);
  for (const e of derived) {
    if (!isPrerequisiteEdge(e)) continue;
    add(e.from, e.to, edgeWeight(e));
  }
  if (conceptGraph?.edges?.length) {
    for (const raw of conceptGraph.edges) {
      if (!raw || typeof raw !== "object") continue;
      const from = String(raw.from || raw.sourceId || "").trim();
      const to = String(raw.to || raw.targetId || "").trim();
      if (!from || !to) continue;
      const type = mapEpistemicTypeToRegistry(raw.type || raw.relation, raw.registry_type);
      if (type !== CONNECTION_TYPES.PREREQUISITE) continue;
      add(from, to, edgeWeight(raw));
    }
  }
  return [...edgeMap.values()];
}

function buildAdjacency(nodes, edges) {
  const nodeSet = new Set(nodes);
  /** @type {Map<string, string[]>} */
  const prerequisites = new Map();
  /** @type {Map<string, string[]>} */
  const dependents = new Map();
  for (const id of nodes) {
    prerequisites.set(id, []);
    dependents.set(id, []);
  }
  for (const e of edges) {
    if (!nodeSet.has(e.from) || !nodeSet.has(e.to)) continue;
    prerequisites.get(e.to).push(e.from);
    dependents.get(e.from).push(e.to);
  }
  return { prerequisites, dependents };
}

/**
 * DFS cycle detection; returns array of cycles as edge keys in cycle order.
 * @param {string[]} nodes
 * @param {{ from: string, to: string, weight: number }[]} edges
 */
function findCycles(nodes, edges) {
  const adj = new Map();
  const edgeByKey = new Map();
  for (const id of nodes) adj.set(id, []);
  for (const e of edges) {
    adj.get(e.from)?.push(e.to);
    edgeByKey.set(`${e.from}\u2192${e.to}`, e);
  }

  /** @type {string[]} */
  const stack = [];
  const inStack = new Set();
  const visited = new Set();
  /** @type {string[][]} */
  const cycles = [];

  function dfs(node) {
    visited.add(node);
    inStack.add(node);
    stack.push(node);

    for (const next of adj.get(node) || []) {
      if (!visited.has(next)) {
        dfs(next);
      } else if (inStack.has(next)) {
        const startIdx = stack.indexOf(next);
        if (startIdx >= 0) {
          cycles.push(stack.slice(startIdx).concat(next));
        }
      }
    }

    stack.pop();
    inStack.delete(node);
  }

  for (const n of nodes) {
    if (!visited.has(n)) dfs(n);
  }

  return cycles.map((path) => {
    const cycleEdges = [];
    for (let i = 0; i < path.length - 1; i += 1) {
      const from = path[i];
      const to = path[i + 1];
      cycleEdges.push(edgeByKey.get(`${from}\u2192${to}`) || { from, to, weight: 1 });
    }
    return { path, edges: cycleEdges };
  });
}

function breakCycles(edges, cycles) {
  const dropKeys = new Set();
  /** @type {object[]} */
  const warnings = [];
  for (const cycle of cycles) {
    const cycleEdges = cycle.edges.filter(Boolean);
    if (!cycleEdges.length) continue;
    const lowest = cycleEdges.reduce((a, b) => (a.weight <= b.weight ? a : b));
    const key = `${lowest.from}\u2192${lowest.to}`;
    if (dropKeys.has(key)) continue;
    dropKeys.add(key);
    warnings.push({
      from_concept_id: lowest.from,
      to_concept_id: lowest.to,
      edge_weight: lowest.weight,
      cycle_path: cycle.path,
    });
  }
  const kept = edges.filter((e) => !dropKeys.has(`${e.from}\u2192${e.to}`));
  return { edges: kept, warnings };
}

/**
 * @param {object} params
 * @param {object[]} params.conceptInventory
 * @param {{ edges?: object[] } | null} [params.conceptGraph]
 */
export function buildProbeGraph({ conceptInventory, conceptGraph = null }) {
  const inventory = Array.isArray(conceptInventory) ? conceptInventory : [];
  const nodeIds = [];
  const seenNodes = new Set();
  for (const c of inventory) {
    const id = getConceptId(c);
    if (!id) continue;
    if (seenNodes.has(id)) {
      throw new Error(`Duplicate probe graph node: ${id}`);
    }
    seenNodes.add(id);
    nodeIds.push(id);
  }

  let edges = collectPrerequisiteEdges(inventory, conceptGraph);
  edges = edges.filter((e) => seenNodes.has(e.from) && seenNodes.has(e.to));

  let warnings = [];
  let cyclesBroken = 0;
  for (let guard = 0; guard < 32; guard += 1) {
    const cycles = findCycles(nodeIds, edges);
    if (!cycles.length) break;
    const result = breakCycles(edges, cycles);
    edges = result.edges;
    warnings = warnings.concat(result.warnings);
    cyclesBroken += result.warnings.length;
  }

  const propagationEnabled = edges.length > 0;
  const adjacency = buildAdjacency(nodeIds, edges);

  return {
    nodes: nodeIds,
    edges,
    adjacency,
    propagationEnabled,
    warnings,
    meta: {
      nodeCount: nodeIds.length,
      edgeCount: edges.length,
      cyclesBroken,
      propagationEnabled,
      builtAt: new Date().toISOString(),
    },
  };
}

export { getConceptId as getProbeConceptId };
