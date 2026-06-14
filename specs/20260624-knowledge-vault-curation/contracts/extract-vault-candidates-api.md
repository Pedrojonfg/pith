# Contract: extractVaultCandidates LLM API

**Module**: `src/js/api.js`

## extractVaultCandidates({ concepts, session, existingVaultContext })

### Input

- `concepts`: studied concept rows from `getStudiedConcepts`
- `session`: active document session (for chunks, docTopics)
- Per-concept optional `existingEntry`, `existingFacets`, `facetCoverage`

### Output

```json
{
  "candidates": [
    {
      "conceptId": "c1",
      "definition": "markdown text",
      "suggestedReviewItems": [
        { "facet": "relational", "prompt": "...", "answer": "..." }
      ]
    }
  ]
}
```

### Prompt rules

- Source fidelity: definitions in material's own terms
- 0–3 items per concept, distinct facets
- Prioritize facets NOT in `existingFacets`
- English prompts/answers

### Errors

Throws on invalid JSON; caller shows retry UI.
