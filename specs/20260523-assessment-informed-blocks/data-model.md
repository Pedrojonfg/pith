# Data Model: Assessment-Informed Block Content

## Session extensions

### `_meta.assessment` (persisted)

| Field | Type | Description |
|-------|------|-------------|
| `penalised_total` | number | Existing |
| `raw_total` | number | Existing |
| `max_questions` | number | Existing |
| `pct` | number | Existing |
| `strong_blocks` | number[] | Block ids |
| `weak_blocks` | number[] | Block ids |
| `config_adjustments_applied` | boolean | Existing |
| `gaps_by_block` | Record<string, GapEntry[]> | Confirmed gap list at accept time |
| `gaps_source` | `"synthesis" \| "user" \| "merged" \| "none"` | How gaps were produced |
| `synthesis_status` | `"ok" \| "timeout" \| "error" \| "skipped"` | Step C outcome |
| `synthesis_ms` | number? | Optional timing |

### `GapEntry`

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `label` | string | yes | 3–80 chars, trimmed |
| `source` | enum | no | `synthesis` \| `user` |
| `from_question_index` | number | no | Index in assessment question array |

### `blocks[i]._config` (persisted per block)

| Field | Type | Default | Rules |
|-------|------|---------|-------|
| `n_test` | 0–5 | session default | Existing |
| `n_socratic` | 0–3 | session default | Existing |
| `explanation_profile` | enum | `thorough` | `thorough` \| `brief_deep` |
| `gap_focus` | string[] | `[]` | Labels only; max 8 |

## Ephemeral (UI only, not required for export)

| Symbol | Purpose |
|--------|---------|
| `window.assessmentResults` | Raw scoring during assessment run |
| `window.assessmentGapSynthesis` | In-flight / completed C payload before accept |

## State transitions

```text
[assessment skipped]
  → no C, _config = session defaults, explanation_profile = thorough

[assessment completed]
  → show results → C starts (pending)
  → C ok → gaps_by_block draft in memory
  → user optional edit D
  → accept → applyAssessmentResults → _meta.assessment + blocks[*]._config
  → startStudyingNow → generate block with profile

[C timeout/error on accept]
  → gaps_by_block = {} or partial
  → profiles from classification only
```

## Validation rules

- `gap_focus` entries must be non-empty strings after trim.
- Weak block: if `gap_focus.length > 0`, require `n_test + n_socratic >= gap_focus.length` (after budget adjustment).
- Strong block: `explanation_profile === "brief_deep"`.
- Skip assessment: `synthesis_status === "skipped"` and no `gaps_by_block`.

## Relationships

```text
AssessmentResults.perBlock ──► BlockPedagogicalProfile.explanation_profile
GapList[blockId] ──► BlockPedagogicalProfile.gap_focus
BlockPedagogicalProfile ──► deepSeekGenerateBlockJson prompt
Generated BlockContent.explanation ◄── explanation_profile
Generated BlockContent.questions ◄── gap_focus + n_test/n_socratic
```
