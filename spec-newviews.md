# Spec: Vault Temporal, Spatial, and Influence Views

**Folder:** `specs/20260716-vault-temporal-spatial-influence/`
**Supersedes:** none
**Status:** ready for implementation

---

## 1. Goal

Extend the existing Knowledge Vault concept graph with three additional automatic metadata dimensions — **temporal range**, **geographic location**, and **directed influence relationships** — and expose them as three new alternate renderings of the vault graph: a **Timeline view**, a **Map view**, and an **Influence Tree view**. All three are read-only visualizations layered on top of data collected **at vault-entry-promotion time** (not during DPP — see §4); none require manual user tagging.

**Trigger point, revised:** extraction does NOT run during DPP for every concept in every uploaded document. It runs only for a concept that is actually promoted into the Knowledge Vault (the same retrieval-earned-entry moment already used elsewhere in the app), and it runs asynchronously in the background — it never blocks DPP completion or the `session-prep-gate` that gates entry into study modes. Rationale: (1) DPP already gates study-mode entry, so putting an LLM extraction step there would delay the user from starting to study something they don't need this data for; (2) the vault-entry-promotion set is a small fraction of the full per-document concept inventory (vault entries are earned, not generated), so triggering here instead of at DPP time cuts LLM and geocoding volume by roughly an order of magnitude or more.

Filtering by project (checkbox multi-select, all projects checked by default) applies to all three views.

## 2. Non-goals

- No combined animated map+timeline ("watch knowledge move over time").
- No domain-specific anatomical/body view.
- No manual UI for a user to hand-edit a concept's date range, location, or influence edges in this iteration. If extraction is wrong, it's simply absent/wrong until a future spec adds correction UI.
- No per-session toggle for enabling/disabling extraction — it always runs automatically at vault-promotion time, gated by a single kill-switch flag (see §4).
- No synchronous "wait for extraction" UX anywhere — extraction and geocoding are always background/best-effort relative to whatever the user is doing.
- No new geocoding provider abstraction beyond Nominatim (see §6) — if Nominatim proves insufficient, that's a separate spec.

## 3. Data model changes

### 3.1 `conceptInventory` entries (`shared.conceptInventory[i]`)

Add three optional fields, populated by the vault-promotion hook (§4) — note these live on the **vault entry**, not necessarily on the raw per-document `conceptInventory` entry, since extraction only happens for concepts that reach the vault (see §4 for exactly where this data is stored):

```
temporalRange: {
  startYear: number,   // astronomical year numbering (negative = BCE), required if present
  endYear: number,     // >= startYear
  label: string        // LLM's original phrase, e.g. "circa 1200 BCE", "the Paleolithic", "July 3, 1936"
} | null

geoLocation: {
  placeName: string,       // LLM's extracted place name, e.g. "Alexandria"
  lat: number | null,      // filled by geocoding step; null until resolved
  lng: number | null,
  geocodeStatus: "pending" | "resolved" | "failed"
} | null
```

A precise date is represented as a range where `startYear === endYear` (or a 1-day-equivalent range if day-level precision matters — for this spec, year-level granularity is sufficient; do not add month/day fields). Width of the range is the only "precision" signal the UI needs — no separate confidence field.

### 3.2 `conceptGraph` edges (`shared.conceptGraph.edges`)

Add new edge type `INFLUENCED` to the existing type union (currently `PREREQUISITE | CONTRADICTS | EXEMPLIFIES | PART_OF | ASSOCIATED`, defined in `graph/build.js` `EDGE_TYPES`).

- Directed: `{ from: conceptId, to: conceptId, type: "INFLUENCED", weight: number }` means **`from` influenced `to`**.
- Add to `EDGE_TYPES` in `graph/build.js` alongside the existing five.
- Add a stroke style for `INFLUENCED` in `graph/canvas.js` (distinct from the other five — open question for Cursor: pick a style consistent with existing conventions, e.g. dashed vs solid is already used for one of the existing types, so don't collide).

### 3.3 Global geocode cache (new Supabase table)

```sql
create table geocode_cache (
  place_name_normalized text primary key,  -- lowercased, trimmed
  lat double precision,
  lng double precision,
  resolved_at timestamptz,
  raw_response jsonb  -- store full Nominatim response for debugging
);
```

This is a **cross-user, global** cache — same rationale as the cross-user DPP result cache already in `a_implementar`. Before geocoding any `placeName`, normalize (lowercase, trim) and check this table first.

### 3.4 Vault entry → project linkage (open question, must be resolved first)

**Open question for Cursor, resolve via repo inspection before writing any other code in this spec:** does a Knowledge Vault entry (`pith_knowledge_vault` / `pith_knowledge_vault_data`) currently store the `projectId` of the document it was earned from? Check `vault/vault-store.js` and `vault/session-close.js`.

- If yes: proceed directly to §7 (views).
- If no: add `projectId` (or `projectIds: string[]` if a single concept can be reinforced from documents in different projects — check whether that's possible given how vault entries merge across documents) as a field written at vault-entry-creation time in `session-close.js`, sourced from the originating `DocumentSession.projectId`. This is an additive field; do not touch existing vault entry migration logic beyond adding the new field with a safe default (`null` / `"misc"` matching the existing project-migration default) for pre-existing entries.

This must be resolved and confirmed working before implementing the project-filter checkboxes in §7, since all three views depend on it.

## 4. Vault-promotion trigger (replaces DPP phase — do NOT add this to the DPP phase list)

This is **not** a DPP phase and must not be added to `document-preparation.js` `PHASE_RUNNERS` / `PHASE_DEPS` / `PHASE_LABELS`. It does not gate `session-prep-gate` or anything else that blocks study-mode entry.

**Hook point:** wherever a concept is currently promoted into the Knowledge Vault (i.e. earns a vault entry via retrieval signal — open question below on exact call site), enqueue an async background job for that single concept. Do not run this synchronously inside the promotion code path — promotion must complete and return immediately regardless of extraction outcome.

- **Trigger granularity:** per concept, at the moment of its individual promotion — not batched per document, not batched per DPP run. A given concept is processed once; if the same canonical concept is promoted again later (e.g. re-earned after a registry merge), skip re-processing if `temporalRange`/`geoLocation`/influence-check already ran for it (store a simple `metadataExtractedAt` timestamp on the vault entry to make this idempotent).
- **LLM calls, per promoted concept:**
  1. **Date/place extraction** — single small call per concept (no batching needed at this volume — see rationale in §1) asking the LLM: does this concept have an associated date range and/or place? Return `null` for either if not applicable. Model: **Mistral Small**.
  2. **Influence detection** — a second call, scoped to the promoted concept plus its immediate neighbors in `conceptGraph` (not the whole graph — this is now per-concept, not per-document), asking whether any directed "A influenced B" relationship exists between this concept and its neighbors that isn't already one of the other five edge types. Also Mistral Small. Output: `{from, to, weight}` triples inserted as `INFLUENCED` edges via the same edge-insertion path used by DPP T1.3's graph builder.
- **Feature flag:** single kill-switch flag in `config/flags.js`, e.g. `isVaultMetadataExtractionEnabled()`, default **on**. This is a global on/off, not a per-phase DPP flag — there is no phase to gate.
- **Failure handling:** if a job fails or returns malformed JSON, log and leave the fields `null` on that vault entry; do not retry automatically beyond whatever generic retry-with-backoff wrapper already exists for background jobs (reuse existing pattern, don't build a new retry mechanism for this specifically).
- **Geocoding:** enqueued as a follow-up step once the extraction job returns a non-null `geoLocation.placeName` — check `geocode_cache` first (§3.3); only call Nominatim on a cache miss. Runs on the same async/best-effort basis; updates `geoLocation.geocodeStatus` on the vault entry when resolved (mirrors the `shared.images[].visionStatus` async pattern from DPP T1.7 — reuse that pattern rather than inventing a new async-status mechanism).
- **Backpressure note:** because this is now driven by vault-promotion events (inherently rate-limited by real user study activity, not by document upload volume) and backed by a global cache, the 1 req/sec Nominatim ceiling (§6) is expected to be sufficient at current and near-term scale. If a future traffic spike saturates the geocoding queue, jobs simply queue and resolve later — nothing user-facing breaks. Re-evaluate provider choice only if queue depth becomes a persistent, measured problem (see §6 fallback note).

## 5. Prompt design notes (for `api.js`)

- Temperature: 0.1 (structured JSON output), per existing project convention.
- Explicit `max_tokens` constant per project rules — name it consistently with existing constants in `api.js` (e.g. `MAX_TOKENS_TEMPORAL_SPATIAL_EXTRACTION`).
- Prompt must explicitly instruct the LLM to return year ranges using astronomical year numbering (negative for BCE) to avoid off-by-one BCE/BC ambiguity, and to prefer omission over guessing when a concept has no clear date/place.
- Influence-detection prompt must explicitly instruct the LLM not to duplicate existing `ASSOCIATED`, `PREREQUISITE`, `CONTRADICTS`, `EXEMPLIFIES`, or `PART_OF` edges — `INFLUENCED` is reserved for causal/inspirational directional relationships not already captured.

## 6. Geocoding integration

- **Provider:** Nominatim (OpenStreetMap), free, no API key.
- **Compliance requirement (Nominatim usage policy):** must set a descriptive `User-Agent` header identifying the app, must cache results (already required by §3.3 — this is not optional, it's a ToS condition), and must not exceed 1 request/second. Implement a simple request queue/throttle in the Edge Function that calls Nominatim — do not fire geocoding requests directly from the client.
- Route the geocoding call through a Supabase Edge Function (same proxy pattern as `llm-proxy`), not directly from client JS, to keep the throttling and cache-check server-side and avoid duplicate concurrent requests for the same place from different users.
- **Fallback if throttling becomes a real bottleneck:** LocationIQ offers a free tier built on the same OpenStreetMap data with a more generous requests-per-second limit than raw Nominatim. Switching providers later is a contained change (one Edge Function, one queue) — do not build a multi-provider abstraction preemptively (§2 non-goals).

## 7. New views

All three views live as alternate render modes of the existing vault/material graph screen (`screenSlowGraph`), the same way it's implied the graph can already show different layouts — add a mode switcher (node graph / timeline / map / influence tree) rather than new screens. If `screenSlowGraph` does not currently support a render-mode switcher, add one; this is additive UI, not a rework of the existing node-graph rendering path.

### 7.1 Project filter (shared across all three views)

- Checkbox list of all projects (from `project-store.js`), all checked by default.
- Filtering logic: a vault entry is included if its `projectId` (or any of `projectIds`, per §3.4 resolution) is checked.
- This filter state does not need to persist across sessions — reset to "all checked" on each view open, unless Cursor finds an existing pattern for persisting graph-view filters (check first, follow existing convention if one exists).

### 7.2 Timeline view

- X-axis: year (astronomical numbering), spanning from the earliest `startYear` to the latest `endYear` across all filtered, resolved vault concepts with non-null `temporalRange`.
- Each concept renders as a horizontal bar/segment from `startYear` to `endYear`. Point-in-time concepts (narrow range) render as a marker, not a degenerate zero-width bar.
- Zoom/pan required given the likely huge scale range (a Paleolithic entry next to a 20th-century entry) — reuse an existing charting approach already present in the codebase if one exists (check `graph/canvas.js` for SVG conventions already in use) rather than pulling in a new charting library.
- Concepts with `temporalRange === null` are excluded from this view entirely (not shown as "undated" markers — keep the view clean).

### 7.3 Map view

- Render using a free tile provider (OpenStreetMap tiles via Leaflet, or reuse whatever mapping approach is simplest to integrate without a bundler, consistent with the project's no-bundler vanilla-JS constraint — Leaflet works fine loaded via CDN script tag, same pattern as MathJax/marked).
- One marker per concept with `geoLocation.geocodeStatus === "resolved"`. Concepts with `"pending"` or `"failed"` status are excluded (not shown as broken markers).
- Marker click/tap shows concept label + definition (reuse existing graph node detail popover pattern from `graph/view.js` if one exists).

### 7.4 Influence Tree view

- Directed tree/DAG layout using only `INFLUENCED` edges among filtered vault concepts.
- Root nodes: concepts with no incoming `INFLUENCED` edge among the filtered set.
- Reuse `graph/canvas.js` SVG rendering conventions, just with a tree/hierarchical layout algorithm instead of the force-directed or whatever layout the node view currently uses — check what layout primitive is already available before adding a new one.

## 8. Risk-ordered implementation steps

1. Resolve the vault→project linkage open question (§3.4) — isolated, low-risk, blocks everything else.
2. Resolve the vault-promotion hook-point open question (§9) — identify the exact call site where a concept becomes a vault entry.
3. Add `INFLUENCED` to `EDGE_TYPES` + canvas stroke style — isolated, no behavior change until edges exist.
4. Create `geocode_cache` table + Edge Function geocoding proxy with throttling — isolated, no callers yet.
5. Implement the vault-promotion background job (extraction only, behind flag, default off during dev) — writes `temporalRange`/`geoLocation`/`INFLUENCED` edges on vault entries but nothing reads them yet. Confirm it does not block or slow the promotion call path itself.
6. Wire geocoding follow-up step to consume the extraction job's output.
7. Flip flag to default-on once output is verified against real vault promotions (spot-check manually before enabling for all users).
8. Add project-filter UI (shared component) — depends on step 1.
9. Add Timeline view.
10. Add Map view.
11. Add Influence Tree view.

Steps 9–11 are independent of each other and can be built/tested in any order once steps 1–8 are done.

## 9. Open questions for Cursor (resolve via repo inspection, do not guess)

- §3.4: does vault entry already carry `projectId`? (blocks step 1)
- **Exact vault-promotion call site:** where in the codebase does a concept currently get promoted into the Knowledge Vault (i.e. where does a vault entry get created from a retrieval signal)? Likely in `vault/vault-store.js` or `vault/session-close.js` — confirm and identify the single best hook point to enqueue the background job without adding synchronous work to that path.
- **Existing background job infrastructure:** does the project already have any async/background job queue mechanism (e.g. for the `shared.images[].visionStatus` async pattern referenced in §4), or would this be the first one? If one exists, reuse it; if not, flag back before building a new one from scratch — that's a bigger decision than this spec's scope.
- Does `screenSlowGraph` already have any render-mode switching mechanism, or is this the first one? (affects step 9-11 approach)
- Does `graph/canvas.js` already use any layout algorithm suitable for a tree (step 11), or does one need to be added from scratch?
- Does the project already have an existing pattern for persisting UI filter state across view opens? (affects §7.1)
