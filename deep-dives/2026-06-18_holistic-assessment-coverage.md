# Deep Dive: Holistic Pre-Packing Assessment Coverage

**Date:** 2026-06-18  
**Module:** `assessment-coverage.js`, `api.js` (holistic generator), `study.js` (wiring)

---

## 1. What we built

Pre-packing assessment no longer asks ~7 MCQs biased toward the document opening. A **coverage-driven map-reduce pipeline** computes a dynamic question budget from the full concept inventory and graph edges, splits work across document sections (via `docHierarchy` chunks), and merges test-only MCQs into one quiz. The output feeds the existing `knowledge_profile` → block packing flow. **All holistic questions are `type: "test"`** (A–D MCQ) so the learner can signal known/unknown quickly without open-ended socratic items.

---

## 2. Design decisions

### Dynamic budget instead of session `n_test`/`n_socratic`

**Chosen:** `computeHolisticAssessmentBudget(inventory, edges)` scales test count (~50% of concepts + edge quota, cap 50, min 8 for large docs).

**Alternatives:** Reuse create-form defaults (2+1); user-editable assessment count.

**Discarded because:** Fixed counts cannot probe a 40-concept syllabus; form controls remain for **per-block** Questions only.

**Trade-off:** Longer quiz on big documents; user can still skip assessment.

### Map-reduce by section, not one truncated excerpt

**Chosen:** Reuse `buildInventoryChunks(docHierarchy, rawMarkdown)`; each LLM batch gets section-local material (up to 24k chars).

**Alternatives:** Single call with 12k head truncate (old behavior); full document in one prompt (token blow-up).

**Trade-off:** Multiple LLM calls and latency; mitigated with parallel batches (cap 8) and progress UI.

### Test-only (no socratic) for holistic path

**Chosen:** `n_socratic = 0` always in holistic budget; merge step drops any socratic items.

**Alternatives:** Keep 1–5 socratic for depth; hybrid per document size.

**Discarded because:** User goal is **fast binary signal** (know / don't know) before packing, not tutoring dialogue.

**Trade-off:** Less nuance on partial understanding; test auto-score + edge propagation still give conservative `knowledge_profile`.

### Edge questions with dual-endpoint scoring

**Chosen:** ~25% of test items target `edge: { from, to }`; correct MCQ updates mastery on both endpoints.

**Alternatives:** Concept-only questions; separate edge_mastery array only.

**Trade-off:** Prompt complexity; evaluator must merge rows without over-crediting.

### Feature flag `HOLISTIC_ASSESSMENT_ENABLED`

**Chosen:** Default on when pre-packing + Questions UI enabled; legacy single-call path remains behind flag off.

**Trade-off:** Two code paths to maintain until legacy removal.

---

## 3. Concepts applied

| Concept | Where |
|--------|--------|
| **Map-reduce** | `generateHolisticPrePackingAssessmentItems` — section batches → merge |
| **Proportional allocation** | `distributeCounts` in `buildAssessmentCoveragePlan` |
| **Stable cache keys** | `hashCoveragePlan` + `buildPrefetchConfigKey` plan hash suffix |
| **Set deduplication** | `mergeHolisticAssessmentQuestions` fingerprint by concept + stem |
| **Graph edges as data** | `deriveInventoryEdges` from `prerequisite_ids` + `conceptGraph` |
| **Conservative scoring** | `scorePrePackingTestResponses` + `mergeProfileRows` mastery priority |
| **Pure functions / testability** | `assessment-coverage.js` with no LLM imports |
| **Feature flags** | `isHolisticAssessmentEnabled()` in `flags.js` |

---

## 4. Technical debt and improvements

**Well done:** Pure budget/plan/merge module; section-stratified material; explicit edge quota; contract tests without LLM.

**Duct tape:** `buildPrefetchConfigKey` lives in `study.js` (heavy import for node tests). Edge-to-batch assignment is heuristic (round-robin concepts, spillover edges). Failed LLM batches return `[]` and rely on 50% merge threshold rather than retry per batch.

**Won't scale:** Very large inventories (100+ concepts) hit cap 50 — coverage % drops. No pre-generation in DPP upload (assessment still waits at RSVP opt-in). `study.js` holistic context recomputes plan on each prefetch key read (cheap but duplicated).

**Improvements:** Move prefetch key helper to small module; optional DPP Tier-2 pre-gen; adaptive cap by user time budget; batch-level retry; official `/tests` mirror for `assessment-coverage.js`.

---

## 5. Consolidation questions

1. Why does holistic assessment ignore `resolvePrePackingQuestionConfig()` and what invariant keeps per-block Questions counts unchanged?

2. How does `mergeHolisticAssessmentQuestions` decide failure vs partial success when some map-reduce batches return empty arrays?

3. When an edge-targeted MCQ is answered correctly, how does `mergeProfileRows` combine signals if one endpoint already has `mastery: "none"` from another question?

---

## 6. Suggested updates for `.cursorrules`

1. **Holistic assessment is test-only:** Pre-packing map-reduce path must keep `n_socratic = 0`; do not reintroduce socratic items without an explicit product decision.

2. **Section material for document-wide LLM tasks:** Any quiz/inventory generation claiming "full document" coverage must use hierarchy chunks or equivalent — never `truncateMaterialExcerpt` head-only for holistic paths.

3. **Separate caps:** `MAX_N_TEST` (per block) and `HOLISTIC_ASSESSMENT_MAX` (pre-packing) are independent; do not clamp holistic batches with block-level limits.
