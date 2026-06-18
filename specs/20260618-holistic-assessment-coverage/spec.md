# Feature Specification: Holistic Pre-Packing Assessment Coverage

**Feature Branch**: `20260618-holistic-assessment-coverage`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: Pre-packing assessment quiz must cover the **entire curriculum holistically** — concepts and **relationships** across all document sections, not a handful of questions biased toward the opening blocks. Scale question count as needed (more LLM calls and shared markdown usage are acceptable). Goal: exhaustive discovery of which nodes and edges the learner already knows before block packing.

**Extends**:

- `20260611-rsvp-assessment-reposition` — knowledge_profile → pack
- `20260612-rsvp-assessment-questions-parity` — Questions-mode schema and runner
- `20260618-document-preparation-frontload` — shared inventory, hierarchy, rawMarkdown available at assessment time

---

## Clarifications

### Session 2026-06-18

- Q: ¿Sigue siendo opcional el assessment? → A: **Sí**. User-triggered inside RSVP; skip unchanged.
- Q: ¿Reemplazar n_test/n_socratic del create form? → A: **No para bloques**. Assessment usa **presupuesto dinámico** derivado del inventario; los controles n_test/n_socratic de sesión siguen gobernando preguntas **por bloque** en Questions/RSVP study.
- Q: ¿Cuántas preguntas máximo? → A: Escala con inventario y aristas; techo de seguridad **50** total (test + socratic). Mínimo **8** cuando inventario ≥ 12 conceptos.
- Q: ¿Una sola llamada LLM? → A: **No**. Map-reduce por secciones del documento (misma estrategia que inventario): material completo por lote, no truncar solo el inicio.
- Q: ¿Preguntas de relación? → A: **Sí**. Cuota explícita (~25% test items) sobre aristas del grafo (prerequisite, supports, etc.) además de conceptos.
- Q: ¿Socráticas en assessment holístico? → A: **No**. Todo `type: "test"` (MCQ A–D) para discernir conocimiento rápido; `n_socratic = 0` en presupuesto holístico.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Document-wide knowledge probe (Priority: P1)

A student uploads a multi-section document (e.g. introduction + three topical parts). Before generating RSVP blocks, they run the optional pre-packing assessment. Questions span **all sections** and include **how concepts relate**, not only definitions from the first pages.

**Why this priority**: Core value — accurate knowledge_profile for packing requires whole-document signal.

**Independent Test**: 30-concept doc with 4 hierarchy sections → assessment produces ≥ 15 questions; ≥ 1 question per section cluster; ≥ 3 edge/relationship questions; no more than 40% of concept_ids referenced only from first 25% of markdown offsets.

**Acceptance Scenarios**:

1. **Given** a prepared document with ≥ 4 hierarchy sections, **When** assessment generates, **Then** questions reference concepts from at least 3 distinct sections (by hierarchy offset).
2. **Given** an inventory with prerequisite edges, **When** assessment completes generation, **Then** at least 20% of test questions target edges or multi-concept relationships.
3. **Given** a 50-concept inventory, **When** budget is computed, **Then** total questions ≥ min(50, ceil(concepts/2) + ceil(edges/3)).

---

### User Story 2 - Scaled question count (Priority: P1)

A student with a large syllabus sees a proportionally larger quiz (with progress during multi-batch generation). Small documents still get a meaningful minimum.

**Why this priority**: Fixed 2+1 (cap 7) cannot discover mastery across the graph.

**Independent Test**: 8-concept doc → ≥ 8 questions; 40-concept doc → ≥ 20 questions; generation shows per-batch progress.

**Acceptance Scenarios**:

1. **Given** inventory size N, **When** `computeHolisticAssessmentBudget` runs, **Then** n_test + n_socratic respects formula and safety cap 50.
2. **Given** map-reduce with 3 section batches, **When** user waits, **Then** UI shows batch progress (e.g. "Generating questions 2/3…").

---

### User Story 3 - knowledge_profile informs packing (Priority: P1)

After the holistic quiz, block packing receives a profile that reflects **broad** coverage (many concept_ids and edges assessed), improving skip/compress decisions across the document.

**Why this priority**: Assessment is only valuable if evaluation output is richer.

**Acceptance Scenarios**:

1. **Given** holistic assessment completed, **When** profile is built, **Then** `coverage` ≥ 40% of inventory concepts for docs with ≤ 30 concepts.
2. **Given** edge-targeted question answered correctly, **When** profile merges, **Then** both endpoint concept_ids receive at least partial mastery signal.

---

### Edge Cases

- No hierarchy tree: fall back to word-count chunks (same as inventory map-reduce).
- Empty edges: edge quota redistributed to concept questions.
- LLM batch failure: retry batch once; partial merge if ≥ 60% budget filled; else visible error + retry.
- User skip: unchanged (`knowledge_profile = null`).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST compute assessment question budget from full `conceptInventory` and `edges`, not from session `n_test`/`n_socratic` defaults.
- **FR-002**: System MUST stratify generation across document sections using `docHierarchy` (or chunk fallback), supplying **section-local material** to each LLM batch — never a single 12k-char head truncation.
- **FR-003**: System MUST allocate explicit quota for relationship/edge questions (~25% of test items, min 2 when edges ≥ 4).
- **FR-004**: System MUST use map-reduce LLM calls (parallel batches capped like inventory) and merge into one ordered question list.
- **FR-005**: Each question MUST retain Questions-mode schema (`test` | `socratic`) and `concept_id`; edge questions MUST include `edge: { from, to }` when targeting a relationship.
- **FR-006**: Normalizer MUST validate merged output counts, dedupe near-duplicate concept coverage where possible, and reject empty merge.
- **FR-007**: `evaluatePrePackingAssessmentResponses` MUST map edge question results to both endpoint concepts conservatively.
- **FR-008**: `buildPrefetchConfigKey` MUST include holistic budget + section plan hash for invalidation.
- **FR-009**: UI MUST show generation progress for multi-batch runs; runner unchanged (existing test/socratic screens).
- **FR-010**: `ASSESSMENT_ITEMS_MAX` (7) MUST NOT cap holistic assessment; replace with `HOLISTIC_ASSESSMENT_MAX` (50).

### Key Entities

- **AssessmentCoveragePlan**: `{ batches: [{ label, conceptIds, edgeIds, n_test, n_socratic, materialText }], totals: { n_test, n_socratic }, sectionKeys: string[] }`
- **HolisticAssessmentBudget**: `{ n_test, n_socratic, edgeTestQuota, rationale }`
- **Assessment question (extended)**: existing fields + optional `edge: { from, to }`, optional `coverage_batch`

### Non-Goals (v1)

- Pre-generating assessment items in DPP upload tier
- Connection questions between RSVP blocks
- User-editable assessment question count on create form

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For documents with ≥ 4 sections, ≥ 75% of hierarchy sections have at least one assessed concept_id.
- **SC-002**: Median concept coverage (unique concept_ids in items / inventory size) ≥ 35% for inventories 20–40 concepts.
- **SC-003**: Zero regression: skip assessment, pack without profile, and Questions per-block counts unchanged.
- **SC-004**: Generation completes for 40-concept / 4-section doc in ≤ 6 LLM calls (typical).

---

## Assumptions

- `shared.conceptInventory` and `shared.edges` (or session equivalents) are complete before assessment.
- `MAX_N_TEST` (10) remains for **per-block** Questions; holistic assessment uses separate `HOLISTIC_ASSESSMENT_MAX`.
- English prompts; UI strings English.
- User accepts longer assessment sessions for large documents.
