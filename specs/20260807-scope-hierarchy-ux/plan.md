# Implementation Plan: Hierarchical Scope Selection UX

**Branch**: `20260807-scope-hierarchy-ux` | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260807-scope-hierarchy-ux/spec.md` (audit of flat `screenScopeSelection`)

## Summary

Upgrade `screenScopeSelection` from a flat checkbox list to a nested L1/L2 picker with expand/collapse, parent↔child cascade, indeterminate (mixed) parent state, canonical parent-only persistence when fully selected, and range-dedupe in `buildScopedMarkdown` so parent+child overlap cannot double-count text. Gate timing and `ScopeSelection` shape stay unchanged.

## Technical Context

**Language/Version**: Vanilla JS ES modules (browser PWA)  
**Primary Dependencies**: `scope-selection.js`, `study.js`, `normalization/hierarchy.js`, `main.css` / `slow-mode.css`, `index.html`  
**Storage**: Existing `doc.shared.scopeSelection` (`sectionIds[]` | null) — no schema bump  
**Testing**: `cursor-tests/*.mjs` unit + integration  
**Target Platform**: Browser PWA  
**Project Type**: Single-page PWA (`src/js`, `index.html`, `src/css`)  
**Performance Goals**: Picker render O(n) for selectable nodes (n typically ≪ 200)  
**Constraints**: English UI; DESIGN.md full-bleed (no new card chrome); SW bump on asset change; maxLevel remains 2  
**Scale/Scope**: ~4–6 source files + tests; pure helpers in `scope-selection.js`; UI in `study.js`

## Constitution Check

Constitution file is a placeholder; gates from `.cursorrules` / project practice:

| Gate | Status |
|------|--------|
| English UI / LLM heuristics | PASS (UI strings English; no new LLM) |
| PWA SW versioning | PASS (final QA bumps `SW_VERSION` + `?v=`) |
| LLM JSON max_tokens | N/A |
| UI necessity / DESIGN.md | PASS (nesting/cascade/mixed are necessary for FR; no decorative chrome) |
| Mnemonic devices LLM | N/A |

Post-design re-check: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/20260807-scope-hierarchy-ux/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── selectable-tree.md
│   ├── selection-normalize.md
│   └── scope-picker-ui.md
└── checklists/requirements.md
```

### Source Code (touch list)

```text
src/js/scope-selection.js     # selectable tree; normalize ids; dedupe ranges in buildScopedMarkdown
src/js/study.js               # render nested list; expand/collapse; cascade; indeterminate; confirm uses normalize
src/css/main.css              # indent + expand control styles (primary)
src/css/slow-mode.css         # align duplicate scope-selection rules if still present
index.html                    # aria tweaks only if needed (listbox → tree/group)
src/js/sw-update.js           # SW_VERSION bump (QA task)
index.html                    # ?v= on sw-update.js + main.js (QA task)
cursor-tests/20260807_scope-hierarchy-*.mjs
```

**Structure Decision**: Keep persistence in existing module; add pure tree/normalize/dedupe helpers next to `listSelectableHierarchyNodes`; UI stays in `study.js` (same as current gate). Do not revive `screenSlowScope`.

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected |
|-----------|------------|------------------------------|
| Selectable tree helper (vs flat list + level CSS only) | `flattenHierarchy` strips `children`; cascade/mixed need parent→child edges | Indent-only flat list cannot cascade or compute mixed correctly |
| Normalize before persist | Parent+all-children vs parent-only must round-trip to same UI | Persist raw Set causes overlap and ambiguous reload |
