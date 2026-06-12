# Contract: Key Terms & Overview — Zero Questions (L15)

**Feature**: `20260617-pipeline-levers` | **Lever**: L15 | **Priority**: P0

## Scope

`resolveBlockQuestionConfig` MUST return zero questions for glossary and orientation blocks.

## Title patterns (case-insensitive)

| Pattern | n_test | n_socratic |
|---------|--------|------------|
| `^Key terms:` | 0 | 0 |
| `^Overview:` | 0 | 0 |
| `^Course map:` | 0 | 0 |

## Implementation surface

- **Module**: `src/js/session.js` — `resolveBlockQuestionConfig(blockIndex)`
- **Input**: block title from `session.blocks[blockIndex].title` OR `block_index[blockIndex].title`
- **Fallback**: if title unavailable, use `block_index` entry

## Behavior

1. Before reading per-block `_config`, check title against patterns.
2. If match → return `{ n_test: 0, n_socratic: 0, explanation_profile, gap_focus, include_connection_questions: false }`.
3. Otherwise → existing defaults + per-block `_config` merge.

## Tests (cursor-tests)

- `resolveBlockQuestionConfig` with mock block title "Key terms: Utilitarismo" → `{ n_test: 0, n_socratic: 0 }`
- "Overview: Ethics" → zero questions
- "Development: Singer argument" → session defaults (e.g. 2+1)

## Non-goals

- Does not remove Key terms block from pack (L5-D is separate).
- Does not change question generation prompts (L14).
