# Contract: Extended normalizeConceptsToVault

## Input

```json
{
  "existingEntries": [{ "id", "canonicalTitle", "aliases", "area", "topic" }],
  "newConcepts": [{ "id", "title", "type": "CONCEPT" }],
  "topic": "string",
  "batchContext": {
    "docId": "string",
    "concepts": [{ "id", "title", "module", "prerequisite_ids", "concept_type" }],
    "existingVaultAreas": ["string"]
  }
}
```

`existingEntries` filtered to shared-area entries + top-K title similarity (max ~40).

## Output

```json
{
  "mappings": [{
    "conceptId": "string",
    "action": "merge|alias|new",
    "vaultEntryId": "string|null",
    "areaSuggestion": ["string"],
    "relatedCandidates": ["vaultEntryId"]
  }]
}
```

One mapping row per input concept. Fallback on LLM failure: `action: new`, empty suggestions.

## Prompt rules

- Prefer existing `existingVaultAreas` for `areaSuggestion`
- `relatedCandidates` = related-not-duplicate vault IDs only
- English prompts; JSON response only
