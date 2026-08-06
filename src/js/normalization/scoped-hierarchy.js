/**
 * Scope-relative hierarchy ("mini-tree") for gated generation consumers.
 * Offsets are recomputed against concatenated scopedMarkdown (document order),
 * matching buildScopedMarkdown layout including SCOPE_SECTION_DELIMITER gaps.
 *
 * Tree shape: chosen selectable nodes as root siblings (flatten when selection
 * crosses unrelated branches — judgment call; consumers need correct offsets).
 * pedagogical_meta is copied from the full hierarchy (content descriptor, not position).
 */

import {
  hierarchyNodeId,
  listSelectableHierarchyNodes,
  SCOPE_SECTION_DELIMITER,
} from "../scope-selection.js";
import { isScopeGateResolved, resolveScopedMarkdown } from "../session-types.js";

/**
 * Ephemeral mini-tree (or full hierarchy) for gated consumers after scope resolve.
 * @param {unknown} session
 * @returns {{ tree?: import("./types.js").HierarchyNode[], pedagogical_meta?: object | null } | null}
 */
export function resolveScopedHierarchy(session) {
  if (!isScopeGateResolved(session)) return null;
  const sh = session?.shared;
  const docHierarchy = sh?.docHierarchy ?? null;
  const ids = sh?.scopeSelection?.sectionIds;
  // ponytail: recompute on read — no persisted scopedHierarchy
  if (Array.isArray(ids) && ids.length) {
    return buildScopedHierarchy(docHierarchy, ids, resolveScopedMarkdown(session));
  }
  return docHierarchy;
}

/**
 * @param {{ tree?: import("./types.js").HierarchyNode[], pedagogical_meta?: object, pedagogicalMeta?: object } | null | undefined} fullHierarchy
 * @param {string[]} chosenSectionIds
 * @param {string} scopedMarkdown
 * @returns {{ tree: import("./types.js").HierarchyNode[], pedagogical_meta: object | null }}
 */
export function buildScopedHierarchy(fullHierarchy, chosenSectionIds, scopedMarkdown) {
  const material = String(scopedMarkdown || "");
  const ids = Array.isArray(chosenSectionIds)
    ? chosenSectionIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const pedagogical_meta =
    fullHierarchy?.pedagogical_meta ||
    fullHierarchy?.pedagogicalMeta ||
    null;

  if (!ids.length) {
    const tree = Array.isArray(fullHierarchy?.tree)
      ? fullHierarchy.tree.map(cloneNodeShallow)
      : [];
    return { tree, pedagogical_meta };
  }

  const entries = listSelectableHierarchyNodes(fullHierarchy?.tree || []);
  const byId = new Map(entries.map((e) => [e.id, e.node]));

  // Document order — same sort as buildScopedMarkdown (not picker order)
  const selected = ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .sort((a, b) => a.startOffset - b.startOffset);

  if (!selected.length) {
    return { tree: [], pedagogical_meta };
  }

  /** @type {import("./types.js").HierarchyNode[]} */
  const tree = [];
  let cursor = 0;
  for (let i = 0; i < selected.length; i += 1) {
    const node = selected[i];
    const isLast = i === selected.length - 1;
    const startOffset = cursor;
    const endOffset = isLast
      ? material.length
      : (() => {
          const nextDelim = material.indexOf(SCOPE_SECTION_DELIMITER, cursor);
          return nextDelim < 0 ? material.length : nextDelim;
        })();
    tree.push({
      title: node.title,
      level: node.level,
      startOffset,
      endOffset,
      summary: node.summary,
      children: [],
      id: hierarchyNodeId(node),
    });
    cursor = endOffset + (isLast ? 0 : SCOPE_SECTION_DELIMITER.length);
  }

  return { tree, pedagogical_meta };
}

/**
 * @param {import("./types.js").HierarchyNode} node
 * @returns {import("./types.js").HierarchyNode}
 */
function cloneNodeShallow(node) {
  return {
    title: node.title,
    level: node.level,
    startOffset: node.startOffset,
    endOffset: node.endOffset,
    summary: node.summary,
    children: Array.isArray(node.children) ? node.children.map(cloneNodeShallow) : [],
  };
}
