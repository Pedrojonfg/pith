# Research: No-Document Interview Capture

## Q1 — Opening question bank location and i18n

**Decision**: `src/js/interview/opening-questions.js` exports `getOpeningQuestions(lang)` keyed by `STUDY_LANG_OPTIONS` values (English, Spanish, French, German).

**Rationale**: Matches existing study-language config; static module = zero latency, works offline; no retrofit needed later.

**Alternatives considered**: Single English bank only (rejected — app already exposes language picker); JSON fetch (rejected — network dependency on opener).

---

## Q2 — Fidelity validation architecture

**Decision**: Add `validateInterviewSynthesisFidelity({ transcriptText, synthesizedMarkdown })` in `fidelity-validation.js` that delegates to `validateBlockFidelity` with `chunk = transcriptText`, `explanation = synthesizedMarkdown`.

**Rationale**: Existing function already compares explanation against arbitrary chunk text; no assumption on upload `rawMarkdown` as sole source.

**Alternatives considered**: New standalone validator (rejected — duplicates jaccard/term logic); skip validation (rejected — violates FR-008).

---

## Q3 — Assessment signal subtype

**Decision**: Extend `AssessmentSignal` with optional `signalOrigin: 'unprompted_articulation' | 'tested_recall'` (default `tested_recall` when absent for backward compatibility).

**Rationale**: `sourceMode` already encodes mode (`rsvp`|`questions`); origin distinguishes capture context without breaking merge logic. Aligns with typed-weighted-connections co-occurrence granularity needs.

**Alternatives considered**: Overload `sourceMode` with new value (rejected — not a mode); separate signal array (rejected — splits assessment pipeline).

---

## Q4 — Post-synthesis transcript mutability

**Decision**: Transcript closed after first successful synthesis in v1; no UI to append turns or re-run synthesis.

**Rationale**: Smallest surface area; user can create a new session if they remember more later.

**Alternatives considered**: Incremental re-synthesis (deferred — product complexity).

---

## DPP integration for interview origin

**Decision**: After synthesis, call a slim `runInterviewDocumentPreparation(docId)` that runs T0.x + T1.1–T1.6 + T2.1/T2.2 (Cloze/Recall prep) but skips RSVP block packing (T1.4 block split still runs for recommender meta if cheap, or skipped when no blocks needed).

**Rationale**: Reuses DPP phases that consume `rawMarkdown` + inventory; skips modes unavailable for interview origin.

**Alternatives considered**: Parallel pipeline (rejected — FR reuse mandate).

---

## Generating screen reuse

**Decision**: Reuse `screenReviewGenerating` with interview-specific status copy via a shared helper `showGeneratingScreen(message)`.

**Rationale**: Matches FR-007 / R6; existing pattern in study.js for assessment/review generation.
