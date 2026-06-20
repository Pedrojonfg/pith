# Research: RSVP Generation Pedagogy Hardening

## R5.0 — Bold pause mechanism (rsvp.js)

**Decision**: RSVP keys off `**bold**` / `__bold__` markdown via `markdownToRsvpPlainText`, inserting `RSVP_BOLD_END_MARKER` after each bold span; `RSVP_AFTER_BOLD_MS` (150ms) extra dwell when a flash ends a bold span.

**Rationale**: Standalone header lines `**Header Phrase**` on their own paragraph tokenize as bold text ending with marker — compatible with existing pause logic.

**Alternatives considered**: New markup convention — rejected; markdown bold already integrated.

## R1 — Pack field names

**Decision**: Use `learning_goal` and `concept_ids` from pack response (already parsed in `packInventoryToBlocks` ~2692).

**Rationale**: Matches `deepSeekPackConceptsToBlocks` prompt at api.js ~1352–1354.

## R1 — gap_focus shape

**Decision**: Store `{ concept_id, reason }` objects; extend `normalizeGapFocus` to accept `concept_id`; add `formatGapFocusLabel()` for prompts.

**Rationale**: Spec requires concept_id + reason; existing code used string/`label` only.

## R3 — Retry location

**Decision**: Retry in `ensureBlockGenerated` after first `normalizeBlockJson`, calling `deepSeekRegenerateBlockQuestions` with retry suffix (same idiom as JSON parse retry).

**Rationale**: Spec explicitly targets `ensureBlockGenerated`; keeps api layer unchanged for other callers.

## R2 — Settings UI

**Decision**: Replace single toggle button with Standard/Strict radio group; reuse `saveSourceFidelityStrictPreference` and existing click handler pattern.

**Rationale**: Ghost handlers at study.js ~8641 and ui.js ~1148 already wire persistence; spec asks plain-language labels.

## R5 — Development block detection

**Decision**: Use `deriveBlockType(title) === 'development'` from `pipeline-levers.js`.

**Rationale**: Matches spec scope (excludes Overview, Course map, Key terms).
