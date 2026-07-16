# Implementation Plan: Adaptive Pre-Packing Assessment Activation

**Branch**: `20260711-adaptive-prepacking-activation` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260711-adaptive-prepacking-activation/spec.md`

## Summary

Activate the existing adaptive-probing engine on the live shared pre-mode assessment path in three ordered phases: (A) accept DPP `source_id`/`target_id` edges when building the probe DAG, (B) decouple holistic/adaptive flags from the dead RSVP gate, wire EIG-ordered batch generation and early-stop using existing entropy helpers, (C) hard-exclude high vault-prior concepts and surface them as `presumed_known_vault` in the knowledge profile. No mid-quiz LLM calls; no provider or novelty-packing changes.

## Technical Context

**Language/Version**: JavaScript (ES modules), browser PWA  
**Primary Dependencies**: Existing `src/js/adaptive-probing/*`, `flags.js`, `study.js`, `assessment-coverage.js`  
**Storage**: Session/doc `shared.conceptGraph`, knowledge profile on session shared layer; no new tables required for core path (probe warning persist already optional)  
**Testing**: `cursor-tests/*.mjs` fixture/TDD style  
**Target Platform**: Browser PWA (MyLearning)  
**Project Type**: Single-page web application  
**Performance Goals**: Assessment LLM call count unchanged (1 non-holistic / existing holistic batch count); early stop only shortens UX  
**Constraints**: No mid-quiz LLM regeneration; do not touch `isPrePackingAssessmentEnabled`, novelty packing, or provider selection; thresholds as named placeholders  
**Scale/Scope**: Mid-size document inventories; probe DAG from DPP edges

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Constitution template is placeholder; project rules from `.cursorrules` apply: English-only heuristics, PWA SW bump when touching `src/js/**`, surgical scope, TDD for new behavior.
- **SW bump required** when Phase B/C touch `study.js` / `flags.js` (and any other `src/js/**`): bump `SW_VERSION`, `index.html` `?v=`, and `CACHE_NAME` if needed.
- No unjustified new abstractions; reuse `computeGraphEntropy`, `nextProbeBatch`, `filterInventoryForAdaptiveProbing`.

**Gate status**: PASS (design reuses existing modules; phases ordered A→B→C).

## Project Structure

### Documentation (this feature)

```text
specs/20260711-adaptive-prepacking-activation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── adaptive-activation.md
├── checklists/requirements.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/
├── adaptive-probing/
│   ├── probe-graph.js              # Phase A
│   ├── assessment-integration.js   # Phase B/C
│   ├── belief-state.js             # Phase C threshold / candidate
│   ├── eig-selection.js            # Phase B (reuse nextProbeBatch)
│   └── belief-propagation.js       # Phase B early-stop entropy (reuse)
├── assessment-coverage.js          # Phase A deriveInventoryEdges
├── config/flags.js                 # Phase B/C flags
├── study.js                        # Phase B shared-gate + early-stop runner
└── session-types.js                # optional typedef for assessmentStatus

cursor-tests/
├── 20260621_probe-graph-cycle-break.mjs   # must still pass
├── 20260711_probe-graph-source-id.mjs     # Phase A
├── 20260711_adaptive-shared-gate.mjs      # Phase B
└── 20260711_vault-prior-skip.mjs          # Phase C
```

## Implementation Phases

### Phase A — Edge field mismatch (commit 1 when requested)

1. Dual-field parse in `probe-graph.js` and `assessment-coverage.js`.
2. Tests: source_id parity vs from/to; DPP mid-size fixture; legacy cycle-break unmodified.

### Phase B — Activate engine (commit 2 when requested; depends on A green)

1. Decouple `isHolisticAssessmentEnabled` / `isAdaptiveProbingEnabled` to shared gate.
2. Confirm shared-gate → `createPrePackingItemsPromise` adaptive filter path; fix if missing.
3. EIG order into generate calls via existing `nextProbeBatch` / `selectAdaptiveProbeConcepts`.
4. Implement early-stop using `computeGraphEntropy`; mark `"inferred"` in profile.
5. SW version bump.

### Phase C — Vault exclusion gate (commit 3 when requested; depends on B green)

1. Confirm baseline (soft skip via `isProbeCandidate` at 0.9, no profile status).
2. Set `HIGH_CONFIDENCE_SKIP_THRESHOLD` to 0.80 placeholder; ensure hard exclusion + `presumed_known_vault` in profile.
3. Report skipped vs asked counts in test output / roadmap note.
4. Do **not** implement hub-centrality exemption.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Additive `assessmentStatus` | Distinguish three outcomes for packing | Overloading `assessed:false` loses vault vs inferred vs never-seen |
| Early-stop threshold constant | Spec requires named placeholder | Magic number inline forbidden |

## Post-design Constitution Check

PASS — SW bump planned for B/C; TDD tests listed; dual-field only on adaptive path consumers; hub exemption deferred.
