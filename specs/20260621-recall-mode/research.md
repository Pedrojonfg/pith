# Research: Recall Mode

**Feature**: `20260621-recall-mode` | **Date**: 2026-06-13

## R1 — Cold vs warm retrieval (no explicit UI mode)

**Decision**: Do not expose "cold" or "warm" labels. Entry timing implies purpose: first mode = diagnostic; after RSVP/Slow = consolidation; days later = retention.

**Rationale**: Matches Justin Sung emptying technique without extra UX; aligns with spec assumption.

**Alternatives considered**:
- Toggle for cold/warm — rejected ( redundant with flow position)
- Separate modes — rejected (same pipeline, different marketing)

## R2 — Entry resolution (`resolveModeEntryState`)

**Decision**: Extend `mode-bootstrap.js`:

| Condition | Resolution |
|-----------|------------|
| `modes.recall.status === 'in_progress'` | `resume` |
| `shared.conceptInventory?.length` | `bootstrap` (generate questions only) |
| `shared.rawMarkdown` present, no inventory | `generate_fresh` (inventory then questions) |
| No raw markdown | `upload_required` |

**Rationale**: Mirrors Questions/Cloze bootstrap pattern from mode continuity; avoids block packing.

**Alternatives considered**:
- Always regenerate inventory — rejected (anti-silo violation)
- Require RSVP first — rejected (FR cold entry)

## R3 — Question count by document size

**Decision**: Derive target count from existing doc size tier (same helper as pipeline levers / hierarchy):

| Tier | Target questions |
|------|------------------|
| tiny / short | 3–4 |
| medium | 5–7 |
| long / very_long | 7–10 |

Cap at 10 for v1 full-document scope.

**Rationale**: Spec SC-006 and assumptions; prevents fatigue on short texts.

**Alternatives considered**:
- Fixed 8 always — rejected (poor UX on flashcards-length docs)
- User slider v1 — deferred

## R4 — Type distribution by `primaryLearningGoal`

**Decision**: Always include ≥1 `synthesis`. Remaining slots from table in spec FR-004:

| Goal | Mix |
|------|-----|
| `understand_argument` | synthesis + argumentative + relational |
| `memorize_facts` | relational + applicative |
| `learn_procedure` | applicative + synthesis |
| `survey_field` | synthesis + relational |

Pass distribution string into generation prompt; validate parser requires synthesis present.

**Rationale**: Pedagogical meta already on hierarchy from flow recommendation feature.

**Alternatives considered**:
- Random mix — rejected (ignores doc intent)

## R5 — Tutor context vs RSVP socratic debt

**Decision**: Recall tutor MUST receive: `recall_type`, `concept_ids` + dictionary definitions, `source_chunk` from question metadata, student answer. RSVP embedded socratic retrofit is **follow-up** (separate tasks T10–T11 in ROADMAP), not blocking Recall v1.

**Rationale**: Spec scopes RSVP fixes as related follow-up; Recall proves the pattern.

**Alternatives considered**:
- Ship RSVP fixes in same PR — rejected (scope creep)
- Reuse broken `deepSeekSocraticTutor` unchanged — rejected (FR-011)

## R6 — Assessment signal types

**Decision**: Add signal types `recall_weak` and `recall_strong` (or extend `lastResult` + `sourceMode: 'recall'`) consumed by `prioritizeByAssessmentSignals` in Cloze. Weight weak signals like RSVP wrong answers.

**Rationale**: FR-012; Cloze already reads assessment signals from mode continuity.

**Alternatives considered**:
- Reuse generic `wrong` only — rejected (loses synthesis vs MCQ distinction)

## R7 — SM-2 quality mapping

**Decision**:

```javascript
const RECALL_QUALITY_TO_SM2 = {
  strong: 5,
  adequate: 4,
  partial: 2,
  insufficient: 1,
};
```

One smItem update per `concept_id` on the question via `registerOrUpdateSmItem` with `sourceType: 'recall_question'`, `sourceId: question.id`.

**Rationale**: Aligns with SM-2 feature R6 mapping; multiple concepts on one question each get the same quality event.

**Alternatives considered**:
- Single smItem per question — rejected (concept-level retention goal)

## R8 — Generation reuse and invalidation

**Decision**: Store `sourceInventoryHash` on `modes.recall._meta`. On bootstrap, if hash matches and `status === 'ready'`, skip regeneration unless user clicks "Regenerate questions".

**Rationale**: Avoids LLM cost on every entry; matches block cache patterns elsewhere.

**Alternatives considered**:
- Always regenerate — rejected (cost + latency)

## R9 — Study UI placement

**Decision**: New `screenRecall` in `index.html`; navigation from mode select and flow panel "Continue with Recall". Hide global chrome consistent with focused study screens. Optional sidebar toggle for dictionary peek (FR-015).

**Rationale**: Recall is reflection-heavy; distinct from RSVP sprint UI.

**Alternatives considered**:
- Reuse Questions screen — rejected (MCQ vs open-ended UX mismatch)

## R10 — Flow recommender rules

**Decision**: Extend recommender decision table:

- After RSVP complete + `argumentativeDensity >= 3` → insert Recall before Cloze
- After Slow complete → suggest Recall
- Before Cloze if `assessmentSignals.length < threshold` → suggest Recall to seed signals

**Rationale**: FR-016; uses existing pedagogical meta and assessment signal count.

**Alternatives considered**:
- Manual only — rejected (spec FR-016)
