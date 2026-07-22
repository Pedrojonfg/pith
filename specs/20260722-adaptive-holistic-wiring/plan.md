# Implementation Plan: Adaptive Holistic Assessment Wiring

**Branch**: `20260722-adaptive-holistic-wiring` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260722-adaptive-holistic-wiring/spec.md`

## Summary

Wire the already-computed adaptive probing candidate set (`selectedConceptIds` + vault hard-exclude) into `generateHolisticPrePackingAssessmentItems` so the live holistic path asks only EIG-selected, non-vault-skipped concepts. Rename the generator parameter to `conceptsToAssess`, add an enrich-profile guard against `tested` → `presumed_known_vault` overwrite, and add a real e2e fixture that mocks the LLM (not string-presence tests).

## Technical Context

**Language/Version**: JavaScript (ES modules), browser PWA  
**Primary Dependencies**: `adaptive-probing/assessment-integration.js`, `study.js`, `api.js`, `config/flags.js`  
**Storage**: Existing `flow.adaptiveProbing` / session belief state (no new persistence)  
**Testing**: `cursor-tests/*.mjs` fixture/TDD  
**Target Platform**: Browser PWA (MyLearning)  
**Project Type**: Single-page web application  
**Performance Goals**: Fewer LLM concept batches on typical docs (subset ≪ full inventory); batch size ≤20 unchanged  
**Constraints**: Do not change EIG/belief math, UI screens, flag semantics, or delete non-holistic path  
**Scale/Scope**: Call-site wiring + small helper + enrich guard + tests; SW version bump

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Constitution file is placeholder; `.cursorrules` applies: English internals, surgical diffs, TDD for new behavior.
- **SW bump mandatory**: changes to `src/js/**` → bump `SW_VERSION` in `sw-update.js`, matching `?v=` on `sw-update.js` and `main.js` in `index.html`; `CACHE_NAME` only if static/SW strategy changes (not expected here).
- No new abstractions beyond one small resolver; reuse `getConceptId`, existing adaptive fields.
- LLM structured JSON rules unchanged (generator already batched).

**Gate status**: PASS (post-research).

## Project Structure

### Documentation (this feature)

```text
specs/20260722-adaptive-holistic-wiring/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── adaptive-holistic-wiring.md
├── checklists/requirements.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/
├── adaptive-probing/assessment-integration.js  # resolveAdaptiveCandidateConcepts + enrich guard
├── study.js                                    # createPrePackingItemsPromise wire
├── api.js                                      # conceptsToAssess rename
├── sw-update.js                                # SW_VERSION bump
index.html                                      # ?v= bump
cursor-tests/
├── 20260722_resolve-adaptive-candidates.mjs    # unit: resolver
└── 20260722_adaptive-holistic-wiring-e2e.mjs   # e2e holistic path + flag-off regression
```

## Implementation Phases

### Phase A — Resolver + unit tests

1. Add `resolveAdaptiveCandidateConcepts(inventory, plan, opts?)` in `assessment-integration.js`.
2. Inputs: inventory array; plan (or `{ adaptiveProbing }` / flow slice); optional explicit `vaultSkippedIds` / `selectedConceptIds` from `flow.adaptiveProbing`.
3. Behavior: flag off → full inventory; selected ids (− vault skips) mapped to objects in EIG order; empty → full inventory + warn.
4. Unit tests with 10→4 fixture + flag-off.

### Phase B — Wire + rename (core fix)

1. In `createPrePackingItemsPromise` holistic branch: resolve candidates, set `flow.assessedConceptIds`, pass `conceptsToAssess`.
2. Rename `generateHolisticPrePackingAssessmentItems` param + JSDoc; update internals.

### Phase C — Enrich guard + e2e + SW

1. Guard in `enrichKnowledgeProfileWithAdaptiveStatuses`.
2. E2e: ~15 inventory, 5 selected, 2 vault-skipped; mock LLM; assert payload ids + profile labels; flag-off regression.
3. SW bump `20260722_07` → next (`20260722_08`).

## Complexity Tracking

| Item | Why needed |
|------|------------|
| Hard vault-exclude in resolver | Holistic builder lacks hard exclude (OQ2); required for FR-002 |
| Enrich guard | Turns silent overwrite into loud invariant failure (FR-007) |
