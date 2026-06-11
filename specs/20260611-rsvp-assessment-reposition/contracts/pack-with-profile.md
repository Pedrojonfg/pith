# Contract: Pack Inventory With Knowledge Profile

**Feature**: `20260611-rsvp-assessment-reposition`  
**Modules**: `src/js/api.js`, `src/js/session.js`

## `deepSeekPackConceptsToBlocks` extension

New optional param:

```js
knowledgeProfile: KnowledgeProfile | null
maxBlocks: number  // ceiling N (rename semantically from nBlocks in prompt)
```

### Prompt additions (when profile present)

- Input inventory is **complete**; output only affects which concepts get dedicated blocks
- Max blocks = `maxBlocks`; may return fewer
- Omit dedicated blocks for concepts with `mastery === 'full'` AND `confidence > threshold`
- Relational gap only → `learning_goal: 'relational'`, compress word target ~40%
- Prerequisite dominated concepts → include with `learning_goal: 'prerequisite_review'`
- Do NOT filter inventory or graph data structures

## `packInventoryToBlocks` extension

```js
export async function packInventoryToBlocks(
  inventory,
  nBlocks, // ceiling
  material,
  {
    llmModel,
    studyNotes,
    language,
    onProgress,
    knowledgeProfile = null, // NEW
  } = {},
)
```

### Return shape (unchanged + meta)

```js
{
  blockIndex,
  conceptInventory: inventory, // always full copy
  splitRunMeta: {
    requested_n,
    final_n,
    profile_applied: Boolean(knowledgeProfile),
    concept_inventory: inventory,
    pack_meta,
    ...
  }
}
```

### Post-processing

- Map `learning_goal`, `mastery_adjusted` from LLM block objects onto normalized index
- `final_n = blockIndex.length` after dedup
- Never remove concepts from `inventory` array passed to graph builders

## Invariants (tests)

1. `conceptInventory.length` identical with/without profile
2. `blockIndex.length <= requested_n`
3. With all-full profile (mock), `final_n < requested_n` or empty with warning path
4. `material_graph` node count == inventory concept count after pack
