# Feature Specification: Document Preparation Front-Load (Shared-First Pipeline)

**Feature Branch**: `20260618-document-preparation-frontload`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: Aggressive front-load on document upload — run all reusable LLM work once into `DocumentSession.shared`, amortize wait time up front, and make every study mode consume shared artifacts so mode entry is fast. Same individual LLM call shapes (no mega-prompt); orchestrate sequential vs parallel waves to minimize total wait. One document per session (fixed for session lifetime; content change ⇒ new session). Vault gray-node ingest benefits from the same pass. RSVP should show recommended block count immediately on mode open, not after another inventory wait.

**Supersedes / extends**:

- Partial behavior in `20260612-mode-continuity` (bootstrap without re-upload) — becomes the default path, not an optimization.
- `20260611-rsvp-block-recommend` — recommendation becomes **automatic on upload**, not an on-demand button (user may still edit N before pack confirm).
- `20260529-cloze-mode` R2 (isolated `cloze.epistemicGraph`) — epistemic graph becomes **canonical in shared**; Cloze mode reads/writes through shared projection.
- Cross-doc spec §10 ingest-only — ingest-only is a **subset** of this pipeline (stop after Tier 1), not a separate shape.

---

## Clarifications

### Session 2026-06-18

- Q: ¿Un solo mega-prompt? → A: **No**. Each existing LLM call shape stays; only **scheduling** changes (upload-time batch + parallelism).
- Q: ¿Documento editado mid-session? → A: **Out of scope**. One fixed document per session; different content ⇒ new `DocumentSession` (`docId` from content hash).
- Q: ¿Espera fragmentada vs única? → A: **Single upfront preparation** after upload (with resumable progress). Mode entry MUST NOT re-run Tier-1 work.
- Q: ¿Vault? → A: Tier-1 output MUST feed vault gray-node ingest (concept registry promotion) without an extra study-mode detour.
- Q: ¿Generar **todos** los bloques RSVP (explicación + preguntas por bloque) en upload? → A: **No — stays inside RSVP mode (Tier 3)**. DPP upfront stops at recommended N (deterministic from concept count + complexity signals). Block packing, assessment quiz, per-block questions/explanations, and study generation all run when the user works inside RSVP/Questions — reusing cached inventory, never re-inventor.
- Q: ¿Default block pack at recommended N on upload? → A: **No**. Only `shared.blockRecommendation` (N + rationale). `packInventoryToBlocks` runs on user **Generate blocks** in RSVP create, not in DPP.
- Q: ¿Assessment pre-packing? → A: **Still user-triggered inside RSVP mode** (optional quiz). Uses shared inventory; does not re-inventor. Profile affects pack when user runs assessment before generate.
- Q: ¿Slow Phase 0 full document on upload? → A: **Yes for Tier 2** when material length ≤ map-reduce threshold; map-reduce orientation for long docs runs in upload batch, result stored in `shared.slowOrientation`. Scope picker still filters **display/reading**; it does not re-run LLM orientation for the same scope key.
- Q: ¿Cloze ítems (fases 2–4) en upload? → A: **Yes (Tier 2)**. Items stored in `modes.cloze` (or `shared.clozeItems` — see Key Entities) during preparation so Cloze mode opens ready-to-study.
- Q: ¿Recall questions en upload? → A: **Yes (Tier 2)** with empty/default assessment signals. Re-generation offered if signals materially change (optional v1: skip regen if hash unchanged).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload once, document becomes “ready” (Priority: P1)

A student uploads a PDF from Session Hub or create flow. They see one preparation progress UI (“Preparing document…”) with phase labels. When complete, the document is **Ready** in the library: hierarchy, concepts, relations, block recommendation, cloze items, and recall questions exist in shared/mode slices. They can open any mode without repeating document understanding.

**Why this priority**: Core UX promise — one wait, many fast entries.

**Independent Test**: Upload 12k-char doc; wait for `preparationStatus: ready`; open RSVP and see recommended block count within 1s; open Cloze and see items ready without “Generate items”.

**Acceptance Scenarios**:

1. **Given** a successful upload, **When** preparation completes, **Then** `shared.preparationStatus` is `ready` and `shared.conceptInventory.length > 0`.
2. **Given** preparation `ready`, **When** the user opens mode select, **Then** no mode shows an empty upload form for that document.
3. **Given** preparation in progress, **When** the user navigates away and returns, **Then** progress resumes from last completed phase (resumable batch).

---

### User Story 2 - RSVP opens with recommended N only (Priority: P1)

A student opens RSVP for a prepared document. The Blocks field is **pre-filled** with the recommended count and a short rationale (concept count + complexity signals). No block list exists yet. User may edit N, optionally run pre-packing assessment, then **Generate blocks** — packing uses cached inventory only (no second inventory pass).

**Why this priority**: Eliminates the “wait 1 min for Recommend block count” step; packing/assessment/study remain intentional RSVP actions.

**Independent Test**: After upload prep, enter RSVP create; Blocks shows recommended N within 1s; user clicks Generate blocks; progress shows pack only, not concept indexing.

**Acceptance Scenarios**:

1. **Given** `preparationStatus: ready`, **When** RSVP create opens, **Then** recommended block count and explanation are visible without clicking Recommend.
2. **Given** prep ready, **When** user clicks **Generate blocks** without changing N, **Then** `packInventoryToBlocks` runs against cached inventory and does **not** call concept inventory LLM.
3. **Given** user changes N only, **When** they generate blocks, **Then** re-pack uses same cached inventory.
4. **Given** user opts into pre-packing assessment, **When** quiz completes, **Then** assessment uses shared inventory; pack runs after with knowledge profile — all inside RSVP, not DPP.
5. **Given** user starts studying after generate, **When** block 1 loads, **Then** per-block explanation/questions generation follows existing RSVP lazy path (unchanged).

---

### User Story 3 - Cloze and Recall open pre-generated (Priority: P1)

After upload preparation, Cloze shows valid item count and “Study” enabled. Recall shows question set ready (or generates instantly from cached slice with no inventory pass).

**Why this priority**: Eliminates duplicate epistemic extraction and second “Generate items” gate.

**Independent Test**: Upload → prep ready → enter Cloze → tap Study without pipeline button.

**Acceptance Scenarios**:

1. **Given** prep ready, **When** user enters Cloze, **Then** `pipelineStatus: ready` and valid item count > 0 without user pressing Generate.
2. **Given** prep ready, **When** user enters Recall, **Then** no “running concept inventory” step; questions load from persisted recall slice.
3. **Given** shared `conceptGraph` with edges, **When** Cloze items were generated in prep, **Then** EDGE-type items exist (not only NODE from inventory-only shortcut).

---

### User Story 4 - Slow Mode uses shared orientation (Priority: P2)

A student opens Slow Mode on a prepared document. Scope picker uses `shared.docHierarchy` immediately. Phase 0 orientation is loaded from `shared.slowOrientation` for the full document (or map-reduce sections merged); confirming scope does not trigger a fresh Phase 0 LLM unless scope key cache miss.

**Why this priority**: Removes duplicate hierarchy + Phase 0 waits on Slow entry.

**Independent Test**: Prep ready → Slow → scope screen shows hierarchy without “Analyzing structure…” spinner for standard markdown.

**Acceptance Scenarios**:

1. **Given** prep ready with hierarchy, **When** Slow scope opens, **Then** section list is populated without async hierarchy LLM.
2. **Given** `shared.slowOrientation` exists, **When** user confirms a scope already covered by orientation, **Then** Phase 0 screen renders from cache, not a new LLM call.

---

### User Story 5 - Vault gray ingest from same pass (Priority: P2)

Upload preparation promotes concepts to the concept registry as gray nodes (vault ingest) using the same inventory/graph pass — no separate “upload to vault” inventory step.

**Why this priority**: User explicitly wants front-load to serve vault; avoids duplicate indexing.

**Independent Test**: After prep, vault graph shows gray nodes for document concepts without entering any study mode.

**Acceptance Scenarios**:

1. **Given** prep completes Tier 1, **When** registry ingest runs, **Then** each shared concept with resolvable slug appears as gray node linked to `docId`.
2. **Given** user never opens RSVP, **When** prep completes, **Then** vault still benefits from gray population.

---

### User Story 6 - Parallel preparation reduces wall-clock time (Priority: P2)

Preparation orchestrator runs independent LLM calls in parallel waves where dependencies allow, so total wait is less than the sum of sequential mode pipelines.

**Why this priority**: User-requested optimization; makes aggressive front-load acceptable.

**Independent Test**: Instrument prep run; verify wave-2 jobs overlap (e.g., epistemic graph start does not wait for slow orientation if both depend only on inventory).

**Acceptance Scenarios**:

1. **Given** a medium document, **When** preparation runs, **Then** orchestrator logs/phases show parallel wave execution.
2. **Given** one parallel task fails, **When** others succeed, **Then** `preparationStatus: partial` with explicit missing artifacts and retry for failed phase only.

---

### Edge Cases

- **API key missing at upload**: Preparation pauses at first LLM phase with clear “Add API key to analyze document”; text + hash stored; retry when key present. No silent skip.
- **Offline upload**: Preparation runs Tier 0 only (normalize + deterministic hierarchy if possible); status `partial`; modes show what is missing.
- **Partial failure (e.g., Cloze QA rejects all items)**: Document still `partial`; RSVP/Recall usable; Cloze shows retry prep for Cloze phases only.
- **User changes study focus notes**: Invalidates inventory-dependent artifacts (re-run Tier 1+2); block recommendation cleared; any existing RSVP `blockIndex` in mode slice invalidated on next generate; same as block-recommend cache rules.
- **Resume prep after tab close**: Idempotent phases skip if output hash matches input fingerprint.
- **Very long document (>50k chars)**: Chunking rules unchanged per mode contracts; prep may take longer but still single batch UX.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Preparation orchestration

- **FR-001**: System MUST run **Document Preparation Pipeline (DPP)** automatically after successful upload/normalization for every new or updated `DocumentSession` (content hash change creates new session — no in-place document swap).
- **FR-002**: DPP MUST persist progress in `shared.preparation` (status, phase, wave, errors, timestamps, input fingerprint).
- **FR-003**: DPP MUST be **resumable** and **idempotent** per phase (skip phase if valid output exists for current fingerprint).
- **FR-004**: DPP MUST NOT collapse existing LLM prompts into a single mega-call; each legacy call shape remains addressable as a discrete phase.
- **FR-005**: DPP MUST schedule phases in **dependency waves** and execute parallelizable phases concurrently (see Pipeline Contract below).
- **FR-006**: On `ready` or `partial`, system MUST expose a single user-facing state on the document card: Preparing / Ready / Partial / Failed.

#### Shared outputs (Tier 1 — document understanding)

- **FR-010**: DPP MUST produce `shared.rawMarkdown` (existing), `shared.docHierarchy`, `shared.docTopics`, `shared.pedagogicalMeta` (or equivalent in hierarchy).
- **FR-011**: DPP MUST produce `shared.conceptInventory` via existing inventory pipeline (`runConceptInventoryWithFallback` / map-reduce rules unchanged).
- **FR-012**: DPP MUST produce **`shared.conceptGraph`**: canonical epistemic graph (nodes + edges with `sentence_context`, `importance`, typed relations). Source: existing Cloze Phase 0 generator; stored in shared, not only `cloze.epistemicGraph`.
- **FR-013**: DPP MUST produce **`shared.blockRecommendation`**: `{ nBlocks, rationale, signals }` via existing deterministic formula (`computeBlockCountRecommendation`) immediately after inventory.
- **FR-014**: DPP MUST run flow recommendation (`computeAndPersistModeRecommendation`) after hierarchy + text metrics available.
- **FR-015**: DPP MUST run vault gray ingest (`normalizeConceptsToVault` / registry promotion) from inventory after FR-011.

#### Shared outputs (Tier 2 — reusable mode artifacts)

- **FR-021**: DPP MUST run Cloze pipeline phases 1–4 using `shared.conceptGraph`, persisting items to **`modes.cloze`** with `pipelineStatus: ready` when any valid items exist.
- **FR-022**: DPP MUST run Recall question generation using `shared.conceptInventory` + pedagogical meta, persisting **`modes.recall`** slice in `ready` or `bootstrap` state.
- **FR-023**: DPP MUST run Slow full-document Phase 0 orientation when applicable, persisting **`shared.slowOrientation`** (and dual-write concepts to inventory per existing `syncPhase0ConceptsToShared` rules).

#### RSVP / Questions (Tier 3 — inside mode, not DPP)

- **FR-025**: DPP MUST NOT run `packInventoryToBlocks`, pre-packing assessment, or `ensureBlockGenerated` — these stay on the RSVP/Questions create and study path.
- **FR-026**: RSVP/Questions create MUST consume `shared.blockRecommendation.nBlocks` as the pre-filled default for the Blocks field when prep is ready.
- **FR-027**: On **Generate blocks**, RSVP/Questions MUST use cached `shared.conceptInventory` (via existing block-split cache / fingerprint contract) and MUST NOT re-run concept inventory when fingerprint matches.

#### Mode entry (consumption)

- **FR-030**: `resolveModeEntryState` MUST treat `preparationStatus: ready|partial` with required artifacts as **`bootstrap`** — never `upload_required` for same document.
- **FR-031**: RSVP/Questions MUST read recommended N from `shared.blockRecommendation` on mode open; MUST NOT call concept inventory on open or on generate when fingerprint matches.
- **FR-032**: Cloze MUST NOT run Phase 0 LLM on mode open when `shared.conceptGraph` exists; pipeline phases 1–4 skipped if prep already stored ready items.
- **FR-033**: Recall MUST NOT run inventory on mode open when `shared.conceptInventory` populated; question LLM skipped when recall slice prep-ready.
- **FR-034**: Slow MUST prefer `shared.docHierarchy` and `shared.slowOrientation` over per-entry LLM.
- **FR-035**: Mode-specific **Tier 3** work remains user-triggered inside modes: RSVP block packing, pre-packing assessment quiz, per-block explanation/questions generation, Slow Phase 1+ annotations, SM-2 updates.

#### UI

- **FR-040**: Upload flow MUST show unified progress: phase name, wave indicator, optional time estimate; replaces per-mode “Generate items/blocks” for Tier 1–2 work.
- **FR-041**: RSVP create MUST show recommended block count and rationale on open when prep complete (no Recommend button required).
- **FR-042**: Document library MUST show preparation badge (Preparing / Ready / Partial).

#### Failure & partial readiness

- **FR-050**: Phase failure MUST set `preparationStatus: partial` if Tier 1 complete; `failed` if Tier 1 blocked.
- **FR-051**: Retry MUST re-run only failed phases and downstream dependents, not the full DPP.

### Non-Functional Requirements

- **NFR-001**: Mode entry after `ready` MUST add ≤500ms local work before interactive UI (excluding Tier 3 study generation).
- **NFR-002**: Preparation MUST NOT block UI thread; progress via async orchestrator (same patterns as existing pipelines).
- **NFR-003**: Total LLM token spend per document MUST NOT exceed sum of legacy per-mode calls for the same user journey (no duplicate inventory/graph extraction).

### Key Entities

- **`shared.preparation`**: `{ status, fingerprint, startedAt, completedAt, currentPhase, waves[], phaseResults{}, errors[] }`
- **`shared.conceptGraph`**: `{ nodes[], edges[] }` — canonical epistemic graph (supersedes cloze-only storage for new sessions)
- **`shared.blockRecommendation`**: `{ nBlocks, rationale, computedAt, signals{} }` — deterministic only; no packed blocks
- **`shared.slowOrientation`**: Phase 0 payload keyed by document fingerprint / scope cache keys
- **`DocumentSession.schemaVersion`**: bump + migration: copy legacy `cloze.epistemicGraph` → `shared.conceptGraph` when missing; backfill `preparation.status = legacy` for old docs

---

## Pipeline Contract (implementation reference)

Phases retain existing module boundaries (`normalization/`, `session.js`, `cloze/pipeline.js`, `slow/phase0.js`, `recall-api.js`, etc.).

### Tier 0 — deterministic (sync/async, no LLM)

| Phase | Output |
|-------|--------|
| T0.1 Normalize | `shared.rawMarkdown`, `uploadMeta` |
| T0.2 Text metrics | word count, flow analyzer inputs |

### Tier 1 — understanding (LLM)

| Phase | Depends on | Legacy call |
|-------|------------|-------------|
| T1.1 Document hierarchy | T0.1 | `buildDocumentHierarchy` |
| T1.2 Concept inventory | T1.1 (map-reduce if long) | `runConceptInventoryWithFallback` |
| T1.3 Concept graph | T0.1 (parallel with T1.2 after T0) | Cloze `generateEpistemicGraph` |
| T1.4 Block recommendation | T1.2 | `computeBlockCountRecommendation` (deterministic) |
| T1.5 Flow recommendation | T1.1, T0.2 | existing recommendation module |
| T1.6 Vault gray ingest | T1.2 | registry promotion |

**Parallelism**: T1.1 and T0.2 parallel; T1.3 can start after T0.1 (parallel with T1.2); T1.4 after T1.2; T1.5 after T1.1; T1.6 after T1.2.

### Tier 2 — mode artifacts (LLM)

| Phase | Depends on | Legacy call |
|-------|------------|-------------|
| T2.1 Cloze analysis + items | T1.3 | Cloze phases 1–4 |
| T2.2 Recall questions | T1.2, T1.5 | `generateRecallQuestions` |
| T2.3 Slow orientation | T1.1 | `generatePhase0ForScope` (full doc) |

**Parallelism**: T2.1, T2.2, T2.3 parallel after Tier 1 complete.

### Tier 3 — stays on mode/study path (not DPP v1)

**RSVP / Questions**

- Block packing (`packInventoryToBlocks`) at user-chosen N (default from `shared.blockRecommendation`)
- Pre-packing assessment quiz + knowledge profile (optional)
- Per-block explanation + questions (`ensureBlockGenerated`, prefetch, etc.)

**Other modes**

- Slow Phase 1+ reading, annotations, enriched graph unlock
- SM-2 / vault yellow-green promotion from study events

---

## Success Criteria

- **SC-001**: Upload-to-RSVP-create (recommended N visible, zero inventory LLM on open) ≤ legacy upload + on-demand recommend inventory latency, measured on 12k-char fixture.
- **SC-001b**: RSVP **Generate blocks** after prep skips concept inventory (pack-only progress), verified on same fixture.
- **SC-002**: Upload-to-Cloze-study-start with zero additional LLM phases on happy path.
- **SC-003**: Zero duplicate concept inventory runs when user opens RSVP → Cloze → Recall in sequence on prepared doc.
- **SC-004**: `shared.conceptGraph.edges.length > 0` on argumentative fixture (EDGE cloze items possible).
- **SC-005**: Vault shows gray nodes after prep without entering a study mode.

---

## Out of Scope (v1)

- Multi-file upload per session
- Any DPP-time block packing or RSVP block content generation (pack, assessment, per-block gen stay in mode)
- Replacing optional assessment quiz timing or moving it to upload
- Merging Slow scope-specific re-orientation when user picks scope narrower than full-doc cache (v1: filter UI only; v2: scope-keyed orientation cache)
- Supabase migration (localStorage only; same store seams)

---

## Relationship to Existing Specs

| Spec | Relationship |
|------|----------------|
| `20260612-mode-continuity` | Extended: shared layer becomes prepopulated by DPP, not filled opportunistically |
| `20260611-rsvp-block-recommend` | Recommend becomes automatic output of DPP; manual button deprecated or hidden when prep ready |
| `20260529-cloze-mode` | Phase 0 graph canonicalized to shared; “Generate items” default skipped when prep ready |
| `20260621-recall-mode` | Bootstrap/default slice created in DPP |
| `20260626-cross-doc-vault` | Ingest-only path = DPP Tier 1 stop early |
| `20260627-inventory-truncation-map-reduce` | Inventory phase uses existing fallback contract unchanged |

---

## Open Questions (non-blocking for draft)

1. **Study focus notes**: If user edits notes *after* prep, full Tier 1 rerun vs incremental — default: full rerun (matches block-recommend invalidation).
2. **Recall regen**: Auto-regenerate recall slice when assessment signals change materially post-RSVP, or manual “Refresh questions” — default: manual v1.
3. **Partial prep UX**: Allow entering RSVP with only Tier 1 complete while Tier 2 still running in background — default: yes (progressive readiness).
