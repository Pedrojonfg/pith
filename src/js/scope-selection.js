/**
 * Universal document scope selection — scoped markdown derivation.
 * @see specs/20260705-document-scope-selection
 * @see specs/20260807-toc-aware-hierarchical-scope/spec.md
 */

/** Stable delimiter between non-contiguous scoped sections. */
export const SCOPE_SECTION_DELIMITER = "\n\n---\n\n";

/**
 * @typedef {{ id: string, node: import("./normalization/types.js").HierarchyNode, children: SelectableHierarchyNode[] }} SelectableHierarchyNode
 */

/**
 * @typedef {{ fullyCheckedIds: string[], indeterminateIds: string[], selectedAt?: number, charCount?: number }} ScopeSelectionInput
 */

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
 * Sub-ranges of node not covered by any direct child (own-text gaps).
 * @param {import("./normalization/types.js").HierarchyNode} node
 * @returns {Array<[number, number]>}
 */
export function computeNodeOwnTextSpans(node) {
  const start = Number(node?.startOffset) || 0;
  const end = Number(node?.endOffset) || 0;
  if (end <= start) return [];
  const children = Array.isArray(node?.children) ? [...node.children] : [];
  children.sort((a, b) => a.startOffset - b.startOffset);
  /** @type {Array<[number, number]>} */
  const spans = [];
  let cursor = start;
  for (const child of children) {
    const cs = Number(child.startOffset) || 0;
    const ce = Number(child.endOffset) || 0;
    if (cs > cursor) spans.push([cursor, Math.min(cs, end)]);
    cursor = Math.max(cursor, Math.min(ce, end));
  }
  if (cursor < end) spans.push([cursor, end]);
  return spans.filter(([a, b]) => b > a);
}

/**
 * Index all hierarchy nodes by id (unlimited depth).
 * @param {import("./normalization/types.js").HierarchyNode[]} tree
 * @returns {Map<string, import("./normalization/types.js").HierarchyNode>}
 */
export function indexHierarchyNodesById(tree) {
  /** @type {Map<string, import("./normalization/types.js").HierarchyNode>} */
  const byId = new Map();
  /** @param {import("./normalization/types.js").HierarchyNode[]} nodes */
  function walk(nodes) {
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (!node) continue;
      byId.set(hierarchyNodeId(node), node);
      if (Array.isArray(node.children)) walk(node.children);
    }
  }
  walk(tree || []);
  return byId;
}

/**
 * Coerce legacy sectionIds[] / old ScopeSelection / new shape → canonical ids.
 * R10: sectionIds → fullyCheckedIds (preserve old semantics, including duplication).
 * @param {unknown} selection
 * @returns {{ fullyCheckedIds: string[], indeterminateIds: string[] } | null}
 */
export function coerceScopeSelectionIds(selection) {
  if (selection == null) return null;
  if (Array.isArray(selection)) {
    const fullyCheckedIds = selection.map((id) => String(id).trim()).filter(Boolean);
    return fullyCheckedIds.length ? { fullyCheckedIds, indeterminateIds: [] } : null;
  }
  if (typeof selection !== "object") return null;
  const raw = /** @type {Record<string, unknown>} */ (selection);
  let fullyCheckedIds = Array.isArray(raw.fullyCheckedIds)
    ? raw.fullyCheckedIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  let indeterminateIds = Array.isArray(raw.indeterminateIds)
    ? raw.indeterminateIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  if (!fullyCheckedIds.length && !indeterminateIds.length && Array.isArray(raw.sectionIds)) {
    fullyCheckedIds = raw.sectionIds.map((id) => String(id).trim()).filter(Boolean);
    indeterminateIds = [];
  }
  if (!fullyCheckedIds.length && !indeterminateIds.length) return null;
  return { fullyCheckedIds, indeterminateIds };
}

/**
 * @param {Array<[number, number]>} spans
 */
function assertNoOverlapDev(spans) {
  for (let i = 1; i < spans.length; i += 1) {
    if (spans[i][0] < spans[i - 1][1]) {
      console.warn("[scope] overlapping scoped spans (should be impossible):", spans[i - 1], spans[i]);
      break;
    }
  }
}

/**
 * Build scoped study markdown from tri-state ScopeSelection (R9) or legacy ids (R10).
 * @param {string} rawMarkdown
 * @param {{ tree?: import("./normalization/types.js").HierarchyNode[] } | null} docHierarchy
 * @param {unknown} selection — ScopeSelection | string[] sectionIds | null
 * @returns {{ scopedMarkdown: string, fullyCheckedIds: string[], indeterminateIds: string[] }}
 */
export function buildScopedMarkdown(rawMarkdown, docHierarchy, selection) {
  const material = String(rawMarkdown || "");
  const ids = coerceScopeSelectionIds(selection);
  if (!ids) {
    return { scopedMarkdown: material, fullyCheckedIds: [], indeterminateIds: [] };
  }

  const byId = indexHierarchyNodesById(docHierarchy?.tree || []);
  /** @type {Array<[number, number]>} */
  const spans = [];

  for (const id of ids.fullyCheckedIds) {
    const node = byId.get(id);
    if (!node) continue;
    spans.push([node.startOffset, node.endOffset]);
  }
  for (const id of ids.indeterminateIds) {
    const node = byId.get(id);
    if (!node) continue;
    for (const span of computeNodeOwnTextSpans(node)) spans.push(span);
  }

  spans.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  assertNoOverlapDev(spans);

  if (!spans.length) {
    return {
      scopedMarkdown: material,
      fullyCheckedIds: ids.fullyCheckedIds,
      indeterminateIds: ids.indeterminateIds,
    };
  }

  const parts = spans.map(([a, b]) => material.slice(a, b).trim());
  const scopedMarkdown = parts.filter(Boolean).join(SCOPE_SECTION_DELIMITER);
  return {
    scopedMarkdown,
    fullyCheckedIds: ids.fullyCheckedIds,
    indeterminateIds: ids.indeterminateIds,
  };
}

/**
 * @param {string} rawMarkdown
 * @param {{ tree?: import("./normalization/types.js").HierarchyNode[] } | null} docHierarchy
 * @param {unknown} selection
 * @returns {import("./session-types.js").ScopeSelection|null}
 */
export function buildScopeSelection(rawMarkdown, docHierarchy, selection) {
  const ids = coerceScopeSelectionIds(selection);
  if (!ids) return null;
  const { scopedMarkdown, fullyCheckedIds, indeterminateIds } = buildScopedMarkdown(
    rawMarkdown,
    docHierarchy,
    ids,
  );
  if (!fullyCheckedIds.length && !indeterminateIds.length) return null;
  return {
    fullyCheckedIds,
    indeterminateIds,
    selectedAt: Date.now(),
    charCount: scopedMarkdown.length,
  };
}

/**
 * Selectable tree with parent→child edges.
 * @param {import("./normalization/types.js").HierarchyNode[]} tree
 * @param {number|null|undefined} [maxLevel] — null/undefined/Infinity = no cap (R5); default 2 until R5
 * @returns {SelectableHierarchyNode[]}
 */
export function listSelectableHierarchyTree(tree, maxLevel = 2) {
  const uncapped =
    maxLevel == null || maxLevel === Infinity || Number(maxLevel) <= 0;
  const cap = uncapped ? Infinity : Math.max(1, Number(maxLevel) || 2);
  /** @param {import("./normalization/types.js").HierarchyNode[]} nodes */
  function walk(nodes) {
    /** @type {SelectableHierarchyNode[]} */
    const out = [];
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (!node || typeof node.level !== "number") continue;
      if (node.level > cap) continue;
      const children = walk(node.children || []);
      out.push({
        id: hierarchyNodeId(node),
        node: {
          title: node.title,
          level: node.level,
          startOffset: node.startOffset,
          endOffset: node.endOffset,
          summary: node.summary,
          source: node.source,
          children: [],
        },
        children,
      });
    }
    return out;
  }
  return walk(tree || []);
}

/**
 * @param {SelectableHierarchyNode[]} roots
 */
function flattenSelectableTree(roots) {
  /** @type {{ node: import("./normalization/types.js").HierarchyNode, id: string }[]} */
  const out = [];
  /** @param {SelectableHierarchyNode[]} nodes */
  function walk(nodes) {
    for (const entry of nodes) {
      out.push({ node: entry.node, id: entry.id });
      if (entry.children?.length) walk(entry.children);
    }
  }
  walk(roots || []);
  return out;
}

/**
 * @param {import("./normalization/types.js").HierarchyNode[]} tree
 * @param {number|null|undefined} [maxLevel]
 */
export function listSelectableHierarchyNodes(tree, maxLevel = 2) {
  return flattenSelectableTree(listSelectableHierarchyTree(tree, maxLevel));
}

/**
 * @param {SelectableHierarchyNode[]} roots
 */
function indexSelectableTree(roots) {
  /** @type {Map<string, SelectableHierarchyNode>} */
  const byId = new Map();
  /** @param {SelectableHierarchyNode[]} nodes */
  function walk(nodes) {
    for (const entry of nodes) {
      byId.set(entry.id, entry);
      if (entry.children?.length) walk(entry.children);
    }
  }
  walk(roots || []);
  return byId;
}

/**
 * @param {SelectableHierarchyNode} entry
 */
function descendantIds(entry) {
  /** @type {string[]} */
  const out = [];
  /** @param {SelectableHierarchyNode[]} nodes */
  function walk(nodes) {
    for (const child of nodes) {
      out.push(child.id);
      if (child.children?.length) walk(child.children);
    }
  }
  walk(entry.children || []);
  return out;
}

/** @deprecated Prefer tri-state ScopeSelection; kept for transitional UI helpers. */
export function normalizeScopeSectionIds(sectionIds, tree, maxLevel = 2) {
  const rawIds = Array.isArray(sectionIds)
    ? sectionIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  if (!rawIds.length) return [];
  const roots = listSelectableHierarchyTree(tree || [], maxLevel);
  const byId = indexSelectableTree(roots);
  const selected = new Set([...rawIds].filter((id) => byId.has(id)));
  for (const id of [...selected]) {
    const entry = byId.get(id);
    if (!entry) continue;
    for (const d of descendantIds(entry)) selected.delete(d);
  }
  function promote(nodes) {
    for (const entry of nodes) {
      if (entry.children?.length) promote(entry.children);
      const desc = descendantIds(entry);
      if (!desc.length || selected.has(entry.id)) continue;
      if (desc.every((d) => selected.has(d))) {
        for (const d of desc) selected.delete(d);
        selected.add(entry.id);
      }
    }
  }
  promote(roots);
  return [...selected]
    .map((id) => byId.get(id))
    .filter(Boolean)
    .sort((a, b) => a.node.startOffset - b.node.startOffset)
    .map((e) => e.id);
}

/** @deprecated */
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

export function expandScopeSelectionForUi(sectionIds, tree) {
  const roots = listSelectableHierarchyTree(tree || []);
  const byId = indexSelectableTree(roots);
  const set = new Set();
  for (const id of normalizeScopeSectionIds(sectionIds, tree || [])) {
    set.add(id);
    const entry = byId.get(id);
    if (entry) for (const d of descendantIds(entry)) set.add(d);
  }
  return set;
}

export function getScopeRowSelectionState(entry, selectedIds, fullDocument) {
  if (fullDocument) return { checked: true, indeterminate: false };
  const selected =
    selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  if (selected.has(entry.id)) return { checked: true, indeterminate: false };
  const desc = descendantIds(entry);
  if (!desc.length) return { checked: false, indeterminate: false };
  const n = desc.filter((id) => selected.has(id)).length;
  if (n === 0) return { checked: false, indeterminate: false };
  if (n === desc.length) return { checked: true, indeterminate: false };
  return { checked: false, indeterminate: true };
}

export function scopeCascadeIds(entry) {
  return [entry.id, ...descendantIds(entry)];
}

/** R12 — depth-1 expanded by default on scope screen entry. */
export const SCOPE_TREE_DEFAULT_EXPANDED_LEVEL = 1;

/**
 * @param {SelectableHierarchyNode[]} roots
 * @param {number} [maxExpandedLevel]
 * @returns {Set<string>}
 */
export function defaultExpandedScopeIds(roots, maxExpandedLevel = SCOPE_TREE_DEFAULT_EXPANDED_LEVEL) {
  const out = new Set();
  /** @param {SelectableHierarchyNode[]} nodes */
  function walk(nodes) {
    for (const entry of nodes || []) {
      if (entry.node.level <= maxExpandedLevel && entry.children?.length) {
        out.add(entry.id);
      }
      walk(entry.children || []);
    }
  }
  walk(roots);
  return out;
}

/**
 * @typedef {'checked'|'unchecked'|'indeterminate'} ScopeUiNodeState
 */

/**
 * Seed UI state from persisted ScopeSelection (or legacy sectionIds via coerce).
 * @param {SelectableHierarchyNode[]} roots
 * @param {unknown} scopeSelection
 * @returns {Map<string, ScopeUiNodeState>}
 */
export function scopeSelectionToUiState(roots, scopeSelection) {
  /** @type {Map<string, ScopeUiNodeState>} */
  const state = new Map();
  /** @param {SelectableHierarchyNode[]} nodes */
  function initUnchecked(nodes) {
    for (const e of nodes || []) {
      state.set(e.id, "unchecked");
      initUnchecked(e.children || []);
    }
  }
  initUnchecked(roots);

  const ids = coerceScopeSelectionIds(scopeSelection);
  if (!ids) return state;

  const byId = indexSelectableTree(roots);
  for (const id of ids.fullyCheckedIds) {
    const entry = byId.get(id);
    if (!entry) continue;
    for (const cid of scopeCascadeIds(entry)) state.set(cid, "checked");
  }
  for (const id of ids.indeterminateIds) {
    if (state.get(id) !== "checked") state.set(id, "indeterminate");
  }
  recomputeScopeAncestorStates(roots, state);
  return state;
}

/**
 * R14 — bottom-up ancestor recompute from direct children.
 * @param {SelectableHierarchyNode[]} roots
 * @param {Map<string, ScopeUiNodeState>} state
 */
export function recomputeScopeAncestorStates(roots, state) {
  /** @param {SelectableHierarchyNode} entry */
  function walk(entry) {
    for (const child of entry.children || []) walk(child);
    if (!entry.children?.length) return;
    const childStates = entry.children.map((c) => state.get(c.id) || "unchecked");
    if (childStates.every((s) => s === "checked")) state.set(entry.id, "checked");
    else if (childStates.every((s) => s === "unchecked")) {
      // Keep direct checked if somehow set without children eval — only clear when all unchecked
      if (state.get(entry.id) !== "checked" || childStates.length > 0) {
        // If all children unchecked, ancestor unchecked unless it was a leaf-less direct check
        // Spec: all children unchecked → ancestor unchecked
        state.set(entry.id, "unchecked");
      }
    } else {
      state.set(entry.id, "indeterminate");
    }
  }
  for (const root of roots || []) walk(root);
}

/**
 * Cascade toggle (R13). Indeterminate treated as → checked.
 * @param {SelectableHierarchyNode} entry
 * @param {Map<string, ScopeUiNodeState>} state
 * @param {SelectableHierarchyNode[]} roots
 */
export function toggleScopeNode(entry, state, roots) {
  const cur = state.get(entry.id) || "unchecked";
  const next = cur === "checked" ? "unchecked" : "checked";
  for (const id of scopeCascadeIds(entry)) state.set(id, next);
  recomputeScopeAncestorStates(roots, state);
}

/**
 * R15 — UI state → persisted ScopeSelection ids (top-down).
 * @param {SelectableHierarchyNode[]} roots
 * @param {Map<string, ScopeUiNodeState>} state
 * @returns {{ fullyCheckedIds: string[], indeterminateIds: string[] }}
 */
export function uiStateToScopeSelectionIds(roots, state) {
  /** @type {string[]} */
  const fullyCheckedIds = [];
  /** @type {string[]} */
  const indeterminateIds = [];
  /** @param {SelectableHierarchyNode[]} nodes */
  function walk(nodes) {
    for (const entry of nodes || []) {
      const s = state.get(entry.id) || "unchecked";
      if (s === "checked") {
        fullyCheckedIds.push(entry.id);
        continue; // do not recurse
      }
      if (s === "indeterminate") {
        indeterminateIds.push(entry.id);
        walk(entry.children || []);
        continue;
      }
      // unchecked: skip subtree
    }
  }
  walk(roots);
  return { fullyCheckedIds, indeterminateIds };
}
