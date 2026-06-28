# Research: Shared DPP Cache

**Feature**: `20260704-shared-dpp-cache`  
**Date**: 2026-07-04

## R1 — Global cache storage

**Decision**: New Supabase table `document_preparation_cache`, keyed by `cache_key = docId + ':' + pipeline_version`.  
**Rationale**: Matches `pith_book_cache` precedent (global, cross-user). Client writes on tier-1 complete; all authenticated clients read.  
**Alternatives**: (a) Embed in first user's session — rejected, not cross-user. (b) Edge Function only writes — rejected, adds latency and deploy complexity for v1.

## R2 — Pipeline version invalidation

**Decision**: Constant `DPP_PIPELINE_VERSION` in `src/js/config/flags.js` (or `shared-dpp-cache.js`); bump on tier-1 phase/schema change.  
**Rationale**: Simple, explicit, testable.  
**Alternatives**: Hash of phase graph — over-engineered for v1.

## R3 — Cacheable vs user-specific artifacts

**Decision**: Cache blob includes tier-1 content artifacts: `conceptInventory`, `docHierarchy`, `docTopics`, `textMetrics`, `blockRecommendation`, `modeRecommendation`, `conceptGraph`, `images` metadata (not binary), tier-1 `phaseResults`, `preparation` status ready.  
**Exclude**: `smItems`, `annotations`, `assessmentSignals`, `mnemonicDevices`, vault novelty fields on concepts, `relatedDocuments` (project-scoped).  
**After hydrate**: Run T1.6, T1.8, T1.9 for current user/project.  
**Rationale**: T1.2–T1.5, T1.3, T1.7 are content-pure; vault/novelty/similarity are user/project dependent.

## R4 — Write-on-complete gate

**Decision**: `resolveFinalStatus` uses `isTier1PreparationComplete(doc)` not inventory-only `tier1Complete`. Shared cache upsert only in `persistFinal` path when predicate true.  
**Rationale**: Fixes zombie `ready` with partial artifacts; aligns with create-screen gate.

## R5 — Offline

**Decision**: Skip shared cache read/write when `isOfflineMode()`.  
**Rationale**: No Supabase access; existing local behavior sufficient.

## R6 — Dev wipe scope

**Decision**: Script deletes `document_sessions` for user, storage `{userId}/`, localStorage keys `pith_*` and `mylearning_*`; does NOT truncate `document_preparation_cache`.  
**Rationale**: Shared cache is intentional global asset; dev personal data is the noise.

## R7 — RLS

**Decision**: `ALTER TABLE document_preparation_cache DISABLE ROW LEVEL SECURITY` (same as `pith_book_cache`). App enforces write-on-complete.  
**Rationale**: PWA client writes directly; policy complexity low value for v1.
