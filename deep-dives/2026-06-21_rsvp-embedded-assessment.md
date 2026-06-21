# Deep Dive — RSVP Embedded Assessment Signal Parity

**Date:** 2026-06-21  
**Spec:** `specs/20260621-rsvp-embedded-assessment/`  
**ROADMAP:** `ROADMAP-rsvp-embedded-assessment.md`

---

## 1. What we built

We closed a gap between what the architecture diagram claimed and what the code actually did when a user answers a question inside an RSVP block (Test or Socratic sub-screens). RSVP and Questions already shared the same UI handlers, but signal side effects were scattered in `study.js`, and Socratic answers never fed `shared.smItems` or concept promotion at all.

The fix is a single canonical function, `finalizeBlockQuestionAnswer`, called from both MCQ and Socratic submit paths after `recordResponse`. It syncs `assessmentSignals`, registers/updates SM-2 items, and triggers vault promotion — with no new LLM calls and no RSVP reading UX changes.

---

## 2. Design decisions

### Canonical module (`block-answer-signals.js`)

**Chosen:** Extract all post-answer side effects into `src/js/block-answer-signals.js`.

**Alternatives:** Leave inline logic in `study.js` (status quo); duplicate RSVP-only hooks.

**Why discarded:** Inline code violated R1 (one canonical writer) and made Socratic parity easy to miss again. RSVP-only hooks would fix one mode pair but not the structural problem.

**Trade-off:** One more import hop; `study.js` still owns UI flow and must remember to call finalize after every new answer path.

### Socratic SM-2 quality = 4 (fixed)

**Chosen:** After successful tutor feedback, use constant `SOCRATIC_ENGAGEMENT_QUALITY = 4` for `registerOrUpdateSmItem` and `promoteFromSocraticBlock`.

**Alternatives:** Parse tutor markdown for quality tiers; skip SM-2 for Socratic entirely; mirror Recall's `tutor_feedback.quality` schema.

**Why discarded:** Parsing tutor output is fragile and would be a new implicit LLM dependency in the signal path. Skipping SM-2 left G2 unmet. Recall has structured tutor JSON; block Socratic does not.

**Trade-off:** All successful Socratic answers look "adequate" to SM-2 regardless of tutor nuance. Acceptable for v1 because the tutor LLM already ran at submit time (consumption, not generation).

### Socratic promotion facet = `synthesis`

**Chosen:** `promoteFromSocraticBlock` calls `onConceptEngagement` with facet `synthesis` and passes `contentText` (student answer).

**Alternatives:** Reuse MCQ's `recognition` facet; no promotion for Socratic.

**Why discarded:** Open-response retrieval is closer to synthesis than recognition. No promotion would leave vault gray for concepts only touched via Socratic.

**Trade-off:** Green promotion eligibility depends on `qualifiesForGreen` rules for synthesis — may promote less aggressively than Recall's typed facets.

### Pre-packing assessment excluded

**Chosen:** `handleTestAnswer` / socratic handler still branch to `isPrePackingAssessmentRunner()` paths that write `knowledge_profile`, not block signals.

**Alternatives:** Unify pre-packing and in-block study into one finalize function.

**Why discarded:** Different data contract (`knowledge_profile` vs `assessmentSignals`); out of spec scope.

**Trade-off:** Two parallel assessment pipelines remain; future contributors must know which path they're on.

### MCQ `sourceType: "rsvp_block"` for both modes

**Chosen:** Keep existing `rsvp_block` source type even when `studyMode === "questions"`.

**Alternatives:** Introduce `questions_block` source type.

**Why discarded:** Avoids schema migration and duplicate review queue entries for the same physical block.

**Trade-off:** Source type name is slightly misleading for Questions mode; `promotionSource` (`"rsvp"` vs `"questions"`) carries the mode distinction instead.

---

## 3. Concepts applied

| Concept | What it is | Where in our code |
|---------|------------|-------------------|
| **Canonical write path** | Single function owns a cross-cutting side effect so all entry points stay consistent | `finalizeBlockQuestionAnswer` in `block-answer-signals.js` |
| **Facade / orchestration** | Thin coordinator that sequences existing services without new business rules | `finalizeBlockQuestionAnswer` calls `syncAssessmentSignalsToShared` → `registerOrUpdateSmItem` → `promoteFrom*` |
| **Idempotent upsert** | Re-applying the same logical event updates rather than duplicates | `mergeAssessmentSignals` (by `canonicalId`); `registerOrUpdateSmItem` (by `sourceType` + `sourceId`) |
| **Strategy by question type** | Branch on `questionType` (`test` \| `socratic`) with different quality mapping | `if (questionType === "test")` vs socratic branch in `block-answer-signals.js` |
| **Mode normalization** | Map runtime mode strings to a small enum before persistence | `normalizeStudyMode(sourceMode)` guard at top of finalize |
| **Fire-and-forget error containment** | UI must not break if downstream signal write fails | `try/catch` with `console.warn` in `handleTestAnswer` and socratic handler |
| **Phase 0 audit before code** | Trace real call paths before implementing fixes | Documented in `research.md` — Finding A (mode parity) vs Finding B (Socratic gap + no canonical fn) |
| **PWA version coupling** | Deploy identity requires bumping SW_VERSION, `?v=` query params, and CACHE_NAME together | `sw-update.js`, `index.html`, `sw.js` → `20260621_1` / `pith-v70` |

---

## 4. Technical debt and improvements

**Well done**

- Phase 0 audit caught that RSVP/Questions were already unified at the handler level — avoided a bogus "RSVP-only fix."
- Canonical module is small (~115 lines), testable in isolation, and documented in `contracts/block-answer-signals.md`.
- Pre-packing runner correctly left untouched.

**Functional duct tape**

- Socratic quality is a hardcoded `4` — no link to tutor evaluation quality.
- `syncActiveSessionAssessmentSignals` still exists for batch exit sync; MCQ/Socratic now call `syncAssessmentSignalsToShared` directly inside finalize. Two ways to sync signals unless exit hook is audited for double-merge (merge should be safe but it's redundant work).
- Integration tests are file-read/wiring checks plus pure `assessment-signals.js` unit assertions — no end-to-end test that actually calls `finalizeBlockQuestionAnswer` with a mocked session store (blocked in Node by Supabase imports in `session-store`).

**Would not scale**

- Every new answer entry point (e.g. a future "connection question" type) must manually call `finalizeBlockQuestionAnswer` — no compile-time enforcement.
- `study.js` remains a god file; we only extracted signal routing, not the handlers themselves.
- Socratic `sourceId` pattern `{blockId}:socratic:{qi}` can collide if block IDs are unstable across regenerations.

**Improvements worth a follow-up**

- Parse or structure socratic tutor output into a quality enum (like Recall) without adding LLM calls.
- Add `promoteFromSocraticBlock` tests next to existing registry ingest tests.
- Consider renaming `rsvp_block` → `block_study` in a migration spec.

---

## 5. Consolidation questions

1. **Why does Socratic use facet `synthesis` and quality `4`, while MCQ uses `recognition` and `mapMcqOutcomeToQuality`?** What would break in the vault graph if you swapped them?

2. **What is the exact difference between `syncActiveSessionAssessmentSignals()` and calling `finalizeBlockQuestionAnswer()`?** When is each invoked today, and could a mode-exit batch sync double-count or overwrite a just-finalized answer?

3. **Why is pre-packing assessment excluded from `finalizeBlockQuestionAnswer`, and where does that path write its signals instead?** Trace from `isPrePackingAssessmentRunner()` to persisted state.

---

## 6. Suggested update for .cursorrules

1. **Block answer signal routing:** Any new code path that finalizes a Test or Socratic block question answer (RSVP or Questions) MUST call `finalizeBlockQuestionAnswer` from `block-answer-signals.js` after `recordResponse`. Do not call `syncAssessmentSignalsToShared`, `registerOrUpdateSmItem`, or `promoteFromMcqBlock` directly from `study.js` for in-block study.

2. **Pre-packing vs in-block assessment:** Pre-packing assessment (`isPrePackingAssessmentRunner`) uses `knowledge_profile` — never route it through `finalizeBlockQuestionAnswer`. In-block study uses `assessmentSignals` + `smItems`.

3. **Socratic signal parity:** Socratic block answers must produce both `smItems` (sourceId `{blockId}:socratic:{qi}`) and `promoteFromSocraticBlock` engagement — not assessment signals alone.
