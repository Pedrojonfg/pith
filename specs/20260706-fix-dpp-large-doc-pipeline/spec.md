# Feature Specification: Fix DPP Large Document Pipeline

**Feature ID**: `20260706-fix-dpp-large-doc-pipeline`  
**Status**: Approved  
**Priority**: P0 — 180k+ char uploads truncate merge and stall on `running`  
**Created**: 2026-07-06

## Problem

Flat PDFs (~187k chars, few headings) use mechanical char-slice inventory chunks. Per-chunk extraction works but merge LLM receives ~180 raw concepts, truncates output, partial recovery accepts ~50% loss (91 of 178). Pipeline sets `partial` in memory but store/UI remain `running`; DPP-GUARD polls forever.

## User Scenarios

### US1 — Semantic-ish char slices without N extra inventory calls (P1)

When char fallback activates, one cheap LLM pass nudges slice boundaries toward paragraph/section breaks while respecting max slice size.

### US2 — Merge dedupes semantically without truncation loss (P1)

Map-reduce merge produces a deduped inventory close to deterministic count (not half lost); prefers slim schema + rehydrate over monolithic verbose JSON.

### US3 — Tier-1 completes and UI advances (P0)

After DPP pipeline finishes with tier-1 artifacts, persisted status is `ready` or `partial` (never stuck `running`); guard does not poll forever.

## Requirements

- **FR-001**: When `buildCharFallbackInventoryChunks` is used, optionally refine boundaries via **one** LLM call before per-chunk inventory (skip when offline/no key).
- **FR-002**: Refined boundaries MUST keep each chunk ≤ `INVENTORY_CHAR_FALLBACK_SLICE_CHARS` and ≥ 4000 chars unless doc tail is shorter.
- **FR-003**: Merge MUST use slim partial input (`id`, `title`, `scope_one_line` capped) for LLM; rehydrate `source_phrase` and optional fields from richest partial match by title key.
- **FR-004**: When slim monolithic merge fails/truncates, fall back to **pairwise slim LLM tree** (same shape as deterministic tree).
- **FR-005**: Partial recovery MUST NOT be accepted when `recovered.length < max(minRequired, floor(deterministicCount * 0.75))`.
- **FR-006**: `resolveFinalStatus` MUST use artifact readiness independent of `prep.status === running`.
- **FR-007**: `commitPreparedDocToStore` MUST persist when prepared has terminal status and store is in-progress.
- **FR-008**: When `status === running`, pipeline not in-flight, and tier-1 artifacts complete → promote to `ready`/`partial` (repair), guard returns `skip`.

## Assumptions

- One boundary-refinement LLM call per doc is acceptable (~2k input tokens).
- Pairwise slim merge for 8 partials ≈ 7 small LLM calls beats one failing 178-concept monolithic call.
- Deterministic tree remains final fallback with `map_reduce_deterministic`.

## Success Criteria

- Doc class 187k chars: merge output ≥ 75% of deterministic tree count; `inventoryMode` not `map_reduce_partial` on happy path.
- After DPP finish: store status ≠ `running`; mode select reachable within one poll cycle.
- Char fallback chunks labeled with semantic hint when refinement succeeds.
