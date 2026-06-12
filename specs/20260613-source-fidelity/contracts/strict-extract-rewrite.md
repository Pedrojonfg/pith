# Contract: Strict Mode Extract → Rewrite

**Module**: `src/js/api.js`, flag `src/js/config/flags.js`

## Flag

```javascript
export const SOURCE_FIDELITY_FLAGS = {
  SOURCE_FIDELITY_STRICT: false,  // default off
};
export function isSourceFidelityStrictEnabled() { ... }
```

UI: checkbox on RSVP create screen — "Modo estricto (solo traducir la fuente)" — persists `session._meta.source_fidelity_mode = "strict" | "standard"`.

## Extract pass

```javascript
export async function deepSeekExtractSourceClaims({
  llmModel,
  materialText,
  blockTitle,
  language,
});
```

**System prompt**: Extract JSON only:

```json
{
  "claims": [
    { "type": "definition|classification|example|contrast|thesis", "text": "...", "terms": ["..."] }
  ]
}
```

Rules: every claim MUST be traceable to `materialText`; no external facts; empty array allowed for missing types.

**User**: chunk + block title.

## Rewrite pass

`deepSeekGenerateBlockJson` when strict:

1. Call extract (cache on block as `extracted_claims` if same chunk hash).
2. Pass claims to `buildBlockGenerationSystemPrompt({ strictMode: true, extractedClaims })`.
3. Skip mandatory example/contrast paragraphs not in claims (via `buildSourceFirstRsvpStructure`).

## Latency

One additional LLM call per block when strict enabled only.

## Tests

- Mock extract JSON → rewrite prompt contains claims substring
- Flag off → extract not called (spy or branch test)
