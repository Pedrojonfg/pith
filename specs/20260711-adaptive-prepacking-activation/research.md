# Research: Adaptive Pre-Packing Assessment Activation

**Feature**: `20260711-adaptive-prepacking-activation`  
**Date**: 2026-07-16

## R1 — conceptGraph edge field consumers

**Decision**: Fix only `src/js/adaptive-probing/probe-graph.js` and `src/js/assessment-coverage.js` (`deriveInventoryEdges`). Keep dual-field support permanently.

**Findings**:
| Location | Fields read | Action |
|----------|-------------|--------|
| `adaptive-probing/probe-graph.js` | `from`/`to`, fallback `sourceId`/`targetId` | Add primary `source_id`/`target_id` |
| `assessment-coverage.js` `deriveInventoryEdges` | `e.from`/`e.to` only | Same dual-field read; normalize output to `{from,to}` |
| `graph/build.js` (cloze) | already `source_id`/`target_id` | No change |
| `graph/view.js` / academic slow graphs | `from`/`to` (different graph model) | Out of scope |
| `cloze/normalize.js` | writes `source_id`/`target_id` | Canonical producer |
| `assessment-integration.js` filteredEdges | uses normalized `{from,to}` after derive | No change once derive fixed |

**Rationale**: DPP T1.3 / `normalizeEpistemicEdge` emit snake_case. Probe path never saw those edges. Broader dual-field migration of all graph UIs is unnecessary and risky.

**Alternatives considered**: Migrate all fixtures to `source_id`/`target_id` only — rejected (breaks cheap compatibility). Rewrite all consumers — rejected (scope creep).

## R2 — Flag cascade

**Decision**: Gate `isHolisticAssessmentEnabled` and `isAdaptiveProbingEnabled` on `isSharedPreModeAssessmentEnabled()` (+ master constants / UI flag where already required). Leave `isPrePackingAssessmentEnabled()` returning `false`.

**Rationale**: Live entry is shared pre-mode gate; RSVP-only path is intentionally dead. Cascading on the dead gate disables adaptive/holistic regardless of their `true` constants.

## R3 — Entropy helpers for early stop

**Decision**: Use `computeGraphEntropy(beliefState, remainingUnaskedIds)` from `belief-propagation.js`. Add named constant `ADAPTIVE_EARLY_STOP_ENTROPY_THRESHOLD` (unvalidated placeholder). Thin wrapper OK to compute remaining IDs; no new formula.

**Shape**:
- `binaryEntropy(p)` — per-concept
- `computeGraphEntropy(state, nodeIds)` — sum of binary entropies over IDs

**Holistic early-stop scope**: Within current answer runner only (default). Do not skip ungenerated LLM batches after generation completed.

## R4 — Knowledge profile status

**Decision**: Additive optional `assessmentStatus` on `byConceptId` entries and/or `items[]` (newtype; not present in pre-existing `session-types.js`):
- `"tested"` — answered in quiz
- `"inferred"` — early-stop carry-forward from belief
- `"presumed_known_vault"` — vault-prior exclusion

Typedef added to `session-types.js` as `AssessmentStatus`. Packing (`buildConceptPackPrompt`) continues to use `mastery` + `confidence` only; status is distinguishing metadata for downstream consumers. Vault-skipped / inferred rows are written with `mastery: "full"` and high confidence so packing treats them as known without reading `assessmentStatus`.

**Alternatives**: Reuse only `assessed: false` — rejected (cannot distinguish vault-skip vs never-considered). New parallel map — rejected (extra indirection).

## R5 — Current vault filtering behavior (Phase C baseline)

**Decision**: Document then harden.

**Current**: `isProbeCandidate` excludes belief ≥ `HIGH_CONFIDENCE_SKIP_THRESHOLD` (0.9) or ≤ low threshold from EIG selection. Green prior is 0.85 → **not** excluded today. Excluded concepts are **not** written as `presumed_known_vault` in the knowledge profile.

**Change**: Lower threshold placeholder to `0.80` (so green 0.85 skips), ensure filter boundary exclusion, and surface profile status.

## R6 — Hub-centrality exemption

**Decision**: Do not implement. Flag in roadmap/PR notes for human decision.

## R7 — Shared-gate wiring audit

**Decision**: Verify `createPrePackingItemsPromise` on shared-gate path calls `filterInventoryForAdaptiveProbing` when adaptive enabled; add regression test specifically entering via shared-gate helpers, not legacy RSVP-only entry.
