# Spec: TOC-aware structure detection + hierarchical tree scope selection

**Folder:** `specs/20260807-toc-aware-hierarchical-scope/`
**Status:** Ready for implementation
**Supersedes:** Nothing directly. Extends `20260609-doc-hierarchy-index` and the scope-gating work landed 2026-08-06/07 (`scopeSelection` gate). Does not modify or invalidate those specs; this is additive.
**Depends on:** Current scope-gated-generation architecture (scope is resolved once per study session and immutable after confirmation — see 2026-08-06/07 decisions). This spec assumes that invariant holds and does not change it.

---

## 1. Context

Two independent-but-related problems, confirmed against live source via audit (2026-08-07):

1. **Structure detection is heuristic-first.** PDF bookmarks (`getOutline()`) are already extracted and partially used (`normalization/pdf-outline.js`, wired into `normalization/index.js`), but the override behavior is weak (`outlineHeavyPdf` only filters low-score heuristic candidates, it does not make the outline authoritative). A visible "Contents"/"Índice" text page is currently treated as noise or a heading label, never parsed into structure. HTML `<nav>`/`.toc` elements are discarded as boilerplate, never used as a structure source.

2. **`docHierarchy` is a nested tree with a hard depth cap of 3** (`level: 1|2|3`, enforced in the markdown heading regex, the LLM prompt, and `validateHierarchy`). The scope selection screen (`screenScopeSelection` / `scope-selection.js`) renders it as a **flat list capped at level 2**, with **no visual nesting, no expand/collapse, no cascading selection, and no partial (tri-state) selection**. Selection is stored as a flat `sectionIds: string[]` with no parent/child awareness — selecting a parent and a child today would **duplicate text** in the resulting `scopedMarkdown` (no dedup exists).

This spec fixes both, and introduces genuine tri-state hierarchical selection.

---

## 2. Non-goals

- No change to multi-document or cross-document scope (out of scope until multi-document sessions exist, per prior decision).
- No change to embeddings, vault curation, SM-2, or the concept registry.
- No reintroduction of `screenSlowScope` / `readingScope` (already removed; scope is unified under the single gate).
- No visual/design-system rework beyond what is needed to render an indented, collapsible tree with tri-state checkboxes using existing design tokens.
- No change to how non-contiguous scope reconstruction works structurally (mini-tree with recalculated offsets) — this spec changes *what feeds into* that reconstruction (tri-state selection instead of a flat id list), not the reconstruction mechanism itself.
- No background DPP, no cross-user caching, no prompt caching (tracked separately in `a_implementar`).

---

## 3. Data model changes

### 3.1 `HierarchyNode.level`

**R1.** Remove the `1|2|3` type constraint on `HierarchyNode.level`. It becomes an unbounded positive integer (`number`, ≥1). Update the JSDoc typedef in `normalization/types.js` accordingly.

**R2.** Update the deterministic markdown heading regex (currently effectively `^(#{1,3})\s+`) to capture **any** number of `#` characters (`^(#{1,6})\s+` is a reasonable practical ceiling matching CommonMark's own heading limit — flag to Cursor as an open question if a document plausibly needs more than 6, see §6).

**R3.** Update the LLM hierarchy-generation prompt to remove the "máximo level 3" instruction. Replace with an instruction to reflect the document's actual nesting depth, with no artificial ceiling.

**R4.** Update `validateHierarchy` / `validateSiblingGroup` to remove the `level` range check against `1..3`. Keep every other structural validation unchanged (offsets in range, first root `start === 0`, last root `end ≈ textLength`, sibling contiguity/non-overlap, `firstChild.start >= parent.start`, `lastChild.end <= parent.end`).

**R5.** Update every consumer that currently calls `flattenHierarchy(tree, 2)` or `listSelectableHierarchyNodes(tree, 2)` to pass no max level (or an explicit "no cap" sentinel) **only for the scope selection screen** (§4). Do not change the max-level argument for other consumers (Slow sidebar/reader/phase0, inventory chunking) unless a specific consumer is confirmed broken by deeper trees — audit each call site individually before touching it (see open question in §6).

### 3.2 Node provenance tag

**R6.** Add an optional `source` field to `HierarchyNode`: `'toc' | 'heuristic' | 'heuristic-unlisted'`.
- `'toc'`: node came from a matched TOC entry (PDF bookmark, parsed text-TOC entry, or HTML TOC entry).
- `'heuristic'`: node came from heading-inference scoring, and either no TOC exists or the node wasn't expected to appear in one.
- `'heuristic-unlisted'`: node was found by the heuristic **and** a TOC exists, but this specific heading is absent from the TOC (R11).

This field is not currently consumed by any UI — it is a placeholder for future work (e.g. visually flagging "unconfirmed" sections) and must not change current rendering behavior. Do not build UI for it in this spec.

### 3.3 `scopeSelection` storage format

**R7.** Replace the flat `sectionIds: string[]` + `contiguous: boolean` shape with:

```ts
type ScopeSelection = {
  fullyCheckedIds: string[];   // node ids whose ENTIRE subtree (own text + all descendants) is included as a single slice via [node.startOffset, node.endOffset)
  indeterminateIds: string[];  // node ids that are partially selected: only their own-text gaps are included (see R9); never re-descend into children here — checked children appear in fullyCheckedIds/indeterminateIds independently
  selectedAt: number;
  charCount: number;
};
```

`scopeSelection === null` continues to mean "entire document" (unchanged sentinel, unchanged behavior — do not touch this path).

**Invariant to enforce at write time:** no id in `fullyCheckedIds` may be a descendant of another id in `fullyCheckedIds` (a fully-checked ancestor already covers it — including it again would reintroduce the duplication bug this spec fixes). `indeterminateIds` may only contain ancestors of at least one `fullyCheckedIds`/`indeterminateIds` node, never a leaf (a leaf is binary: checked or unchecked, it cannot be indeterminate).

**R8.** New utility `computeNodeOwnTextSpans(node): Array<[number, number]>` — given `node.startOffset`, `node.endOffset`, and `node.children` (each with their own offsets), return the list of sub-ranges within the node's own range **not** covered by any direct child (text before the first child, gaps between children, text after the last child). This is purely structural and does not depend on selection state — compute it the same way regardless of which children are checked. Per the hierarchy audit, gaps are expected and already tolerated by `validateHierarchy` (parent range may exceed the union of children), so this utility must handle zero, one, or multiple gaps.

**R9.** Update `buildScopedMarkdown` to consume the new `ScopeSelection` shape:
1. For each id in `fullyCheckedIds`: emit one slice `[node.startOffset, node.endOffset)`.
2. For each id in `indeterminateIds`: emit one slice per span returned by `computeNodeOwnTextSpans(node)`.
3. Collect all emitted spans across both sets, sort by start offset, and join with the existing `SCOPE_SECTION_DELIMITER` in document order (do not assume caller order matches document order).
4. Add a defensive assertion (dev-only, non-fatal in production) that no two spans overlap — this should be structurally impossible given the invariant in R7, but the assertion catches regressions cheaply.

**R10.** Backward compatibility: any already-persisted `DocumentSession` with the **old** `scopeSelection.sectionIds` shape must continue to render/resume correctly. On read, if `sectionIds` is present and `fullyCheckedIds`/`indeterminateIds` are absent, treat every id in `sectionIds` as `fullyCheckedIds` (this preserves old semantics exactly, including the old duplication bug for any session that happens to have both a parent and child id in the old array — do not attempt to "fix" old data, just don't crash on it). Do not write the old shape again after this spec ships; this is read-only compatibility, not a dual-write scheme.

---

## 4. Scope selection UI (`screenScopeSelection` / `scope-selection.js`)

**R11.** Replace the flat `<li>` list rendering in `renderScopeSelectionScreen` with a recursive nested tree: each `HierarchyNode` renders itself, then (if it has children and is expanded) recurses into a nested `<ul>`. Use existing design tokens (spacing scale, border colors) for indentation — no new visual language needed, just per-depth left padding.

**R12.** Expand/collapse: every node with children gets a chevron/disclosure control. Default state on screen entry: depth-1 nodes expanded, everything deeper collapsed. Named placeholder constant: `SCOPE_TREE_DEFAULT_EXPANDED_LEVEL = 1`. Collapse state is transient UI state (not persisted to `scopeSelection`), reset each time the screen is entered.

**R13.** Tri-state checkbox behavior (no existing pattern in the codebase to reuse — confirmed by audit, build from scratch using the native `input.indeterminate` boolean property, since CSS-only approaches don't cover the actual DOM checkbox state):
- Clicking an **unchecked** node: mark it and **all descendants** checked (cascade down). Recompute all ancestors upward (R14).
- Clicking a **checked** node: mark it and **all descendants** unchecked (cascade down). Recompute all ancestors upward.
- Clicking an **indeterminate** node: treat as clicking checked (i.e. go to fully-checked, cascade down to check everything). This matches the common tri-state-checkbox convention (indeterminate → checked → unchecked on successive clicks) and avoids a confusing three-way click cycle.

**R14.** Ancestor recomputation (run bottom-up after any toggle): for each ancestor of the toggled node, inspect its direct children's states:
- All children checked AND own-text is by definition always included when fully checked → ancestor becomes **checked**.
- All children unchecked → ancestor becomes **unchecked** (unless the ancestor itself was directly toggled to checked with no children yet evaluated — direct toggles always win, this rule only applies when propagating from below).
- Mixed (some checked/indeterminate, some unchecked) → ancestor becomes **indeterminate**.

**R15.** On confirming scope, translate the UI's per-node checked/indeterminate/unchecked state into `ScopeSelection.fullyCheckedIds` / `indeterminateIds` per the invariant in R7 (walk the tree once, top-down; the moment you hit a `checked` node, add it to `fullyCheckedIds` and do not recurse into its subtree further; if you hit `indeterminate`, add it to `indeterminateIds` and continue recursing into its children).

**R16.** "Entire document" control: keep existing behavior and sentinel (`scopeSelection = null`) unchanged. Do not reimplement it in terms of tri-state ids.

---

## 5. TOC detection

**R17.** PDF bookmark confidence upgrade: modify the `outlineHeavyPdf` logic in `infer-headings.js` so that when outline coverage exceeds `OUTLINE_HIGH_CONFIDENCE_COVERAGE` (named placeholder constant, default `0.5`, unvalidated — calibrate post-launch per project convention), the outline becomes **authoritative**: outline-matched entries define structure, order, and titles directly; heuristic-only candidates are only used to fill gaps (headings the outline doesn't mention — tagged `heuristic-unlisted` per R6), never to override or reorder outline entries. Below the threshold, keep current weaker filtering behavior unchanged.

**R18.** New text-TOC page parser (new module, e.g. `normalization/toc-page.js`):
1. Detect a candidate TOC page: a block whose text matches `TOC_TEXT_PAGE_TITLE_PATTERNS` (named placeholder constant — minimum set: `/^(contents|table of contents)$/i`, `/^(índice|indice|sumario)$/i`).
2. Parse subsequent lines on that page (and immediately following pages, since TOCs can span multiple pages) as entries: title + dot-leaders/tab + page number, or title + page number with no leader. Reuse the numbered/roman-numeral pattern detection already present in `infer-headings.js` where applicable rather than duplicating it.
3. Feed parsed entries through the **same matching mechanism** used for PDF bookmarks today (`matchOutlineToBlocks` or a generalized version of it — see open question in §6) to anchor each entry to its actual position in the extracted body blocks.
4. This path only runs when no PDF outline was found, or PDF outline coverage was below `OUTLINE_HIGH_CONFIDENCE_COVERAGE` (i.e. text-TOC is the fallback, per the "metadata primero" decision — never runs in preference to a high-confidence PDF outline).

**R19.** HTML TOC as structure source: before `isHtmlBoilerplateElement` drops a `nav`/`#toc`/`.toc` element, extract its `<a>` entries (text content + `href` fragment if present) as candidate outline entries, run them through the same matching mechanism as R18.3, then proceed to drop the nav block from body content as today (the TOC block itself is still chrome, it's just no longer *ignored as a structure signal* before being dropped).

**R20.** Extra headings found by the heuristic but absent from any detected TOC (PDF bookmark, text-TOC, or HTML TOC) are still inserted into the tree as best-effort nodes, tagged `source: 'heuristic-unlisted'` (R6). Do not drop them.

---

## 6. Open questions for Cursor to resolve via repo inspection before coding

- Grep every consumer of `HierarchyNode.level` for any equality/range check against `1`, `2`, or `3` (e.g. CSS class selection, conditional rendering) that would silently misbehave once level 4+ nodes exist, beyond the `flattenHierarchy(..., 2)` call sites already identified in the audit. List them before starting R5.
- Confirm the exact current signature and matching strategy of `matchOutlineToBlocks` (fuzzy match tolerance, normalization applied to titles) to determine whether it can be called directly for R18/R19, or needs a small generalization (e.g. accepting entries without page numbers, since HTML TOC entries won't have them).
- Query/estimate how many currently-active (non-completed) sessions have a non-null `scopeSelection` in the old flat format, to confirm the backward-compat read path in R10 is low-risk and doesn't need a data migration script.
- Confirm current CSS class names and structure of `.scope-selection-list` / `.scope-selection-item` to decide whether R11's nested tree extends the existing stylesheet block or needs a new one alongside it.
- Confirm whether raising the markdown heading regex cap to `#{1,6}` (R2) could pick up false positives in any document type currently in test fixtures (e.g. code blocks with `#` comments) — if so, propose a narrower cap and flag back before implementing.

---

## 7. Implementation sequence (risk-ordered)

1. **R1–R4**: Remove the hard depth-3 cap across types, regex, LLM prompt, and validation. Get existing hierarchy test fixtures passing standalone with deeper trees before touching anything downstream. Highest risk — this is the structural foundation everything else depends on.
2. **R8–R10**: New `computeNodeOwnTextSpans` utility + rewritten `buildScopedMarkdown` consuming the new `ScopeSelection` shape, with backward-compat read path. Second-highest risk — this is the core data/behavior change.
3. **R6, R17–R20**: TOC detection improvements (outline confidence upgrade, text-TOC parser, HTML TOC extraction, unlisted-heading tagging). Additive and relatively isolated from the tree/UI changes — safe to parallelize with step 4 once steps 1–2 are stable.
4. **R11–R16**: Scope selection screen rewrite (nested tree, expand/collapse, tri-state cascade, translation to `ScopeSelection` on confirm). Depends on steps 1–2 being complete and stable.
5. **R5**: Update `flattenHierarchy`/`listSelectableHierarchyNodes` call sites to drop the level-2 cap, scoped strictly to the scope selection screen per the open question in §6 — do this last, after confirming via the grep in §6 that no other consumer breaks.

---

## 8. Named placeholder constants (unvalidated, calibrate post-launch)

| Constant | Default | Used in |
|---|---|---|
| `OUTLINE_HIGH_CONFIDENCE_COVERAGE` | `0.5` | R17 |
| `TOC_TEXT_PAGE_TITLE_PATTERNS` | EN/ES set listed in R18.1 | R18 |
| `SCOPE_TREE_DEFAULT_EXPANDED_LEVEL` | `1` | R12 |
