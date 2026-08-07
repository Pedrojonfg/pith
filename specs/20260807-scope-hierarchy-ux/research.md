# Research: Hierarchical Scope Selection UX

## R1 — How to recover parent/child edges for the picker

**Decision**: Add `listSelectableHierarchyTree(tree, maxLevel = 2)` that walks the real hierarchy, keeps nodes with `level <= maxLevel`, and preserves `children` arrays filtered to selectable descendants. Keep `listSelectableHierarchyNodes` as a flatten of that tree (or equivalent) for ordered ids / contiguous checks.

**Rationale**: Current `flattenHierarchy` explicitly sets `children: []`, so the flat picker cannot cascade or compute mixed state from structure alone. Level-based “indent only” is insufficient for FR-003/FR-004.

**Alternatives considered**:
- Infer parent from BFS order + level stack without storing children — works but reimplements tree logic in UI.
- Raise flattenHierarchy to keep children — wider blast radius for Slow/other consumers; out of scope.

## R2 — Persistence canonicalization

**Decision**: Before persist and before `buildScopedMarkdown` / char count, run `normalizeScopeSectionIds(selectedIds, treeEntries)`:
1. If a parent id is selected, drop all descendant ids that fall under that parent.
2. If every selectable child of a parent is selected and the parent is not, replace the child set with the parent id alone (promote).
3. Preserve document order of remaining ids.

**Rationale**: FR-008 + audit note that parent range covers children; storing both duplicates text unless deduped. Parent-only storage restores a fully checked parent on reload.

**Alternatives considered**:
- Always store leaves only — loses “whole chapter” semantics and makes char count depend on child coverage gaps.
- Store both and only dedupe at slice time — reload shows children checked and parent mixed/full inconsistently.

## R3 — Range dedupe in `buildScopedMarkdown`

**Decision**: After resolving selected nodes to ranges, merge/drop overlaps: sort by `startOffset`, skip any range fully covered by a previous kept range; if partial overlap occurs (should be rare with hierarchy), merge to union. Join remaining slices with `SCOPE_SECTION_DELIMITER`.

**Rationale**: Defense in depth if callers pass non-normalized ids (legacy sessions, tests).

**Alternatives considered**: Trust normalize-only — brittle if any call site skips normalize.

## R4 — Indeterminate / mixed UI

**Decision**: Use native `HTMLInputElement.indeterminate = true` with `checked = false` for mixed parents; set `aria-checked="mixed"` on the checkbox when mixed. Clear indeterminate when fully checked or unchecked.

**Rationale**: Spec assumes platform indeterminate; no other pattern exists in repo (audit confirmed).

**Alternatives considered**: Custom “−” icon without indeterminate — more CSS, worse a11y.

## R5 — Expand/collapse defaults

**Decision**: Ephemeral `scopePickerExpandedIds` Set; on each `renderScopeSelectionScreen`, start empty (all parents collapsed). Toggle button on parents with children only. Collapsing does not change selection.

**Rationale**: Matches historical Slow contract (L2 collapsed by default) and FR-002.

**Alternatives considered**: Persist expand state in session — YAGNI for one-shot gate.

## R6 — Full-document interaction with cascade

**Decision**: Keep existing full-doc boolean. Leaving full-doc still seeds the Set with all ordered selectable ids, then applies the user toggle. Cascade operates on the Set afterward. Promote-to-full-doc when normalized selection covers all top-level selectable coverage equivalent to all ordered ids (same as today: every ordered id selected, or simpler: every ordered id present in the working Set before normalize).

**Rationale**: Minimal behavior change for FR-010.

## R7 — CSS / DESIGN

**Decision**: Indent via `--scope-level` or `padding-inline-start` by level; expand control as a small button before checkbox; do not wrap list in a card. Prefer `main.css` as source of truth; trim conflicting `slow-mode.css` card rules if they fight full-bleed.

**Rationale**: FR-012 + DESIGN “screens are never cards”.
