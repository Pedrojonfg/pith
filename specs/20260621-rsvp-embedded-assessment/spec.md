# Feature: RSVP-Embedded Assessment → Vault/Review Signal Parity

**Version:** 1.0  
**Date:** 2026-06-21  
**Status:** Implementation-ready  
**Depends on:** `20260612-rsvp-assessment-questions-parity`, `20260618-knowledge-vault-a-plus`, `20260620-sm2-priority-queue`, `20260626-cross-doc-vault`

## Assumptions

- `.specify/` tooling is absent; artifacts live under `specs/20260621-rsvp-embedded-assessment/`.
- OQ1 (permanent cursor-tests): **Yes** — add `cursor-tests/20260621_rsvp-embedded-assessment.mjs`.
- OQ2 (Cloze/Recall audit): out of scope (NG1); file separate spec if needed.
- Socratic open-response quality for SM-2/promotion uses engagement quality **4** (adequate) after successful tutor feedback — no new LLM call; matches consumption-only boundary (R5/R6).

## Problem

RSVP and Questions share block shape and assessment UI (`screenTest` / `screenSocratic`), but signal routing parity was never verified. The dependency diagram claims RSVP feeds Vault/Review via `assessmentSignals` and `smItems`; this spec closes that gap.

## Goals

- **G1.** MCQ answers in RSVP-embedded Test and standalone Questions produce identical downstream effects: one merged `assessmentSignals` entry, concept promotion/identity resolution, one `smItems` update.
- **G2.** Same parity for Socratic sub-screen answers.
- **G3.** Single canonical function routes all four entry points (R1).
- **G4.** No RSVP reading UX changes (ORP, WPM, prefetch, sneak peek).

## Non-Goals

- Cloze/Recall signal routing (NG1)
- Block generation / prefetch (NG2)
- New UI, flags, or LLM calls (NG4–NG6)
- Taxonomy changes to `mode-taxonomy.js` (R7)

## Functional Requirements

### FR-1 — Phase 0 audit (mandatory)

Trace four submit paths in `study.js` (Test/Socratic × RSVP/Questions). Document handlers, `assessmentSignals`, promotion, `smItems`. Outcome: Finding A (unified) or Finding B (diverged).

### FR-2 — Canonical `finalizeBlockQuestionAnswer`

One exported function in `src/js/block-answer-signals.js` responsible for:

1. `syncAssessmentSignalsToShared(docId, slice, sourceMode)`
2. `registerOrUpdateSmItem` + concept promotion via `concept-registry/ingest.js`
3. Called from every non–pre-packing block question finalize path

### FR-3 — Test MCQ wiring

`handleTestAnswer` (non–pre-packing) delegates signal side effects to FR-2 after `recordResponse`.

### FR-4 — Socratic wiring

Socratic submit (non–pre-packing, post-tutor success) delegates to FR-2 after `recordResponse`.

### FR-5 — Dedup semantics (R4)

Re-answers merge/update via existing `mergeAssessmentSignals` and `registerOrUpdateSmItem` update semantics — no new dedup rules.

### FR-6 — Idempotency (R8)

Promotion/identity resolution safe on repeated calls for the same concept; document or guard if audit finds gaps.

## Success Criteria

- Integration tests prove MCQ + Socratic answers from RSVP and Questions slices write `assessmentSignals`, `smItems`, and invoke promotion helpers through FR-2.
- Re-answer does not duplicate registry rows.
- `computeModeRecommendation()` unchanged for fixture session.
- Zero new LLM calls in signal path.
- Existing RSVP consumption tests still pass.

## Testing Checklist

See [quickstart.md](./quickstart.md).
