# Research: Adaptive WPM Calibration

## questionClass values (R4)

**Decision**: Map detail/inference → `factual`; gist → `conceptual` (including null/unclassified).

**Rationale**: `factual-classifier.js` and pedagogical-principles spec emit only `factual` | `conceptual`. Values `inferential`, `applied`, `definitional` from early SPEC-WPM draft are not emitted by `api.js` or DPP.

**Alternatives considered**: Extend classifier with new classes — rejected (out of scope).

## Session-complete hook

**Decision**: `showSessionComplete()` in `study.js` (~line 5599), called from `finishQuestions` and test flow when last block finishes.

**Rationale**: Single choke point before `showScreen("complete")`.

## WPM slider DOM

**Decision**: `#rsvpWpm` range input in RSVP overlay (`index.html` ~1699); initialized by `loadRsvpDefaultsFromStorage()` in `rsvp.js`. Separate from `rsvp_default_wpm` session slider value.

**Rationale**: WPM base (`pith_rsvp_wpm_base`) is recommendation-only; session speed remains `rsvp_default_wpm`.

## MCQ response shape

**Decision**: Join `session._responses.blocks[bi].questions[gi]` to `block.questions[gi]` for test items; `concept_id` on question object; correctness via answer letter comparison.

**Rationale**: `recordResponse` does not store `concept_id` or `is_correct`; global question index matches test-first ordering in `getBlockOrderedQuestions`.

## Per-block WPM

**Decision**: Store `session._meta.rsvp_block_wpm[bi]` on RSVP `onDone`; `session._meta.rsvp_session_start_wpm` on first block RSVP start; median across eligible blocks with fallback to session-start WPM.

**Rationale**: Supports mid-session slider changes per SPEC R2/R7.
