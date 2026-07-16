# ROADMAP — vault-temporal-spatial-influence

**Feature:** `specs/20260716-vault-temporal-spatial-influence` | **Spec:** `specs/20260716-vault-temporal-spatial-influence/spec.md` | **Plan:** `specs/20260716-vault-temporal-spatial-influence/plan.md`
**Created:** 2026-07-16

## Dependency diagram

```text
T01 project-membership ──┐
T02 INFLUENCED type ──────┼──► T04 extraction+hook ──► T05 geocode client
T03 geocode-proxy ────────┘         │
                                    ▼
T01 ──────────────────────────► T06 mode switcher + project filter
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
                  T07 Timeline   T08 Map   T09 Influence Tree
                    └───────────────┼───────────────┘
                                    ▼
                                  T10 QA + SW bump
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02, T03 | parallel |
| 2 | T04 | sequential |
| 3 | T05 | sequential |
| 4 | T06 | sequential |
| 5 | T07, T08, T09 | parallel |
| 6 | T10 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Project membership resolver + optional projectIds on write | — | parallel | [x] |
| T02 | Add INFLUENCED to CONNECTION_TYPES + canvas stroke | — | parallel | [x] |
| T03 | geocode_cache migration + geocode-proxy Edge Function | — | parallel | [x] |
| T04 | Flag, api.js LLM extractors, metadata-extraction.js, session-close hook | T01,T02 | sequential | [x] |
| T05 | Client geocode follow-up after placeName | T03,T04 | sequential | [x] |
| T06 | Graph mode switcher + project filter chrome | T01 | sequential | [x] |
| T07 | Timeline view | T06 | parallel | [x] |
| T08 | Map view (Leaflet CDN) | T06 | parallel | [x] |
| T09 | Influence Tree layout + view | T02,T06 | parallel | [x] |
| T10 | Integration tests, SW bump, quickstart QA | T05,T07,T08,T09 | sequential | [x] |

## Prompt per task

### T01 — Project membership
**Spec ref:** FR-007, Assumptions project membership | **Plan ref:** Phase 0.1 | **Files:** `src/js/vault/project-membership.js` (new), `src/js/vault/normalization.js` (optional projectIds on appendSource), `cursor-tests/20260716_vault-project-membership.mjs`
**Success criterion:** Pure resolver returns project ids from sources→sessions; multi-project merge includes all; missing → misc. Test green.
**On close:** `/validate` and mark `[x]`.

### T02 — INFLUENCED edge type
**Spec ref:** FR-003 | **Plan ref:** Phase 0.2 | **Files:** `src/js/concept-registry/connection-types.js`, `src/js/graph/canvas.js`, `cursor-tests/20260716_influenced-edge-type.mjs`
**Success criterion:** `INFLUENCED` coerces; canvas stroke distinct from solid `influences`. Test green.
**On close:** `/validate` and mark `[x]`.

### T03 — Geocode proxy
**Spec ref:** FR-006 | **Plan ref:** Phase 0.3 | **Files:** `supabase/migrations/20260716_geocode_cache.sql`, `supabase/functions/geocode-proxy/index.ts`, `cursor-tests/20260716_geocode-cache-contract.mjs` (contract/fixture of normalize + response shape if EF not runnable in node)
**Success criterion:** Migration SQL + Edge Function implements cache-first + throttle stub; contract test for normalize/response helpers if extracted, or documented smoke path.
**On close:** `/validate` and mark `[x]`.

### T04 — Metadata extraction pipeline
**Spec ref:** FR-001–005, US1 | **Plan ref:** Phase 0.4–0.5 | **Files:** `src/js/config/flags.js`, `src/js/vault/metadata-extraction.js`, `src/js/vault/session-close.js`, `src/js/api.js`, `src/js/session-types.js`, `cursor-tests/20260716_vault-metadata-extraction.mjs`
**Success criterion:** After saveVault, enqueue is async; flag off skips; idempotent via metadataExtractedAt; writes temporal/geo/INFLUENCED. Test with mocks.
**On close:** `/validate` and mark `[x]`.

### T05 — Geocode client follow-up
**Spec ref:** US2, FR-006 | **Plan ref:** Phase 0 (wire) | **Files:** `src/js/vault/metadata-extraction.js` (or `geocode-client.js`), vault save updates
**Success criterion:** placeName → proxy → resolved/failed status on entry; no direct Nominatim from client.
**On close:** `/validate` and mark `[x]`.

### T06 — Mode switcher + project filter
**Spec ref:** US3, FR-007–008 | **Plan ref:** Phase 1 | **Files:** `index.html`, `src/css/main.css`, `src/js/study.js`, `src/js/vault/vault-graph.js`, `src/js/graph/view.js` as needed
**Success criterion:** Four modes switchable; project checkboxes filter vault graph; reset on open. Follow DESIGN.md full-bleed rules.
**On close:** `/validate` and mark `[x]`.

### T07 — Timeline view
**Spec ref:** US4, FR-009 | **Plan ref:** Phase 2.8 | **Files:** `src/js/vault/graph-timeline.js` (new), wire from study/view
**Success criterion:** Dated bars/markers; undated excluded; zoom/pan via SVG viewBox.
**On close:** `/validate` and mark `[x]`.

### T08 — Map view
**Spec ref:** US5 | **Plan ref:** Phase 2.9 | **Files:** `src/js/vault/graph-map.js` (new), `index.html` (optional leaflet stubs)
**Success criterion:** Resolved markers only; click shows detail; Leaflet lazy CDN load.
**On close:** `/validate` and mark `[x]`.

### T09 — Influence Tree
**Spec ref:** US6 | **Plan ref:** Phase 2.10 | **Files:** `src/js/vault/graph-influence-tree.js` (new), `src/js/graph/canvas.js` or layout helper
**Success criterion:** Hierarchical layout; INFLUENCED-only; empty state when none.
**On close:** `/validate` and mark `[x]`.

### T10 — QA closure
**Spec ref:** SC-001–005 | **Plan ref:** Phase 3 | **Files:** `src/js/sw-update.js`, `index.html`, `sw.js`, `cursor-tests/20260716_vault-graph-views.mjs`, `ROADMAP-*.md`, quickstart
**Success criterion:** All cursor-tests green; SW trio bumped; quickstart checklist marked.
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-07-16 — none registered (implemented in-parent; no `.cursor/agents/vault-temporal-*` files).

## Notes

- Footnote: EDGE vocabulary lives in `connection-types.js` (not academic `EDGE_TYPES`), per research R4.
- Footnote: Platform LLM is DeepSeek only (`llm.js`); Mistral Small from draft maps to DeepSeek structured JSON calls.
- Footnote: Persist influence as vault entry `influences: string[]` (target entry ids) for Influence Tree; registry `INFLUENCED` type still registered for coercion/canvas. Registry upsert gated by yellow+ promotability so vault ids cannot use that path alone.
- Wave 1 quality: no CRITICAL/HIGH; `normalizePlaceNameForCache` colocated in project-membership (tiny shared helper — acceptable).
- Flag may default off until T04 spot-check, then on before T10.
