# ROADMAP — adaptive-prepacking-activation

**Feature:** specs/20260711-adaptive-prepacking-activation | **Spec:** specs/20260711-adaptive-prepacking-activation/spec.md | **Plan:** specs/20260711-adaptive-prepacking-activation/plan.md
**Created:** 2026-07-16

## Dependency diagram

```text
T01 (Phase A edges)
  └─► T02 (flag decouple)
        └─► T03 (shared-gate + EIG order)
              └─► T04 (early-stop + inferred)
                    └─► T05 (vault hard-skip + presumed_known_vault)
                          └─► T06 (SW bump verify + QA closure)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03 | sequential |
| 4 | T04 | sequential |
| 5 | T05 | sequential |
| 6 | T06 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Dual-field `source_id`/`target_id` in probe-graph + assessment-coverage + tests | — | sequential | [x] |
| T02 | Decouple holistic/adaptive flags onto shared pre-mode gate | T01 | sequential | [x] |
| T03 | Shared-gate adaptive filter + EIG-ordered generation + test | T02 | sequential | [x] |
| T04 | Early-stop via computeGraphEntropy + inferred profile status | T03 | sequential | [x] |
| T05 | Vault hard-skip at 0.80 + presumed_known_vault profile | T04 | sequential | [x] |
| T06 | SW bump + quickstart QA + ROADMAP closure | T05 | sequential | [x] |

## Open design (do not implement)

- Hub-centrality exemption from vault-skip — human decision required.

## Unvalidated placeholders (call out in PR)

- `HIGH_CONFIDENCE_SKIP_THRESHOLD` → `0.80`
- `ADAPTIVE_EARLY_STOP_ENTROPY_THRESHOLD` (new)

## Prompt per task

### T01 — Phase A edge fields
**Spec ref:** US1, FR-001, FR-002 | **Plan ref:** Phase A | **Files:** `src/js/adaptive-probing/probe-graph.js`, `src/js/assessment-coverage.js`, `cursor-tests/20260711_probe-graph-source-id.mjs`, `src/js/sw-update.js`, `index.html`, `sw.js` (SW bump with first src/js change)
**Success criterion:** source_id fixture matches from/to DAG; legacy cycle-break passes; DPP mid-size non-empty.
**On close:** `/validate` and mark `[x]`.

### T02 — Flag decouple
**Spec ref:** FR-003 | **Plan ref:** Phase B Task 1 | **Files:** `src/js/config/flags.js`, cursor-tests covering flag predicates
**Success criterion:** adaptive/holistic true when shared gate on and masters true, even though `isPrePackingAssessmentEnabled()` is false.
**On close:** `/validate` and mark `[x]`.

### T03 — Shared-gate + EIG order
**Spec ref:** US2, FR-004, FR-005 | **Plan ref:** Phase B Tasks 2–3 | **Files:** `src/js/study.js`, `src/js/adaptive-probing/assessment-integration.js`, `src/js/adaptive-probing/eig-selection.js` (reuse), `cursor-tests/20260711_adaptive-shared-gate.mjs`
**Success criterion:** shared-gate path filters/orders via EIG; LLM call count asserted.
**On close:** `/validate` and mark `[x]`.

### T04 — Early stop
**Spec ref:** US3, FR-006, FR-007 | **Plan ref:** Phase B Task 4 | **Files:** `src/js/config/flags.js`, `src/js/study.js`, `src/js/adaptive-probing/assessment-integration.js`, `src/js/adaptive-probing/belief-propagation.js` (reuse only)
**Success criterion:** synthetic high-confidence answers stop runner early; remaining status `inferred`; LLM count unchanged.
**On close:** `/validate` and mark `[x]`.

### T05 — Vault prior exclusion
**Spec ref:** US4, FR-008, FR-011 | **Plan ref:** Phase C | **Files:** `src/js/adaptive-probing/belief-state.js`, `src/js/adaptive-probing/assessment-integration.js`, `src/js/config/flags.js`, `cursor-tests/20260711_vault-prior-skip.mjs`
**Success criterion:** greens above threshold excluded; profile `presumed_known_vault`; report skipped vs asked.
**On close:** `/validate` and mark `[x]`.

### T06 — QA closure
**Spec ref:** SC-001–005 | **Plan ref:** quickstart | **Files:** ROADMAP, quickstart marks, SW verify
**Success criterion:** all phase tests green; SW versions aligned; hub exemption noted.
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-07-16 (none created — sequential parent execution)

## QA notes

- Phase C fixture counts: **skipped=2 asked=5** (inventory=7; two greens vault-skipped).
- Unvalidated placeholders: `HIGH_CONFIDENCE_SKIP_THRESHOLD=0.8`, `ADAPTIVE_EARLY_STOP_MEAN_ENTROPY_THRESHOLD=0.45`.
- Open design (not implemented): hub-centrality exemption from vault-skip.
- Early-stop: live upward propagation rarely drives remaining mean entropy below the cut; mechanism is wired and covered with synthetic high-confidence remaining beliefs. LLM call assert uses a real counter on `fakeGeneratePrePackingAssessmentItems` in `20260711_adaptive-early-stop.mjs`.
- **`fromSharedGate` finish fix** (found during Phase B wiring, not in original task list): `enterPrePackingAssessmentRunner` overwrote `runnerMode: "shared_gate"` → `"assessment"` so `finishPrePackingAssessment` / skip never hit `completeSharedAssessmentGate`. Fix: stash `fromSharedGate` and check it on finish/skip. Documented in `study.js` at `enterPrePackingAssessmentRunner`.
- `assessmentStatus` (`tested`|`inferred`|`presumed_known_vault`) is a **new** additive field on the knowledge profile; packing still keys off `mastery`+`confidence`. Typedef in `session-types.js`.
- Commits: one per phase A→B→C when user requests `/commit` (plan-feature-auto does not auto-commit).
