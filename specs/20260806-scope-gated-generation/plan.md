# Implementation Plan: Scope-Gated Generation

**Branch**: `20260725-scope-gated-generation` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260806-scope-gated-generation/spec.md` + source brief `20260806-scope-gated-generation.md`

## Summary

Fix create-session early scope stop (`stopAfterScopeGate` forwarding); disambiguate unresolved vs entire-document scoped text; hard-gate Tier-1.2+ / Tier-2 / assessment (incl. T1.3) until `scopeResolvedAt`; add `buildScopedHierarchy` mini-tree and wire offset consumers; flip hardcoded full-doc consumers; remove `screenSlowScope`/`readingScope`; auto-decide Slow modifiers; add Slow in-reader nav; keep export label working via section titles.

## Technical Context

**Language/Version**: Vanilla JS ES modules (browser PWA)  
**Primary Dependencies**: `document-preparation.js`, `session-types.js`, `session-store.js`, `scope-selection.js`, `study.js`, Slow/Cloze/Recall modules, `api.js`  
**Storage**: Document session persistence (schema v4 additive; prefer ephemeral mini-tree recompute)  
**Testing**: `cursor-tests/*.mjs` unit + integration  
**Target Platform**: Browser PWA  
**Project Type**: Single-page PWA (`src/js`, `index.html`, `src/css`)  
**Performance Goals**: Scope UI after T1.1 only (no full DPP before gate)  
**Constraints**: English UI/prompts; SW bump on asset change; no PHASE_DEPS churn for T1.5; guide dual-context preserved  
**Scale/Scope**: ~15 modules touched; 1 new pure module; Slow UI deletion + nav addition

## Constitution Check

Constitution placeholder; gates from `.cursorrules` / project practice:

| Gate | Status |
|------|--------|
| English UI / LLM heuristics | PASS |
| PWA SW versioning | PASS (final QA bumps) |
| LLM JSON max_tokens | N/A (no new large JSON LLM) |
| UI necessity / DESIGN.md | PASS (remove screen; nav is necessary) |
| Mnemonic devices LLM | N/A |

Post-design re-check: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/20260806-scope-gated-generation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── scope-gate.md
│   ├── scoped-hierarchy.md
│   ├── gated-phases.md
│   └── slow-removal.md
└── checklists/requirements.md
```

### Source Code (touch list)

```text
src/js/study.js                          # forward stopAfterScopeGate; assessment text; Slow redirects; modifiers
src/js/document-preparation.js           # hard gate, fingerprint, sparsity, T2.3 scopeKey, ensure*
src/js/session-types.js                  # resolveScopedMarkdown gate-first
src/js/session-store.js                  # no seed; no inventory→resolved migration
src/js/mode-bootstrap.js                 # remove rawMarkdown content fallback
src/js/scope-selection.js                # optional sectionIds normalize; used by mini-tree
src/js/normalization/scoped-hierarchy.js # NEW buildScopedHierarchy
src/js/api.js                            # inventory chunks mini-tree
src/js/concept-anchoring.js              # scoped text
src/js/recall-study.js / recall-api.js   # scoped text + length
src/js/cloze/pipeline.js                 # verify skip/reuse (minimal)
src/js/slow/phase0.js, reader.js, checkpoints.js, annotations.js, ai-context.js
src/js/export.js / export-format.js      # title-list label
src/js/ui.js / index.html / main.css     # remove Slow scope; nav chrome
src/js/recommendation/onboarding-recommender.js # countScopedImages reuse
cursor-tests/20260806_*.mjs
sw-update.js / sw.js / index.html ?v=    # final bump
```

**Structure Decision**: Extend existing scope + DPP modules; one new pure normalization helper for mini-tree.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Mini-tree module | Offset consumers break on scoped text | Passing full hierarchy silently wrong |
| Defensive executePhase gate + phase-list exclusion | Multiple entry points | Exclusion alone missed by resume bugs historically |
| Slow nav UI after removing scope screen | Product keeps TOC navigation | Dropping nav is accepted capability loss user rejected |

## Implementation order (risk)

See source brief §11 and ROADMAP waves: Fix1 → Fix2 → Fix3 → mini-tree → consumers → Cloze verify → Slow removal/modifiers/nav/export → QA/SW.
