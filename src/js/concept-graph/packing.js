/**
 * Edge-weighted packing helpers for unified concept graph.
 * @see specs/20260722-unified-concept-graph/contracts/concept-graph.md
 */

import {
  getEdgeAffinityWeight,
  STRUCTURAL_BONUS_SCALE,
} from "../config/packing-weights.js";

function conceptKey(c) {
  return String(c?.canonicalId || c?.id || "").trim();
}

/**
 * Affinity-only structural bonus, capped before scale (±1.0 then × STRUCTURAL_BONUS_SCALE).
 * @param {string} nodeId
 * @param {object[]} edges
 */
export function structuralBonus(nodeId, edges) {
  const id = String(nodeId || "").trim();
  if (!id) return 0;
  let sum = 0;
  for (const e of Array.isArray(edges) ? edges : []) {
    const s = String(e?.source_id || "").trim();
    const t = String(e?.target_id || "").trim();
    if (s !== id && t !== id) continue;
    sum += getEdgeAffinityWeight(e?.type);
  }
  const capped = Math.min(1.0, sum);
  return capped * STRUCTURAL_BONUS_SCALE;
}

/**
 * @param {object} node
 * @param {object[]} edges
 */
export function finalImportance(node, edges) {
  const llm = Number(node?.importance);
  const base = Number.isFinite(llm) ? llm : 0;
  return base + structuralBonus(conceptKey(node), edges);
}

/**
 * Soft reorder: keep high-affinity pairs adjacent while preserving relative order otherwise.
 * @param {object[]} inventory
 * @param {object[]} edges
 */
export function orderInventoryByAffinity(inventory, edges) {
  const inv = (Array.isArray(inventory) ? inventory : []).filter((c) => conceptKey(c));
  if (inv.length < 2 || !Array.isArray(edges) || !edges.length) return inv;

  const affinity = new Map(); // "a|b" sorted key → weight
  for (const e of edges) {
    const a = String(e?.source_id || "").trim();
    const b = String(e?.target_id || "").trim();
    if (!a || !b || a === b) continue;
    const w = getEdgeAffinityWeight(e?.type);
    if (w < 0.5) continue; // only strong affinity pulls together
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    affinity.set(key, Math.max(affinity.get(key) || 0, w));
  }
  if (!affinity.size) return inv;

  const remaining = inv.slice();
  const out = [remaining.shift()];
  while (remaining.length) {
    const lastId = conceptKey(out[out.length - 1]);
    let bestIdx = 0;
    let bestW = -1;
    for (let i = 0; i < remaining.length; i += 1) {
      const id = conceptKey(remaining[i]);
      const key = lastId < id ? `${lastId}|${id}` : `${id}|${lastId}`;
      const w = affinity.get(key) || 0;
      if (w > bestW) {
        bestW = w;
        bestIdx = i;
      }
    }
    if (bestW > 0) {
      out.push(remaining.splice(bestIdx, 1)[0]);
    } else {
      out.push(remaining.shift());
    }
  }
  return out;
}

/**
 * Minimal repair: if prerequisite A appears after dependent B, move A's block to just before B's.
 * `prerequisite_of`: source is prerequisite of target (source should come first).
 * @param {object[]} blocks
 * @param {object[]} edges
 */
export function repairPrerequisiteBlockOrder(blocks, edges) {
  const list = (Array.isArray(blocks) ? blocks : []).map((b) => ({
    ...b,
    concept_ids: Array.isArray(b?.concept_ids) ? b.concept_ids.map((x) => String(x)) : [],
  }));
  if (list.length < 2) return list;

  const prereqEdges = (Array.isArray(edges) ? edges : []).filter(
    (e) => String(e?.type || "").trim() === "prerequisite_of",
  );
  if (!prereqEdges.length) return list;

  let result = list;
  const maxPasses = result.length + 2;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const firstBlock = new Map();
    result.forEach((b, i) => {
      for (const id of b.concept_ids) {
        if (!firstBlock.has(id)) firstBlock.set(id, i);
      }
    });
    let moved = false;
    for (const e of prereqEdges) {
      const a = String(e.source_id || "").trim();
      const b = String(e.target_id || "").trim();
      const ia = firstBlock.get(a);
      const ib = firstBlock.get(b);
      if (ia == null || ib == null) continue;
      if (ia <= ib) continue;
      // Move prerequisite block earlier (just before dependent)
      const next = result.slice();
      const [blockA] = next.splice(ia, 1);
      next.splice(ib, 0, blockA);
      result = next;
      moved = true;
      break;
    }
    if (!moved) break;
  }
  return result.map((b, i) => ({ ...b, id: i + 1 }));
}

/**
 * Resolve edges from options or active document shared.conceptGraph.
 * @param {{ edges?: object[], conceptGraph?: { edges?: object[] } }} [options]
 * @param {() => object|null} [getDoc]
 */
export function resolvePackingEdges(options = {}, getDoc = null) {
  if (Array.isArray(options.edges)) return options.edges;
  if (Array.isArray(options.conceptGraph?.edges)) return options.conceptGraph.edges;
  try {
    const doc = typeof getDoc === "function" ? getDoc() : null;
    const edges = doc?.shared?.conceptGraph?.edges;
    return Array.isArray(edges) ? edges : [];
  } catch {
    return [];
  }
}
