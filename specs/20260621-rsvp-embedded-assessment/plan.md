# Implementation Plan: RSVP Embedded Assessment Signal Parity

**Branch:** `20260621-rsvp-embedded-assessment` | **Date:** 2026-06-21 | **Spec:** [spec.md](./spec.md)

## Summary

Phase 0 confirms RSVP/Questions share handlers but side effects are scattered and Socratic omits SM-2/promotion. Extract `finalizeBlockQuestionAnswer`, wire Test and Socratic submit paths, add integration tests.

## Technical Context

**Language:** JavaScript ES modules  
**Primary files:** `src/js/block-answer-signals.js` (NEW), `src/js/study.js`, `src/js/concept-registry/ingest.js`  
**Testing:** `cursor-tests/20260621_rsvp-embedded-assessment.mjs`  
**Constraints:** No new LLM calls; English; bump `SW_VERSION` on ship

## Constitution Check

| Principle | Status |
|-----------|--------|
| English UI/internal | PASS |
| PWA versioning | PASS — bump on `src/js/**` |
| No new LLM in signal path | PASS |
| Surgical diff | PASS |

## Project Structure

```text
src/js/block-answer-signals.js     # NEW canonical finalize
src/js/concept-registry/ingest.js  # promoteFromSocraticBlock
src/js/study.js                    # delegate test + socratic
cursor-tests/20260621_rsvp-embedded-assessment.mjs
```

## Phase outputs

- [research.md](./research.md) — Phase 0 audit
- [data-model.md](./data-model.md)
- [contracts/block-answer-signals.md](./contracts/block-answer-signals.md)
- [quickstart.md](./quickstart.md)
