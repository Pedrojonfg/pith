# Research: DPP Inventory LLM Cost Reduction

## R1 — Hierarchy null in DPP

**Decision**: Wire `makeHierarchyLlmFn` in T1.1 and session bootstrap.  
**Rationale**: `buildDocumentHierarchy(text, null)` returns `null` for large docs without `#` headings; forces char fallback.  
**Alternatives**: Only fix normalization headings — slower, separate feature.

## R2 — Char slice size

**Decision**: 24_000 chars default; bisect on truncation.  
**Rationale**: Output cap 6144 tokens ≈ safe up to ~20 concepts/chunk; 24k input ≈ 4k words ≈ 16 concepts at 120 global target.  
**Alternatives**: 30k without bisect — rejected (dense PDF risk).

## R3 — Merge strategy

**Decision**: Pairwise deterministic tree; LLM merge only if tree below `minViableConcepts` or explicit polish flag.  
**Rationale**: User discussion + existing `mergeConceptInventoriesDeterministic`; monolithic merge caused 2 wasted LLM calls in production logs.  
**Alternatives**: LLM-only final polish on slim schema — deferred as optional flag default false.
