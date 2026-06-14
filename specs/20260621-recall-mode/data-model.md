# Data Model: Recall Mode

**Feature**: `20260621-recall-mode`

Extends `DocumentSession.modes.recall` and shared assessment signals. Does not increment global `schemaVersion` unless session normalizer requires it.

## RecallModeSlice (`modes.recall`)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `status` | enum | yes | `not_started` | `not_started` \| `generating` \| `ready` \| `in_progress` \| `complete` |
| `questions` | `RecallQuestion[]` | yes | `[]` | Generated question set |
| `currentIndex` | number | yes | `0` | Index of active question |
| `config` | `RecallConfig` | yes | see below | Session generation config |
| `_meta` | `RecallMeta` | no | `{}` | Generation provenance |

### RecallConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `questionCount` | number | derived | Target count from doc size tier |
| `types` | `RecallType[]` | derived | Subset of four recall types to include |
| `scope` | `'full' \| 'section'` | `'full'` | v1 always `full`; section reserved |
| `sectionScope` | string? | — | Future: hierarchy node id |

### RecallMeta

| Field | Type | Description |
|-------|------|-------------|
| `generatedAt` | number | ms timestamp |
| `sourceInventoryHash` | string | Fingerprint of concept inventory + pedagogical meta |
| `usedAssessmentSignals` | boolean | Whether weak-concept weighting was applied |

## RecallQuestion

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Stable id (`rq1`, `rq2`, …) |
| `recall_type` | `RecallType` | yes | `synthesis` \| `relational` \| `argumentative` \| `applicative` |
| `question` | string | yes | Open-ended prompt |
| `concept_ids` | string[] | yes | 1–3 inventory concept ids |
| `source_chunks` | string[] | yes | Excerpts from raw markdown for tutor grounding |
| `student_answer` | string? | no | User free text |
| `tutor_feedback` | `TutorFeedback?` | no | Populated after evaluation |

### RecallType

Union of four string literals (see spec FR-003).

### TutorFeedback

| Field | Type | Description |
|-------|------|-------------|
| `critique` | string | What is right, missing, or imprecise |
| `suggested_answer` | string | Model answer grounded in source |
| `quality` | enum | `strong` \| `adequate` \| `partial` \| `insufficient` |

## AssessmentSignal extension

Existing `AssessmentSignal` shape from mode continuity; Recall writes:

| Field | Value |
|-------|-------|
| `sourceMode` | `'recall'` |
| `lastResult` | `'wrong'` for partial/insufficient, `'correct'` for strong/adequate |
| `canonicalId` | concept id from inventory |
| `weight` | Higher for partial/insufficient (same formula as RSVP wrong) |

Optional explicit `signalType`: `recall_weak` \| `recall_strong` if parser extended.

## SmItem source (recall)

| Field | Value |
|-------|-------|
| `sourceType` | `'recall_question'` |
| `sourceId` | `RecallQuestion.id` |
| `title` | Question excerpt (first ~80 chars) |
| `contentPreview` | concept ids joined |

Quality from `RECALL_QUALITY_TO_SM2[tutor_feedback.quality]`.

## Vault observation types (optional)

| Observation | Mastery dimension | When |
|-------------|-------------------|------|
| `recall_strong` | declarative (synthesis/relational) or procedural (applicative) | strong/adequate |
| `recall_partial` | same | partial |
| `recall_insufficient` | same | insufficient |

## State transitions

```text
[User selects Recall]
  → resolveModeEntryState
      resume → load slice, screenRecall in_progress
      bootstrap → generateRecallQuestions → status ready → in_progress
      generate_fresh → runConceptInventory → shared → generateRecallQuestions
      upload_required → create screen upload CTA

[User submits answer]
  → deepSeekRecallTutor → tutor_feedback on question
  → ingestSm2FromRecallAnswer (per concept_id)
  → syncAssessmentSignalsFromRecall
  → optional vault observation
  → currentIndex++

[All questions answered]
  → status complete
  → session summary UI
  → updateFlowProgress (recommender)
```

## Invariants

- Every `RecallQuestion` has ≥1 `concept_ids` entry valid against `shared.conceptInventory`.
- At least one question in set has `recall_type === 'synthesis'`.
- `sourceInventoryHash` must change when inventory or pedagogical meta changes materially.
- Tutor must not run without `student_answer` non-empty (trimmed) unless explicit "skip" added later.

## Relationships

```text
DocumentSession
├── shared.conceptInventory ──► question concept_ids
├── shared.assessmentSignals ◄── Recall weak/strong writes
├── shared.smItems ◄── recall_question ingestion
├── shared.rawMarkdown ──► source_chunks
└── modes.recall ──► screenRecall UI
```
