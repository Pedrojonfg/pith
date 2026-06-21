# Research — RSVP Embedded Assessment Signal Parity

**Date:** 2026-06-21

## Phase 0 Audit (FR-1)

### Path 1 — `screenTest`, `studyMode === "questions"`

| Step | Function |
|------|----------|
| Submit | `renderTestQuestion` → click handler → `handleTestAnswer` |
| Response persist | `recordResponse` → `persistActiveRsvpSlice` (questions slice) |
| assessmentSignals | `syncActiveSessionAssessmentSignals` → `syncAssessmentSignalsToShared` |
| promotion | `ingestSm2FromTestAnswer` → `promoteFromMcqBlock` |
| smItems | `ingestSm2FromTestAnswer` → `registerOrUpdateSmItem` |

### Path 2 — `screenTest`, `studyMode === "rsvp"`

Same call chain as Path 1. No `studyMode` branch in `handleTestAnswer` except pre-packing runner guard. Promotion `source` param differs (`"rsvp"` vs `"questions"`) only inside `ingestSm2FromTestAnswer`.

### Path 3 — `screenSocratic`, `studyMode === "questions"`

| Step | Function |
|------|----------|
| Submit | `els.socraticSubmitBtn` → LLM tutor → second `recordResponse` |
| assessmentSignals | `syncActiveSessionAssessmentSignals` |
| promotion | **none** |
| smItems | **none** |

### Path 4 — `screenSocratic`, `studyMode === "rsvp"`

Identical to Path 3.

## Finding

**Finding A (mode parity):** RSVP and Questions share the same handlers for both Test and Socratic. No RSVP-specific signal skip.

**Finding B (canonical function + Socratic gap):**

- Side effects are inline in `handleTestAnswer` and socratic handler — violates R1.
- Socratic paths (both modes) omit `smItems` ingestion and concept promotion — violates G2 even though RSVP/Questions match each other.

## Decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Canonical module | `src/js/block-answer-signals.js` | Keeps `study.js` thin; single import site |
| Socratic SM-2 quality | Fixed **4** (adequate engagement) | Tutor already ran (consumption); no structured quality parser |
| Socratic promotion facet | `synthesis` | Open-response retrieval vs MCQ `recognition` |
| Pre-packing assessment | Exclude from FR-2 | Uses `knowledge_profile` path, not block study signals |
| Idempotency R8 | Rely on existing `mergeAssessmentSignals`, `registerOrUpdateSmItem` update, `onConceptEngagement` upsert | No duplicate registry rows observed in code review |

## Alternatives considered

- Duplicate RSVP-specific hooks in RSVP flow only — rejected (violates G3).
- Parse socratic tutor markdown for quality — rejected (fragile; R5).
