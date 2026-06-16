# Research: Concept Inventory Truncation Fix + Map-Reduce

## Decision: Mirror pack truncation fix for Phase 1 inventory

**Rationale**: Phase 2 already solved identical symptom (truncated JSON) with `CONCEPT_PACK_MAX_TOKENS`, `looksLikeTruncatedModelJson`, terse retry, and deterministic fallback. Phase 1 lacks all of these; deep-dive confirms root cause is output token ceiling, not parser strictness.

**Alternatives considered**:
- Parser tolerant to partial JSON arrays — rejected as fragile (pack fix precedent)
- Global `max_tokens` on `callLlmSplit` — rejected; would inflate unrelated split calls

## Decision: `CONCEPT_INVENTORY_MAX_TOKENS = 12288` (single-pass), chunk 6144, merge 8192

**Rationale**: ~54 concepts × ~200 tokens ≈ 10 800 for ≤8k-word docs; 12288 headroom. Chunks target ~3500 words (~22 concepts). Merge consolidates duplicates so 8192 suffices.

**Alternatives considered**:
- 8192 only — insufficient for cap-120 dense docs before map-reduce kicks in
- 16384 always — unnecessary cost for short docs

## Decision: Map-reduce when `wordCount > 8000` AND `docHierarchy.tree` non-empty

**Rationale**: Structural fix for O(concepts) monolithic output; hierarchy already exists from doc-hierarchy-index feature. Single chunk → null → single-pass fallback.

**Alternatives considered**:
- Keep `twoPassInventory` lever — dead code (never received docHierarchy); superseded
- Always map-reduce — overhead for short docs

## Decision: Unified `runConceptInventoryWithFallback` with mono-phase escape hatch

**Rationale**: Contract `two-phase-split-api.md` promised fallback but pre-packing ON / recommend / ingest bypassed it. Discriminated result `{ kind: 'inventory' | 'fallback_mono' }` lets study.js skip assessment on fallback.

**Alternatives considered**:
- Fail loud on pre-packing — blocks users on default path
- Partial inventory from truncated JSON — fragile

## Decision: Remove `127.0.0.1:7501` debug fetch calls

**Rationale**: Production noise; misattributed as failure cause. No replacement without opt-in debug flag.

## Decision: Terse mode skips anchor validation in fidelity-validation

**Rationale**: Terse omits `source_phrase`/`anchor_type` by design; strict anchor checks would false-fail.
