# Contract: normalization-llm

**API**: `src/js/api.js` → `normalizeConceptsToVault({ existingEntries, newConcepts, topic })`

## Input shape

```javascript
{
  existingEntries: Array<{ id, canonicalTitle, aliases }>,  // metadata only
  newConcepts: Array<{ id, title, type }>,
  topic: string  // primary doc topic for prompt header
}
```

## LLM prompt requirements

- English system/user prompt per `.cursorrules`
- Instruct: for each new concept return merge | alias | new with optional vaultEntryId
- Response JSON only:

```json
{
  "mappings": [
    { "conceptId": "...", "action": "merge"|"alias"|"new", "vaultEntryId": "..." | null }
  ]
}
```

## mergeNormalizationResult (normalization.js)

| action | Effect |
|--------|--------|
| merge | Add source to existing entry; update lastSeen |
| alias | Add alias string; add source |
| new | Create KnowledgeVaultEntry with canonicalTitle = concept.title |

## Empty vault

- Skip LLM call; all mappings `{ action: 'new', vaultEntryId: null }`.

## Error handling

- Invalid JSON / API error: fallback all-new entries; log once per session.
