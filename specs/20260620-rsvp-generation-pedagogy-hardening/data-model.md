# Data Model: RSVP Generation Pedagogy Hardening

## Block `_config` (session.blocks[i])

| Field | Type | Notes |
|-------|------|-------|
| n_test | number | 0–MAX_N_TEST |
| n_socratic | number | 0–3 |
| explanation_profile | string | `thorough` \| `brief_deep` \| `relational_compressed` |
| gap_focus | array | strings or `{ concept_id, reason?, label? }` |
| include_connection_questions | boolean | |

## Block index entry (post-pack)

| Field | Type | Notes |
|-------|------|-------|
| learning_goal | string | `prerequisite_review` \| `relational` |
| concept_ids | string[] | drives gap_focus concept_id entries |
| _initial_block_config | object | optional; applied once at session confirm |

## Generated block diagnostics

| Field | Type | Notes |
|-------|------|-------|
| question_count_status | string | `'short'` when under-delivered after retry |
| question_count_actual | object | `{ test, socratic }` |
| question_count_requested | object | `{ test, socratic }` |

## Global preference

| Key | Storage | Values |
|-----|---------|--------|
| LS_SOURCE_FIDELITY_STRICT_KEY | localStorage | `"true"` \| `"false"` |

## Profile mapping

```
learning_goal 'prerequisite_review' → gap_focus[{concept_id, reason}], explanation_profile 'brief_deep'
learning_goal 'relational'          → gap_focus[{concept_id, reason}], explanation_profile 'relational_compressed'
absent                              → no _initial_block_config written
```
