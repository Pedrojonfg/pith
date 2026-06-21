# Feature Specification: Vault Embedding Quality Layer

**Feature Branch**: `20260629-vault-embedding`  
**Created**: 2026-06-21  
**Status**: Ready for implementation  
**Input**: `spec-vaultemb.md` — deterministic embedding layer (gemini-embedding-001) under vault identity, dedup, novelty, and document similarity.

**Depends on**: `20260618-knowledge-vault-a-plus`, `20260619-knowledge-vault-post-a-plus`, `20260623-study-projects`, `20260626-cross-doc-vault`

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Novelty signal at upload (Priority: P1)

As a learner uploading material, I want to see how much of the content looks new to my vault so I can calibrate expectations before studying.

**Acceptance Scenarios**:

1. **Given** a document with concept inventory after DPP T1.6 vault linking, **When** T1.8 novelty scoring runs, **Then** each unresolved concept gets `noveltyScore` 0.0–1.0 on `shared.conceptInventory[i]`.
2. **Given** an empty project vault scope, **When** novelty scoring runs, **Then** all concepts get `noveltyScore: 1.0` with zero embedding API calls.
3. **Given** scored concepts, **When** the user reaches create-session confirmation, **Then** a badge shows average novelty (nulls excluded); null scores render as "not assessed".
4. **Given** novelty scores, **When** any downstream consumer reads them, **Then** scores never mutate vault maturity state.

### User Story 2 — Auditable dedup proposals (Priority: P1)

As a learner curating my vault, I want duplicate candidates surfaced through explicit veto gates so I can approve merges knowingly.

**Acceptance Scenarios**:

1. **Given** two concepts above the generation floor, **When** dedup gates run, **Then** each gate evaluation is logged with pass/fail reason.
2. **Given** a pair failing any gate, **When** evaluation completes, **Then** no merge proposal is created (short-circuit).
3. **Given** a pair passing all gates, **When** contradiction check returns `contradiction`, **Then** a `CONTRADICTS` edge is written instead of a merge proposal.
4. **Given** a user rejects a merge proposal, **When** the same pair is evaluated again, **Then** G4 `noUserRejectionHistory` vetoes permanently.

### User Story 3 — Safe cascade merge (Priority: P2)

As a learner approving a merge, I want every reference relinked atomically with a dry-run preview.

**Acceptance Scenarios**:

1. **Given** an approved merge proposal, **When** cascade merge runs, **Then** all `conceptId` references listed in R3.2 are relinked and source is soft-deleted (`merged_into`).
2. **Given** merge already applied, **When** merge is retried, **Then** operation is idempotent no-op.
3. **Given** a pending proposal, **When** user opens vault overlay preview, **Then** dry-run lists relink targets without committing.

### User Story 4 — Related documents in projects (Priority: P2)

As a learner in a study project, I want related-document badges and near-duplicate upload warnings.

**Acceptance Scenarios**:

1. **Given** `projectId !== 'misc'`, **When** T1.9 runs, **Then** `document_similarity` stores symmetric pairs once (`doc_id_a < doc_id_b`).
2. **Given** score ≥ 0.55, **When** doc library renders, **Then** "related document" badge appears.
3. **Given** score ≥ 0.64, **When** create-session confirmation shows, **Then** non-blocking near-duplicate warning appears.

### User Story 5 — Graceful degradation (Priority: P1)

As a learner without a Gemini API key, I want upload and DPP to complete without embedding phases blocking me.

**Acceptance Scenarios**:

1. **Given** no `gemini_api_key`, **When** DPP runs embedding phases, **Then** each reports `phaseResults[id].status === "skipped"` and pipeline continues.
2. **Given** embeddings disabled via flag, **When** any R1–R5 path is invoked, **Then** status is `skipped`, not `failed`.

### Edge Cases

- Per-concept embedding failure leaves `noveltyScore: null` (not 0).
- `MAX_CONTRADICTION_CHECKS_PER_DPP_RUN` exceeded → remaining pairs default to neutral/manual review.
- Cross-project dedup disabled by default (`CROSS_PROJECT_DEDUP_ENABLED: false`).
- T1.7 is reserved for document figure vision; novelty uses **T1.8**, document similarity uses **T1.9**.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide `embedText` / `embedBatch` via Gemini `embed_content` (768-dim Matryoshka), with mandatory `concept_embeddings` cache keyed by `(source_text_hash, model_version)`.
- **FR-002**: System MUST store embeddings in Supabase `concept_embeddings` with HNSW cosine index; `concept_id` is logical FK to global registry `concepts[].id`.
- **FR-003**: System MUST expose `findNearestConcepts` scoped to project ancestor chain via `getAncestorChain`.
- **FR-004**: DPP phase **T1.8** MUST score novelty after T1.6; skip concepts already identity-resolved to vault entries.
- **FR-005**: Dedup MUST use ordered veto gates G1–G4 in `dedup-gates.js`; proposals only, never auto-merge.
- **FR-006**: Contradiction classification MUST run only for pairs ≥ G3 threshold; respect per-run LLM cap.
- **FR-007**: Cascade merge MUST relink exhaustive `conceptId` reference graph (grep-verified); maturity takes max(gray,yellow,green); source soft-deleted.
- **FR-008**: Merge proposals MUST surface in `knowledgeVaultOverlay` with dry-run preview.
- **FR-009**: DPP phase **T1.9** MUST compute document similarity for non-misc projects using weighted summary + concepts embeddings.
- **FR-010**: All thresholds MUST live in `vault/embedding-thresholds.js`; flags in `config/flags.js`.
- **FR-011**: Embedding calls MUST run only in DPP background or explicit curation — never blocking interactive screens synchronously.
- **FR-012**: Without Gemini key or master flag off, R1–R5 phases MUST `skip` gracefully.

### Key Entities

- **ConceptEmbedding**: cached vector for concept or document scope text.
- **MergeProposal**: dedup candidate surviving gates + contradiction check.
- **DedupGateLog**: audit row per pair evaluation.
- **VaultMergeLog**: applied merge audit with relink detail.
- **DocumentSimilarity**: symmetric doc pair score with field breakdown.

## Success Criteria *(mandatory)*

- **SC-001**: Duplicate `source_text` embedding produces one API call (cache hit on second).
- **SC-002**: Empty-vault upload yields novelty 1.0 for all concepts, zero embed calls.
- **SC-003**: Each veto gate independently blocks a synthetic failing pair in tests.
- **SC-004**: Cascade merge failure leaves no partial relink (snapshot rollback).
- **SC-005**: Contradiction-classified pair never becomes merge proposal; produces `CONTRADICTS` edge.
- **SC-006**: Full DPP without Gemini key completes with embedding phases `skipped`.

## Assumptions

- **A1 (17.1)**: `concept_embeddings.concept_id` references global registry concept `id` (text UUID); no Postgres FK until registry migrates.
- **A2 (17.2)**: Per-phase skip uses existing `phaseResults[phaseId].status = "skipped"`; top-level `preparation.status` unchanged.
- **A3 (17.3)**: Novelty embed text = `label + definition`; fallback to label alone when definition empty.
- **A4 (17.4)**: `noveltyScore` is additive optional on inventory entries — no `schemaVersion` bump.
- **A5 (17.5)**: No cosine thresholds in `identity-resolution.js` (uses 0.85/0.6 token scores); embedding thresholds start as flagged placeholders.
- **A6 (17.6)**: User merge rejections stored in `merge_rejections` table (pair keyed).
- **A7 (17.7)**: `neutral` contradiction → low-confidence merge proposal (not `ASSOCIATED` edge).
- **A8 (17.8)**: No `docMeta.summary`; R5 uses `titleInferred` as summary proxy plus top-10 concept names.

## Out of Scope

- SM-2 algorithm changes, block-packing novelty ratio, embedding calibration/whitening, merge undo, production vault UI replacement, cross-lingual calibration beyond Gemini defaults.
