# Feature Specification: DPP Inventory LLM Cost Reduction

**Feature ID**: `20260705-dpp-inventory-llm-optimization`  
**Status**: Approved  
**Priority**: P1 — reduce tier-1 LLM calls on large flat documents  
**Created**: 2026-07-05

## Problem

Large uploads (~180k+ chars) with flat structure trigger 16+ blind char-slice inventory chunks plus fragile monolithic LLM merges. DPP T1.1 passes `null` as `llmFn`, so hierarchy LLM never runs during preparation. Users pay ~18–19 chat LLM calls per first upload where semantic chunking and deterministic merge could cut cost and truncation retries.

## User Scenarios

### US1 — Semantic structure before inventory (P1)

When a document has no usable markdown `#` headings but exceeds map-reduce threshold, tier-1 preparation obtains a section tree (LLM or improved normalization) so inventory chunks follow sections—not arbitrary 12k char windows.

**Acceptance**: A 180k-char flat PDF produces fewer than 12 inventory chunks OR chunks labeled by section titles (not only `Part N`) when hierarchy succeeds.

### US2 — Larger char fallback with safe bisect (P1)

When char fallback is still required, default slice size increases to reduce chunk count; truncated chunk responses bisect and retry automatically.

**Acceptance**: 187k-char doc with char fallback yields ≤8 chunks at default slice; a forced truncation bisects once and completes without user action.

### US3 — Deterministic merge tree + optional LLM polish (P1)

Partial inventories merge via pairwise deterministic dedupe; LLM merge runs only when polish is needed (prerequisites / semantic dedup), not as first attempt.

**Acceptance**: Map-reduce with 16 partials performs zero monolithic LLM merge when deterministic tree yields ≥ `minViableConcepts`; polish LLM skipped when `inventoryMode` is `map_reduce_deterministic` and prereq resolution not required for tier-1 gate.

## Requirements

- **FR-001**: `runPhaseT11` MUST pass a real hierarchy `llmFn` (same proxy pattern as `study.js`) when auth and API key are available.
- **FR-002**: `runConceptInventory` hierarchy bootstrap MUST use the same `llmFn`, not `null`.
- **FR-003**: `buildCharFallbackInventoryChunks` default slice MUST be 24_000 chars (exported constant).
- **FR-004**: Map-reduce chunk extraction MUST bisect a chunk on `CONCEPT_INVENTORY_TRUNCATED` or empty parse after terse retry (max depth 2).
- **FR-005**: `deepSeekMergeConceptInventories` MUST run pairwise deterministic merge tree before any LLM merge attempt.
- **FR-006**: LLM merge/polish MUST be conditional: skip when deterministic result ≥ `minViableConcepts` unless `splitOpts.mergePolish === true` (default false for tier-1).
- **FR-007**: Existing `mergeConceptInventoriesDeterministic` dedupe semantics (title key, richest `source_phrase`, clear prereqs) MUST be preserved in tree merge.
- **FR-008**: `cursor-tests` MUST cover hierarchy llmFn wiring, 24k slice math, bisect, and merge-tree path.

## Assumptions

- Shared DPP cache already implemented; this feature does not change cache keys.
- Concept cap / inventory density levers out of scope.
- Normalization heading detection improvements are follow-up; US1 satisfied by wiring existing hierarchy LLM in DPP.
- Tier-1 gate does not require resolved `prerequisite_ids`; polish LLM default off.

## Success Criteria

- Philosophy-scale PDF (~180k chars): ≤10 inventory chunk LLM calls in typical run (down from ~16).
- Zero monolithic merge LLM calls when deterministic tree succeeds (observable via `inventoryMode`).
- No regression on docs &lt;8k words (single-pass unchanged).
