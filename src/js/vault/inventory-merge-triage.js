/**
 * Pure inventory merge triage helpers (no I/O).
 */

import { cosineSimilarity } from "./embedding-math.js";
import {
  MERGE_AUTO_THRESHOLD,
  MERGE_REVIEW_THRESHOLD,
  INVENTORY_MERGE_PAIR_FLOOR,
} from "./inventory-merge-thresholds.js";

/** @typedef {'auto' | 'review' | 'distinct'} MergeTriage */

/**
 * @param {number} similarity
 * @param {{ auto?: number, review?: number }} [thresholds]
 * @returns {MergeTriage}
 */
export function triagePairSimilarity(similarity, thresholds = {}) {
  const auto = thresholds.auto ?? MERGE_AUTO_THRESHOLD;
  const review = thresholds.review ?? MERGE_REVIEW_THRESHOLD;
  if (similarity >= auto) return "auto";
  if (similarity >= review) return "review";
  return "distinct";
}

/**
 * @param {object} concept
 */
export function buildInventoryConceptEmbedText(concept) {
  const label = String(concept?.title || concept?.label || concept?.term || "").trim();
  const definition = String(concept?.scope_one_line || concept?.scope || concept?.definition || "").trim();
  if (label && definition) return `${label} ${definition}`.trim();
  return label || definition;
}

export class UnionFind {
  /** @param {string[]} ids */
  constructor(ids) {
    /** @type {Map<string, string>} */
    this.parent = new Map(ids.map((id) => [id, id]));
  }

  /** @param {string} id */
  find(id) {
    let root = id;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    let cur = id;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur);
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  /** @param {string} a @param {string} b */
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

/**
 * @param {{ label?: string, concepts?: object[] }[]} partials
 */
export function flattenPartialsForEmbed(partials) {
  /** @type {{ flatId: string, concept: object, partialLabel: string }[]} */
  const rows = [];
  const payload = Array.isArray(partials) ? partials : [];
  payload.forEach((partial, pi) => {
    const label = String(partial?.label || "Section");
    (partial?.concepts || []).forEach((concept, ci) => {
      if (!concept || typeof concept !== "object") return;
      const title = String(concept.title || "").trim();
      const scope = String(concept.scope_one_line || concept.scope || "").trim();
      if (!title || !scope) return;
      rows.push({
        flatId: `p${pi}c${ci}`,
        concept: { ...concept, title, scope_one_line: scope },
        partialLabel: label,
      });
    });
  });
  return rows;
}

/**
 * @param {object[]} members
 */
export function mergeConceptCluster(members) {
  if (!members.length) return null;
  let best = members[0];
  for (const c of members) {
    const sp = String(c?.source_phrase || "").length;
    const bsp = String(best?.source_phrase || "").length;
    if (sp > bsp) best = c;
  }
  const prereqs = new Set();
  for (const c of members) {
    for (const p of c?.prerequisite_ids || []) {
      const id = String(p || "").trim();
      if (id) prereqs.add(id);
    }
  }
  const order = Math.min(...members.map((c) => Number(c?.order) || Infinity));
  return {
    ...best,
    order: Number.isFinite(order) ? order : best.order,
    prerequisite_ids: [...prereqs],
  };
}

/**
 * @param {{ flatId: string, concept: object }[]} rows
 * @param {Map<string, number[]>} vectors
 * @param {number} [floor]
 */
export function findCandidatePairs(rows, vectors, floor = INVENTORY_MERGE_PAIR_FLOOR) {
  /** @type {{ idA: string, idB: string, similarity: number }[]} */
  const pairs = [];
  for (let i = 0; i < rows.length; i += 1) {
    const va = vectors.get(rows[i].flatId);
    if (!va) continue;
    for (let j = i + 1; j < rows.length; j += 1) {
      const vb = vectors.get(rows[j].flatId);
      if (!vb) continue;
      const sim = cosineSimilarity(va, vb);
      if (sim >= floor) pairs.push({ idA: rows[i].flatId, idB: rows[j].flatId, similarity: sim });
    }
  }
  pairs.sort((a, b) => b.similarity - a.similarity);
  return pairs;
}

/**
 * @param {{ flatId: string, concept: object, partialLabel: string }[]} rows
 * @param {UnionFind} uf
 * @param {Map<string, number[]>} vectors
 */
export function materializeMergedConcepts(rows, uf, vectors) {
  /** @type {Map<string, object[]>} */
  const clusters = new Map();
  for (const row of rows) {
    const root = uf.find(row.flatId);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push({ ...row.concept, _partialLabel: row.partialLabel, _flatId: row.flatId });
  }

  const merged = [];
  for (const members of clusters.values()) {
    const concept = mergeConceptCluster(members);
    if (!concept) continue;
    const winner = members.find(
      (m) => String(m.source_phrase || "").length === String(concept.source_phrase || "").length,
    ) || members[0];
    const vec = vectors.get(winner._flatId);
    if (vec) concept._embedding = vec;
    const moduleName = String(concept.module || winner._partialLabel || "").trim();
    if (moduleName) concept.module = moduleName;
    merged.push(concept);
  }

  merged.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  return merged.map((c, i) => ({
    ...c,
    id: `c${i + 1}`,
    order: i + 1,
  }));
}

/**
 * @param {object[]} concepts
 */
export function conceptsToSinglePartial(concepts) {
  return [{ label: "Embed pre-merged", concepts: Array.isArray(concepts) ? concepts : [] }];
}
