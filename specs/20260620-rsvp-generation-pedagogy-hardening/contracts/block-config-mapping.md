# Contract: mapKnowledgeProfileToBlockConfig

## Pure function

```javascript
mapKnowledgeProfileToBlockConfig(blockIndexEntry) → {
  gap_focus: Array<{ concept_id: string, reason: string }>,
  explanation_profile: string | null
}
```

## Mapping

| `learning_goal` | `gap_focus` | `explanation_profile` |
|-----------------|-------------|------------------------|
| `prerequisite_review` | one entry per `concept_id` with `reason: 'prerequisite_review'` | `brief_deep` |
| `relational` | one entry per `concept_id` with `reason: 'relational'` | `relational_compressed` |
| absent / unknown | `[]` | `null` |

## Application rules

1. Called on each block index entry immediately after `packInventoryToBlocks` returns.
2. Non-null results stored as `entry._initial_block_config` (does not mutate user-edited session `_config` later).
3. At session confirm, copy `_initial_block_config` onto `session.blocks[i]._config` only when present.
4. Must not clobber fields already set by other paths when `explanation_profile` is null and `gap_focus` empty.
