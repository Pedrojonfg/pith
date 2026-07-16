# Implementation Plan: Vault Temporal, Spatial, and Influence Views

**Branch**: `20260716-vault-temporal-spatial-influence` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260716-vault-temporal-spatial-influence/spec.md`

## Summary

At vault-entry promotion (not DPP), asynchronously extract optional temporal range and place for each earned concept, detect directed `INFLUENCED` edges among neighbors, geocode places via a throttled Nominatim Edge Function + global cache, and expose Timeline / Map / Influence Tree as alternate render modes on the existing vault graph screen with a shared project multi-select filter.

## Technical Context

**Language/Version**: JavaScript (ES modules), browser PWA; Deno Edge Functions for geocode proxy  
**Primary Dependencies**: Existing vault (`session-close`, `vault-store`, `normalization`), concept-registry `CONNECTION_TYPES`, `graph/canvas.js` + `vault-graph.js`, Supabase (`llm-proxy` pattern), Leaflet CDN, Nominatim  
**Storage**: Vault entry JSON fields; new Supabase `geocode_cache` table; concept-registry connections for `INFLUENCED`  
**Testing**: `cursor-tests/*.mjs` fixture/TDD style  
**Target Platform**: Browser PWA (MyLearning)  
**Project Type**: Single-page web application  
**Performance Goals**: Promotion path returns immediately; Nominatim ≤1 req/s; extraction volume ≪ DPP inventory size  
**Constraints**: No DPP phase; no client Nominatim; no new job framework; no bundler (Leaflet CDN); English prompts; SW bump on `src/js/**` / `index.html` / CSS touches  
**Scale/Scope**: Per-concept promotion events; three new views on one screen

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Constitution template is placeholder; `.cursorrules` apply: English LLM prompts, PWA SW versioning, structured JSON `max_tokens`, surgical scope, TDD.
- **SW bump required** when touching `src/js/**`, `index.html`, or `src/css/**`.
- Reuse fire-and-forget + status-on-entity (visionStatus / upload-queue patterns); do not invent a general job system.
- Geocode ToS: User-Agent, cache, throttle — Edge Function only.

**Gate status**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/20260716-vault-temporal-spatial-influence/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── metadata-extraction.md
│   ├── geocode-proxy.md
│   └── graph-render-modes.md
├── checklists/requirements.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/
├── config/flags.js                          # isVaultMetadataExtractionEnabled
├── concept-registry/connection-types.js     # INFLUENCED
├── vault/
│   ├── session-close.js                     # post-saveVault enqueue
│   ├── vault-store.js                       # migrate/normalize new fields
│   ├── vault-graph.js                       # project filter + influence edges
│   ├── metadata-extraction.js               # NEW: async extract + geocode enqueue
│   └── project-membership.js                # NEW: resolve projectIds from sources
├── graph/
│   ├── canvas.js                            # INFLUENCED stroke; tree layout helper
│   └── view.js                              # mode switcher wiring hooks
├── api.js                                   # extractTemporalSpatial + detectInfluence
├── study.js                                 # openVaultGraphScreen mode + filter UI
└── session-types.js                         # typedefs

supabase/
├── migrations/YYYYMMDD_geocode_cache.sql
└── functions/geocode-proxy/index.ts         # NEW

index.html                                   # mode switcher + project filter chrome
src/css/main.css                             # timeline/map/influence chrome

cursor-tests/
├── 20260716_vault-project-membership.mjs
├── 20260716_influenced-edge-type.mjs
├── 20260716_vault-metadata-extraction.mjs
├── 20260716_geocode-cache-contract.mjs
└── 20260716_vault-graph-views.mjs
```

## Implementation Phases

### Phase 0 — Foundations (blocks views)

1. Project membership resolver (`sources → docId → session.projectId`; optional denormalized `projectIds` on write).
2. Add `INFLUENCED` to `CONNECTION_TYPES` + canvas stroke (distinct from existing `influences`).
3. `geocode_cache` migration + `geocode-proxy` Edge Function (throttle + cache).
4. Flag + extraction/geocode enqueue module; hook after `saveVault` in session-close (+ other create paths).
5. LLM APIs in `api.js` (named max_tokens); write fields on vault entry; insert registry connections.

### Phase 1 — Graph chrome + filter

6. Render-mode switcher on `screenSlowGraph` (node | timeline | map | influence_tree).
7. Shared project checkbox filter (all checked; reset on open).

### Phase 2 — Views (independent)

8. Timeline SVG (reuse canvas SVG conventions; zoom/pan via viewBox).
9. Map (Leaflet CDN + OSM tiles; detail panel reuse).
10. Influence Tree (hierarchical layout helper + INFLUENCED-only edges).

### Phase 3 — Ship

11. SW bump; integration tests; flag default-on after spot-check; quickstart QA.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Edge Function geocode proxy | Nominatim ToS + shared throttle/cache | Client-side Nominatim forbidden by policy |
| New `metadata-extraction.js` | Keep session-close free of LLM/geocode details | Inlining would bloat hot promotion path |
| Hierarchical layout helper | No existing tree layout | Reusing column layout cannot express influence DAG |
| Leaflet CDN | Map tiles without bundler | Custom tile canvas reinventing Leaflet |

## Post-design Constitution Check

PASS — design reuses vault/registry/graph patterns; no DPP coupling; SW bump planned for UI waves.
