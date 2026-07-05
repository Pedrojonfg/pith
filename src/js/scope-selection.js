/**
 * Universal document scope selection — scoped markdown derivation.
 * @see specs/20260705-document-scope-selection
 */

import { flattenHierarchy } from "./normalization/hierarchy.js";

/** Stable delimiter between non-contiguous scoped sections. */
export const SCOPE_SECTION_DELIMITER = "\n\n---\n\n";

function slugify(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

/**
 * Stable id for a hierarchy node (matches slow/headings.js scope picker).
 * @param {import("./normalization/types.js").HierarchyNode} node
 */
export function hierarchyNodeId(node) {
  return slugify(node?.title) || `hier-${node?.startOffset ?? 0}`;
}

/**
 * @param {import("./normalization/types.js").HierarchyNode[]} tree
 * @param {number} [maxLevel]
 * @returns {{ node: import("./normalization/types.js").HierarchyNode, id: string }[]}
 */
export function listSelectableHierarchyNodes(tree, maxLevel = 2) {
  const flat = flattenHierarchy(tree || [], maxLevel);
  return flat.map((node) => ({ node, id: hierarchyNodeId(node) }));
}

/**
 * @param {string[]} sectionIds
 * @param {string[]} orderedIds — document-order ids from listSelectableHierarchyNodes
 */
export function isContiguousSelection(sectionIds, orderedIds) {
  if (!sectionIds?.length || sectionIds.length === 1) return true;
  const indices = sectionIds
    .map((id) => orderedIds.indexOf(id))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
  if (indices.length !== sectionIds.length) return false;
  for (let i = 1; i < indices.length; i += 1) {
    if (indices[i] !== indices[i - 1] + 1) return false;
  }
  return true;
}

/**
 * Build scoped study markdown from hierarchy node selections.
 * @param {string} rawMarkdown
 * @param {{ tree?: import("./normalization/types.js").HierarchyNode[] } | null} docHierarchy
 * @param {string[]|null|undefined} sectionIds — null/empty = full document
 * @returns {{ scopedMarkdown: string, contiguous: boolean, orderedIds: string[] }}
 */
export function buildScopedMarkdown(rawMarkdown, docHierarchy, sectionIds) {
  const material = String(rawMarkdown || "");
  const ids = Array.isArray(sectionIds)
    ? sectionIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  if (!ids.length) {
    return { scopedMarkdown: material, contiguous: true, orderedIds: [] };
  }

  const entries = listSelectableHierarchyNodes(docHierarchy?.tree || []);
  const orderedIds = entries.map((e) => e.id);
  const byId = new Map(entries.map((e) => [e.id, e.node]));

  const selected = ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .sort((a, b) => a.startOffset - b.startOffset);

  if (!selected.length) {
    return { scopedMarkdown: material, contiguous: true, orderedIds: [] };
  }

  const parts = selected.map((node) =>
    material.slice(node.startOffset, node.endOffset).trim(),
  );
  const scopedMarkdown = parts.filter(Boolean).join(SCOPE_SECTION_DELIMITER);
  const contiguous = isContiguousSelection(ids, orderedIds);
  return { scopedMarkdown, contiguous, orderedIds };
}

/**
 * @param {string} rawMarkdown
 * @param {{ tree?: import("./normalization/types.js").HierarchyNode[] } | null} docHierarchy
 * @param {string[]|null|undefined} sectionIds
 * @returns {import("./session-types.js").ScopeSelection|null}
 */
export function buildScopeSelection(rawMarkdown, docHierarchy, sectionIds) {
  const ids = Array.isArray(sectionIds)
    ? sectionIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  if (!ids.length) return null;
  const { scopedMarkdown, contiguous } = buildScopedMarkdown(
    rawMarkdown,
    docHierarchy,
    ids,
  );
  return {
    sectionIds: ids,
    contiguous,
    selectedAt: Date.now(),
    charCount: scopedMarkdown.length,
  };
}
