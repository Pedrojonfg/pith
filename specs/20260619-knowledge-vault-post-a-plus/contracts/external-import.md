# Contract: external-import

**Module**: `src/js/vault/import.js` + `api.js`  
**FR**: FR-201–FR-204

## Entry points

| Method | UI trigger | Default mastery |
|--------|------------|-----------------|
| `importFromText(text, { defaultMastery })` | Settings → Import → Paste text | 0.7 |
| `importFromDocument(file, { markAsKnown: true })` | Upload + checkbox "Already know this" | 0.8 |
| `importFromCsv(file)` | Import → CSV | per row |
| `importFromJson(file)` | Import → JSON | per entry |

## Text import pipeline

1. User pastes text + optional mastery default
2. LLM `extractConceptsFromImportText` → `{ title, topic }[]`
3. `normalizeConceptsToVault` with existing entries
4. Apply `masteryBase` / dimension bases to new merges
5. Append `ImportRecord`

## Document import pipeline

1. Run normalization pipeline (no session create)
2. Extract `conceptInventory` only
3. Same normalize + mastery as text

## CSV schema

```csv
canonicalTitle,topic,mastery,prerequisites
"Chain rule","calculus",0.85,""
```

## JSON schema

```json
{ "entries": [{ "canonicalTitle": "...", "topic": "...", "masteryBase": 0.7, "prerequisites": [] }] }
```

## Errors

- Return `{ added, merged, errors[] }`; partial success allowed
- UI shows error list; vault not rolled back on partial
