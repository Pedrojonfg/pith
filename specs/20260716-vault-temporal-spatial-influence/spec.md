# Feature Specification: Vault Temporal, Spatial, and Influence Views

**Feature Branch**: `20260716-vault-temporal-spatial-influence`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: `spec-newviews.md` — extend Knowledge Vault with automatic temporal range, geographic location, and directed influence metadata at vault-promotion time; expose Timeline, Map, and Influence Tree alternate renderings of the vault graph with shared project filtering.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Background metadata extraction on vault promotion (Priority: P1)

When a concept earns a Knowledge Vault entry (retrieval-driven promotion), the system automatically extracts optional temporal range and place name for that concept, and checks for directed influence relationships with its immediate neighbors. Extraction runs in the background and never delays study-mode entry or the vault-promotion call itself.

**Why this priority**: Without extracted metadata, the three new views have nothing to render. Triggering at promotion (not DPP) keeps study latency unchanged and limits LLM/geocoding volume to earned concepts only.

**Independent Test**: Promote a fixture concept with a known historical place/date; assert vault entry gains `temporalRange` / `geoLocation` (or nulls) and promotion returns before extraction completes; assert kill-switch off skips extraction entirely.

**Acceptance Scenarios**:

1. **Given** vault metadata extraction enabled and a concept newly promoted into the vault, **When** promotion completes, **Then** the promotion path returns immediately and an async job later writes `temporalRange`, `geoLocation` (possibly null), and optional `INFLUENCED` edges without blocking study entry.
2. **Given** a vault entry that already has `metadataExtractedAt` set, **When** the same concept is promoted again, **Then** extraction is skipped (idempotent).
3. **Given** the kill-switch flag is off, **When** a concept is promoted, **Then** no extraction or geocoding jobs run.
4. **Given** malformed LLM JSON or a failed job, **When** extraction fails, **Then** fields remain null, the failure is logged, and the user is not blocked.

---

### User Story 2 - Place names resolve to map coordinates asynchronously (Priority: P1)

After extraction returns a place name, the system geocodes it via a server-side Nominatim proxy with caching and rate limiting. Only successfully resolved locations appear on the Map view.

**Why this priority**: Map view depends on lat/lng; client-side Nominatim would violate usage policy and duplicate work across users.

**Independent Test**: Cache miss → Edge Function call → vault entry `geocodeStatus: "resolved"` with lat/lng; cache hit → no Nominatim call; failed geocode → `geocodeStatus: "failed"`, excluded from map.

**Acceptance Scenarios**:

1. **Given** a vault entry with `geoLocation.placeName` and no cache hit, **When** the geocode job runs, **Then** Nominatim is called at most once per normalized place name, the result is stored in the global geocode cache, and the entry is updated to `geocodeStatus: "resolved"` with lat/lng.
2. **Given** a normalized place name already in `geocode_cache`, **When** another entry needs the same place, **Then** Nominatim is not called again.
3. **Given** geocoding fails, **When** the job finishes, **Then** `geocodeStatus` is `"failed"` and the concept is omitted from the Map view.

---

### User Story 3 - Switch vault graph among node, timeline, map, and influence views (Priority: P1)

On the existing vault/material graph screen, the learner switches among Node graph, Timeline, Map, and Influence Tree. A shared project multi-select filter (all projects checked by default) applies to all modes. Filter state resets on each open (no persistence).

**Why this priority**: This is the user-visible product surface; metadata without views delivers no value.

**Independent Test**: Open vault graph with fixture entries spanning projects/dates/places/influence edges; switch modes; toggle project checkboxes; assert inclusion/exclusion rules per view.

**Acceptance Scenarios**:

1. **Given** the vault graph screen open, **When** the learner selects Timeline / Map / Influence Tree / Node, **Then** the same screen re-renders in that mode without navigating to a new screen.
2. **Given** multiple projects, **When** the learner unchecks a project, **Then** concepts whose project membership is only that project disappear from all three alternate views (and the node view when filtered).
3. **Given** the graph screen is closed and reopened, **When** the project filter appears, **Then** all projects are checked again.

---

### User Story 4 - Timeline view of dated concepts (Priority: P2)

The Timeline view shows filtered vault concepts that have a non-null `temporalRange` as horizontal bars (or markers for point-in-time ranges) on a year axis, with zoom/pan for large scale spans.

**Why this priority**: Primary alternate visualization for temporal metadata; depends on US1 data and US3 chrome.

**Independent Test**: Fixture with Paleolithic + 20th-century ranges; assert axis spans min–max years, undated concepts absent, zoom/pan works without a new charting library.

**Acceptance Scenarios**:

1. **Given** filtered concepts with `temporalRange`, **When** Timeline opens, **Then** each dated concept renders from `startYear` to `endYear` (marker when range is effectively a point).
2. **Given** concepts with `temporalRange === null`, **When** Timeline renders, **Then** they are excluded entirely.
3. **Given** a wide year span, **When** the learner zooms/pans, **Then** the view remains usable without pulling in a new charting dependency.

---

### User Story 5 - Map view of geocoded concepts (Priority: P2)

The Map view shows one marker per filtered concept with `geoLocation.geocodeStatus === "resolved"`. Clicking a marker shows concept label + definition using the existing graph detail pattern. Pending/failed geocodes are omitted.

**Why this priority**: Spatial counterpart to Timeline; depends on US2 geocoding and US3 chrome.

**Independent Test**: Fixture with resolved vs pending vs failed locations; assert only resolved markers; marker click shows detail.

**Acceptance Scenarios**:

1. **Given** resolved geo locations in the filtered set, **When** Map opens, **Then** each appears as a marker on an OpenStreetMap-based map (CDN Leaflet or equivalent no-bundler approach).
2. **Given** pending or failed geocodes, **When** Map renders, **Then** those concepts are not shown.
3. **Given** a marker, **When** the learner taps it, **Then** label + definition appear via the existing detail popover/panel pattern.

---

### User Story 6 - Influence Tree view (Priority: P2)

The Influence Tree shows a directed tree/DAG using only `INFLUENCED` edges among filtered vault concepts. Roots are concepts with no incoming `INFLUENCED` edge in the filtered set.

**Why this priority**: Completes the three-view promise; depends on US1 influence edges and US3 chrome.

**Independent Test**: Fixture DAG of `INFLUENCED` edges; assert roots, layout is hierarchical (not the existing column layout alone), non-influence edges ignored.

**Acceptance Scenarios**:

1. **Given** filtered concepts with `INFLUENCED` edges, **When** Influence Tree opens, **Then** only those edges are used and roots have no incoming influence edge in the filtered set.
2. **Given** other edge types (prerequisite, associated, etc.), **When** Influence Tree renders, **Then** they do not appear as tree links.
3. **Given** no influence edges in the filtered set, **When** Influence Tree opens, **Then** the view shows an empty/clean state rather than falling back to the full node graph.

---

### Edge Cases

- Concept with date but no place (or vice versa): one field null, the other populated; concept appears only in the applicable view.
- Precise date: `startYear === endYear` rendered as a marker, not a zero-width bar.
- BCE years: astronomical numbering (negative years); axis and labels must not off-by-one.
- Concept merged across documents in different projects: included if **any** of its project memberships is checked.
- Legacy vault entries without metadata: treated as null temporal/geo; excluded from Timeline/Map until (re)extracted — no backfill required in this feature unless an entry is re-promoted without `metadataExtractedAt`.
- Nominatim throttling: jobs queue and resolve later; Map simply lacks markers until resolved.
- Extraction must **not** be added to DPP `PHASE_RUNNERS` / `session-prep-gate`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST trigger temporal/spatial/influence extraction only when a concept is promoted into the Knowledge Vault, asynchronously after persistence, never as a DPP phase and never blocking `session-prep-gate` or study-mode entry.
- **FR-002**: System MUST store on each vault entry optional `temporalRange` (`startYear`, `endYear`, `label`), optional `geoLocation` (`placeName`, `lat`, `lng`, `geocodeStatus`), and `metadataExtractedAt` for idempotency.
- **FR-003**: System MUST add directed edge type `INFLUENCED` (`from` influenced `to`) to the concept-registry connection type vocabulary (and canvas stroke styling), without colliding with existing stroke conventions.
- **FR-004**: System MUST provide a single kill-switch `isVaultMetadataExtractionEnabled()` (default on after verification; may ship default-off until spot-checked), not a per-phase DPP flag.
- **FR-005**: Date/place extraction and influence detection MUST use small structured-JSON LLM calls (Mistral Small), temperature 0.1, with named `max_tokens` constants; prefer omission over guessing; influence must not duplicate existing connection types.
- **FR-006**: Geocoding MUST run server-side (Supabase Edge Function), enforce Nominatim User-Agent + ≤1 req/s + global `geocode_cache` table; clients MUST NOT call Nominatim directly.
- **FR-007**: Project filtering MUST include a vault entry if any of its project memberships (resolved from entry sources → document sessions, and/or stored `projectIds` if added) is checked; all projects checked by default; filter state NOT persisted across opens.
- **FR-008**: System MUST add a render-mode switcher on the existing graph screen (Node / Timeline / Map / Influence Tree) rather than new primary screens.
- **FR-009**: Timeline MUST exclude undated concepts; Map MUST exclude non-`resolved` geocodes; Influence Tree MUST use only `INFLUENCED` edges.
- **FR-010**: System MUST NOT add manual edit UI for date/place/influence, combined map+timeline animation, anatomical views, or multi-provider geocoding abstractions in this feature.
- **FR-011**: System MUST NOT build a new general-purpose job framework; reuse existing fire-and-forget / status-on-entity patterns (visionStatus / upload-queue style) with minimal new code.

### Key Entities

- **VaultEntry metadata**: `temporalRange`, `geoLocation`, `metadataExtractedAt`, optional `projectIds` (if denormalized).
- **INFLUENCED connection**: directed causal/inspirational edge among concepts.
- **GeocodeCache**: global normalized place name → lat/lng + raw response.
- **Graph render mode**: `node` | `timeline` | `map` | `influence_tree`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Vault promotion call path returns without waiting for extraction/geocoding (async job starts after save); study-mode entry latency unchanged vs baseline without this feature.
- **SC-002**: Identical normalized place names across users/entries produce at most one Nominatim request (cache hit thereafter) in automated or integration tests.
- **SC-003**: With fixture vault data, learners can switch among four render modes and filter by project with correct inclusion rules for Timeline (dated only), Map (resolved only), and Influence Tree (`INFLUENCED` only).
- **SC-004**: Kill-switch off → zero extraction/geocode side effects on promotion.
- **SC-005**: Failed extraction/geocode leaves null/failed status without user-blocking errors on the study path.

## Assumptions

- **Project membership without new required schema**: Vault entries do not currently store `projectId`. Filtering resolves projects via existing `sources[].docId → DocumentSession.projectId` (study-projects contract). If that resolution is insufficient for entries lacking resolvable sources, add additive `projectIds: string[]` (default `["misc"]` / empty → treat as misc) written at merge/promotion time — prefer resolution-first to avoid schema churn.
- **Promotion hook**: Best hook is immediately after `saveVault(vault)` in `updateVaultFromSession()` (`session-close.js`); also cover other creation paths (`commitVaultCurationItem`, manual add, import) with the same enqueue helper so all promotions extract once.
- **Background jobs**: No unified job queue exists. Reuse fire-and-forget `void …catch` plus status fields on the entry (`geocodeStatus`, `metadataExtractedAt`), similar to image `visionStatus`. Persist a tiny pending queue in localStorage only if resume-after-reload is needed for in-flight geocodes; otherwise keep ephemeral.
- **Edge vocabulary home**: User draft cited `graph/build.js` EDGE_TYPES, but `PREREQUISITE|…|ASSOCIATED` live in `concept-registry/connection-types.js`. Add `INFLUENCED` there; add canvas stroke for the rendered type string; vault Influence Tree reads registry connections and/or a vault-side edge list derived at extraction time.
- **Graph chrome**: `screenSlowGraph` has no render-mode switcher yet — add one. Layout today is fixed column layout in `canvas.js`; Influence Tree needs a new hierarchical layout helper (no existing tree algorithm).
- **Filter persistence**: None today for graph filters — reset to all-checked on each open.
- **Leaflet via CDN**: Acceptable under no-bundler constraint (same pattern as MathJax/marked).
- **Flag default**: Implement behind flag; default **on** in final ship after spot-check (dev may temporarily default off during Wave 1 extraction wiring per risk-ordered steps).
- **No combined map+timeline, no manual correction UI, no LocationIQ** in this iteration.
- **Year granularity only**: no month/day fields.
