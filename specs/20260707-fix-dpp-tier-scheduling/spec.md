# Feature Specification: Fix DPP Tier Scheduling & Tier-2 Robustness

**Feature ID**: `20260707-fix-dpp-tier-scheduling`  
**Status**: Approved  
**Priority**: P0 — Tier-2 prep fails on large docs; T2.3 races with inventory  
**Created**: 2026-07-07

## Problem

Document Preparation Pipeline scheduling diverges from the DPP spec: **T2.3 (Slow Phase 0)** runs in wave 3 **in parallel with T1.2 (inventory)**, causing LLM contention and `Invalid partial Phase 0 JSON for section 1` on documents >60k chars. **Tier 1 gate** waits for non-blocking phases (T1.3, T1.6–T1.9) even though `hasTier1Artifacts` only needs inventory + block + mode recommendations. **T2.1 Cloze** fails hard with zero valid items and no diagnostics.

## User Scenarios

### US1 — Mode select unlocks after gate artifacts (P1)

When inventory, block recommendation, and mode recommendation are ready, the user can enter mode select without waiting for vault linking, novelty scoring, or Cloze graph generation.

### US2 — Tier-2 prep does not race inventory (P0)

Background Tier-2 preparation (Slow orientation, Cloze, Recall) starts only after Tier-1 gate artifacts exist — never in the same parallel wave as concept inventory indexing.

### US3 — Slow Phase 0 survives large documents (P0)

A 180k+ char philosophical PDF completes Slow orientation precache or degrades with a retried partial — not a hard fail on section 1 JSON parse.

### US4 — Cloze precache degrades gracefully (P1)

When Cloze QA rejects all items, preparation status is `partial` with a logged reason — not an opaque phase failure blocking other modes.

## Requirements

### Scheduling

- **FR-001**: `T2.3` MUST depend on Tier-1 gate phases (`T1.2`, `T1.4`, `T1.5`) — not only `T1.1`.
- **FR-002**: `T2.1`, `T2.2`, `T2.3` MUST NOT be scheduled in any wave that still has unresolved `T1.2` dependencies.
- **FR-003**: `stopAfterTier: 1` MUST run only gate-critical Tier-1 phases: `T0.*`, `T1.1`, `T1.2`, `T1.4`, `T1.5`.
- **FR-004**: Deferred Tier-1 phases (`T1.3`, `T1.6`, `T1.7`, `T1.8`, `T1.9`) MUST run in background after gate unlock (same kickoff as Tier 2 or chained immediately after).
- **FR-005**: `kickoffTier2PreparationInBackground` MUST NOT re-run `T1.2` when `phaseSucceeded(T1.2)` for current fingerprint.

### Phase 0 map-reduce

- **FR-010**: Map-reduce partial chunks MUST retry on JSON parse failure with truncation detection (same categories as inventory: `TRUNCATED`, `PARSE_ERROR`).
- **FR-011**: On repeated truncation, partial chunks MUST bisect (max depth 2) before failing the phase.
- **FR-012**: Chunk `max_tokens` MUST be named constant ≥3072 with sizing comment.
- **FR-013**: Phase failure only when all chunks exhausted; record `failReason` `PHASE0_MAP_REDUCE_FAILED`.

### Cloze Tier 2

- **FR-020**: `runPhaseT21` MUST log per-phase item counts (base, post-distractor, post-QA, valid).
- **FR-021**: When `validItems.length === 0` but pipeline ran, set `pipelineStatus: degraded` and mark phase `partial` success with hash — do not throw (preparation `partial`, not failed).

## Assumptions

- `fix-dpp-persist-race` (wave-level persist) is already merged — this feature builds on it.
- Early gate defers vault/novelty/Cloze graph to background; RSVP still works from inventory.
- T2.1 still depends on `T1.3`; deferred background runs `T1.3` before `T2.1` via dependency waves.
- No Supabase schema changes.

## Success Criteria

- **SC-001**: `buildWaves` for full pipeline places `T2.3` in a wave strictly after `T1.2` completes (unit test).
- **SC-002**: 187k char fixture: `mapReducePhase0` partial chunk with truncated JSON recovers via retry or bisect (test with mock LLM).
- **SC-003**: Cloze pipeline with all QA-rejected items yields `partial` preparation, not thrown error.
- **SC-004**: `stopAfterTier: 1` wave list excludes `T1.3` and `T1.6`–`T1.9` (test).

## Out of Scope

- Changing RSVP block packing (Tier 3) or threshold sort order.
- Replacing Cloze epistemic graph LLM with inventory-derived graph (follow-up).
