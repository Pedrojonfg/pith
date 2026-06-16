# Feature Specification: Concept Inventory Truncation Fix + Map-Reduce

**Feature Branch**: `20260627-inventory-truncation-map-reduce`

**Created**: 2026-06-16

**Status**: Draft

**Input**: User description: "Fix concept inventory JSON truncation on long documents; add map-reduce inventory for docs >8000 words; unify fallback across all routes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate blocks on a long dense PDF (Priority: P1)

A student uploads a long philosophy PDF and taps Generate blocks with the default pre-packing assessment flow. The system must complete concept indexing without a blocking parse error.

**Why this priority**: This is the default production path (`ASSESSMENT_BEFORE_PACKING: true`) and is currently broken for dense long documents.

**Independent Test**: Upload a ~15k-word dense PDF, generate blocks; user reaches assessment or packed blocks without "could not parse" error.

**Acceptance Scenarios**:

1. **Given** a document under 8 000 words, **When** the user generates blocks, **Then** concept inventory completes in a single pass and study continues.
2. **Given** a document over 8 000 words with document hierarchy available, **When** the user generates blocks, **Then** inventory runs in sections and merges into one ordered list.
3. **Given** inventory still fails after all retries, **When** fallback runs, **Then** the user sees an explanatory banner and receives a simplified block split instead of a dead end.

---

### User Story 2 - Recommend block count (Priority: P2)

A student uses Recommend to get a suggested block count before generating.

**Why this priority**: Recommend calls inventory-only and currently fails with the same truncation error.

**Independent Test**: Run Recommend on the same long PDF; user gets a block count suggestion or a clear recovery message.

**Acceptance Scenarios**:

1. **Given** cached inventory from a prior successful run, **When** Recommend is clicked, **Then** no new LLM inventory call is made.
2. **Given** inventory fails, **When** fallback is unavailable for recommend-only flow, **Then** user sees a dismissable error banner with guidance to narrow scope.

---

### User Story 3 - Vault ingest and recall bootstrap (Priority: P3)

Long documents ingested for vault tagging or recall bootstrap need reliable concept extraction.

**Independent Test**: Run ingest-only on a long section; concepts are indexed or user sees fallback messaging.

**Acceptance Scenarios**:

1. **Given** ingest-only upload, **When** inventory succeeds, **Then** shared concept inventory is populated.
2. **Given** terse inventory mode, **When** source-fidelity validation runs later, **Then** anchor checks are skipped with a logged warning (no false failures).

---

### Edge Cases

- Document over 8 000 words but hierarchy not yet computed → single-pass with elevated token budget until hierarchy is ready.
- One map-reduce chunk fails → merge continues with partial results; user warned about incomplete sections.
- Only one chunk after grouping → fall back to single-pass.
- Terse inventory → assessment may still run (title + scope only); pre-packing assessment skipped entirely on mono-phase fallback.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allocate explicit output token budgets for all concept inventory LLM calls (single-pass, per-chunk, merge).
- **FR-002**: System MUST detect truncated model JSON and distinguish it from schema/parse errors with distinct user messaging.
- **FR-003**: System MUST retry inventory generation with a terse schema (minimal fields) before giving up.
- **FR-004**: System MUST use the same inventory fallback/degradation path on generate (pre-packing ON), recommend, ingest-only, and recall bootstrap entry points.
- **FR-005**: System MUST use map-reduce inventory (chunk → parallel extract → merge) when word count exceeds 8 000 and document hierarchy is available.
- **FR-006**: System MUST remove dead `twoPassInventory` lever code and debug telemetry to non-existent local ingest servers.
- **FR-007**: System MUST show dismissable banners for truncation, fallback mono-phase, and partial map-reduce recovery — never silent degradation.
- **FR-008**: System MUST skip pre-packing assessment when inventory fell back to mono-phase block split.

### Key Entities

- **ConceptInventoryItem**: Teachable concept with id, order, title, scope_one_line; optional source_phrase, anchor_type, module, prerequisite_ids, concept_type.
- **InventoryChunk**: Labeled text slice derived from hierarchy for parallel extraction.
- **InventoryRunMeta**: Provenance — inventoryMode, chunkCount, failedChunks, pipeline flag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of test documents up to 8 000 words complete inventory without fallback on first attempt.
- **SC-002**: Documents over 8 000 words with hierarchy complete inventory or explicit fallback in under 3 minutes (user-perceived).
- **SC-003**: Zero blocking "could not parse" dead ends on default generate flow — user always sees recovery path or actionable banner.
- **SC-004**: Integration test suite covers truncation detection, token constants, chunk builder, and dead-code removal assertions.

## Assumptions

- Document hierarchy (`docHierarchy.tree`) is available on the main upload/generate path before inventory for long docs.
- Mono-phase fallback (`deepSeekSplitIntoBlocks`) remains an acceptable degraded experience when inventory cannot be recovered.
- English UI strings with study-language resolution follow existing `{language}` patterns.
- Map-reduce chunk parallelism capped at 8 concurrent LLM calls.
