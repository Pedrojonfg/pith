# Implementation Plan: Assessment-Informed Block Content

**Branch**: `20260523-assessment-informed-blocks` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260523-assessment-informed-blocks/spec.md`

## Summary

Extend the optional initial assessment so results shape **what** each block teaches—not only how many questions appear. After assessment, a parallel **gap synthesis** call (≤30s) produces per-block gap labels; an optional inline editor lets the user adjust them. `applyAssessmentResults` writes `explanation_profile` and `gap_focus` into each block’s `_config`. `deepSeekGenerateBlockJson` uses profile-aware prompts: **brief_deep** recap (~150–220 words) for strong blocks, **thorough** for weak/ok, and **≥1 question per gap** on weak blocks.

## Technical Context

**Language/Version**: JavaScript (ES modules), browser vanilla  
**Primary Dependencies**: DeepSeek Chat API (`deepseek-chat`), existing `parseModelJsonValue`, marked/math typeset as today  
**Storage**: `localStorage` (`active_session`, `block_index`); session JSON `_meta.assessment`, `blocks[i]._config`  
**Testing**: Manual quickstart + console warnings; optional future harness in `tests/`  
**Target Platform**: Modern desktop/mobile browsers; WSL dev  
**Project Type**: Single-page study app (`index.html` + `src/js/*`)  
**Performance Goals**: Gap synthesis p95 ≤30s; accept→first block start p95 ≤30s including C  
**Constraints**: No backend; no frameworks; logic portable to Flutter; surgical diffs per `.cursorrules`  
**Scale/Scope**: ~4 files primary (`api.js`, `session.js`, `study.js`, `export.js`); 1 CSS touch optional

## Constitution Check

*GATE: Project uses `.cursorrules` (constitution template not ratified).*

| Principle (.cursorrules) | Status | Notes |
|--------------------------|--------|-------|
| No backend | PASS | C call from browser like existing assessment |
| No frameworks | PASS | DOM + vanilla JS only |
| Simplicity / surgical | PASS | Extend existing functions; no new abstractions layer |
| Flutter portability | PASS | Schema on `sessionObj`, not new globals |
| RSVP critical path | PASS | Only explanation length changes; no timer changes |
| Single-file preference | PASS | Modules already split; no new split required |

**Post-design re-check**: PASS — no gate violations.

## Project Structure

### Documentation (this feature)

```text
specs/20260523-assessment-informed-blocks/
├── plan.md              # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── gap-synthesis.md
│   └── block-generation-profile.md
└── tasks.md             # /speckit-tasks (next)
```

### Source Code (repository root)

```text
index.html                 # Optional: gap editor styles only if needed
src/js/
├── api.js                 # synthesizeAssessmentGaps, prompt branches
├── session.js             # applyAssessmentResults, resolveBlockQuestionConfig
├── study.js               # showAssessmentResults UI, parallel C
└── export.js              # gaps in .md export
src/css/main.css           # Optional: details/summary for gap panel
```

**Structure Decision**: Extend existing module layout; no new packages.

## Phase 0: Research

Complete — see [research.md](./research.md). All technical unknowns resolved.

## Phase 1: Design & Contracts

Complete:

- [data-model.md](./data-model.md)
- [contracts/gap-synthesis.md](./contracts/gap-synthesis.md)
- [contracts/block-generation-profile.md](./contracts/block-generation-profile.md)
- [quickstart.md](./quickstart.md)

**Agent context**: `.cursor/rules/specify-rules.mdc` updated to reference this plan.

## Phase 2: Implementation Outline (for /speckit-tasks)

| ID | Work package | Files |
|----|--------------|-------|
| WP1 | Gap synthesis API + timeout | `api.js` |
| WP2 | Profile resolver + applyAssessmentResults | `session.js` |
| WP3 | Prompt profiles in block JSON gen | `api.js` |
| WP4 | Results UI: parallel C + optional D | `study.js`, `main.css?` |
| WP5 | Prefetch configKey + generation wire-up | `session.js`, `study.js` |
| WP6 | Export gaps | `export.js` |

**Execution order**: WP1 → WP2 ∥ WP3 → WP4 → WP5 → WP6.

## Complexity Tracking

No constitution violations requiring justification.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Model ignores word-count targets | Dev console warnings; prompt repetition |
| C slows accept path | 30s cap + fallback; show progress |
| `configKey` stale prefetch | Include profile in prefetch key (research R3) |
| Gap/question count mismatch | Auto-raise n_test/n_socratic (research R8) |

## Next command

`/speckit-tasks` — generate `tasks.md` from this plan, or implement via `ROADMAP.md` prompts (método Pedro).
