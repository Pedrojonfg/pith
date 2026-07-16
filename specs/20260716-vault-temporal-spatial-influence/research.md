# Research: Vault Temporal, Spatial, and Influence Views

**Date**: 2026-07-16  
**Feature**: `20260716-vault-temporal-spatial-influence`

## R1 — Vault → project linkage

**Decision**: Resolve project membership at filter time via `entry.sources[].docId → DocumentSession.projectId`. Optionally denormalize `projectIds: string[]` when writing sources in `mergeNormalizationResult` / `appendSource` for entries whose docs may be deleted later. Default missing → treat as `misc` project.

**Rationale**: Study-projects contract already uses this resolution path and listed schema change as a non-goal. Resolution-first is smaller; denormalize only as additive safety.

**Alternatives considered**:
- Required `projectId` scalar on every entry — fails cross-project merges (one concept, many docs/projects).
- Always require schema migration before views — unnecessary given existing resolver.

## R2 — Vault-promotion hook

**Decision**: Enqueue extraction immediately after `saveVault(vault)` in `updateVaultFromSession()` (`session-close.js`). Export a shared `enqueueVaultMetadataExtraction(entryIds)` used also from curation commit / manual add / import after their saves.

**Rationale**: Entry exists and is persisted; promotion returns; matches existing `void …catch` patterns. Hooking inside `mergeNormalizationResult` would run mid-normalization and miss other create paths inconsistently if only session-close is wired.

**Alternatives considered**:
- Inside `normalizeConceptsToVault` — already LLM-heavy; wrong layer.
- DPP phase — explicitly forbidden by spec (latency + volume).

## R3 — Background job infrastructure

**Decision**: No new job framework. Fire-and-forget `void extract….catch(log)` plus entry fields `metadataExtractedAt` and `geoLocation.geocodeStatus`. Geocode follow-up is a second fire-and-forget after placeName is known. Optional tiny localStorage pending list only if reload-resume is needed for in-flight geocodes (default: ephemeral is enough for v1).

**Rationale**: Spec FR-011; closest analogs are `visionStatus` and `vault-upload-queue` — full queue is overkill for promotion-rate traffic.

**Alternatives considered**:
- Reuse `vault-upload-queue` wholesale — wrong domain, coupled to curation UX.
- New generic job runner — out of scope.

## R4 — Where `INFLUENCED` lives

**Decision**: Add `INFLUENCED` to `concept-registry/connection-types.js` `CONNECTION_TYPES` and coercion maps. Persist via existing connection-store insert path. Canvas: add stroke for `influenced` / `INFLUENCED` with a dash style that does **not** collide with existing solid `influences` (academic genre) — e.g. `"2 6"` dotted, distinct color.

**Rationale**: Spec’s cited enum matches registry types, not `graph/build.js` academic `EDGE_TYPES`. Vault graph today only emits prerequisite edges from entry.prerequisites; Influence Tree will read registry connections filtered to `INFLUENCED` (and/or store mirror on vault if registry concept ids differ — map vault entry ↔ registry concept via sources/canonical title as existing adapters do).

**Alternatives considered**:
- Only add to `graph/build.js` EDGE_TYPES — wrong vocabulary; vault graph does not use those types for vault prereqs.
- Store influence only as vault-entry adjacency arrays — duplicates connection-store without reuse.

## R5 — Graph render-mode switcher

**Decision**: First switcher on `screenSlowGraph`. Additive chrome: segmented control / tabs for `node | timeline | map | influence_tree`. Keep existing `mountMaterialGraphScreen` for node mode; swap content container for other modes.

**Rationale**: Spec requires alternate modes of the same screen; no switcher exists today.

## R6 — Tree layout

**Decision**: Add a small pure `layoutInfluenceTree(nodes, edges)` (layered DAG: roots → BFS/longest-path layers, assign x/y) consumed by SVG renderer reusing canvas node/edge drawing helpers where possible.

**Rationale**: `canvas.js` only has fixed column layout; force simulation not present. Avoid new deps (dagre/elk).

## R7 — Filter persistence

**Decision**: Reset project checkboxes to all-checked on each open. No localStorage.

**Rationale**: No existing graph-filter persistence; matches spec default.

## R8 — Geocoding

**Decision**: Supabase Edge Function `geocode-proxy`: check `geocode_cache` by normalized place name; on miss call Nominatim with descriptive User-Agent, throttle ≤1 rps (simple in-function queue/mutex), write cache, return lat/lng. Client calls Edge Function only.

**Rationale**: Nominatim ToS; mirror `llm-proxy` auth/CORS pattern. No multi-provider abstraction.

## R9 — LLM extraction

**Decision**: Two `api.js` functions, Mistral Small, temperature 0.1, named max_tokens:
- `MAX_TOKENS_TEMPORAL_SPATIAL_EXTRACTION` — small object (~200–400 tokens)
- `MAX_TOKENS_INFLUENCE_DETECTION` — small list of triples (~400–800 tokens)

Prompts: astronomical years; prefer null; influence must not duplicate other CONNECTION_TYPES.

**Rationale**: Project LLM JSON rules; per-concept volume does not need batching.

## R10 — Leaflet

**Decision**: Load Leaflet CSS/JS from CDN when Map mode first opens (lazy), OSM tiles, markers for resolved only; reuse `#vaultGraphDetailPanel` for click detail.

**Rationale**: No bundler; same CDN pattern as MathJax/marked.
