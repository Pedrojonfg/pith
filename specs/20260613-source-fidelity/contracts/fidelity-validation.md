# Contract: Block Fidelity Validation

**Module**: `src/js/fidelity-validation.js` (NEW), called from `deepSeekGenerateBlockJson` in `api.js`

## API

```javascript
export function extractKeyTermsFromBlockMeta({ blockTitle, signature, concepts });

/**
 * @returns {import('../data-model.md').FidelityValidationResult}
 */
export function validateBlockFidelity({
  blockTitle,
  signature,
  chunk,
  explanation,
  concepts,
});
```

## Validation rules

1. `extractKeyTermsFromBlockMeta`: terms from title (≥4 chars, no stopwords) + signature + concept terms.
2. For each key term `t`:
   - PASS if `normalize(t)` found in `normalize(chunk)`
   - ELSE PASS if token overlap between `explanation` and `chunk` ≥ 0.12 Jaccard on significant tokens
   - ELSE FAIL → add to `unsupported_terms`
3. If `unsupported_terms.length === 0` → `{ ok: true, action: "accept" }`
4. If terms missing but count ≤ 1 and chunk has `anchor_quality === "weak"` → `{ ok: true, action: "accept", severity: "none" }` (lenient)
5. Else → `{ ok: false, action: "retry", severity: "retry" }` on first pass; `"warn"` on second

## Retry integration (`deepSeekGenerateBlockJson`)

After first `parseAndEnforceBlock`:

```javascript
const validation = validateBlockFidelity({...});
if (!validation.ok && validation.action === "retry") {
  userContent += `\n\nFIDELITY RETRY: These terms lack support in the source chunk: ${validation.unsupported_terms.join(", ")}. Do NOT define them from general knowledge. Only use the chunk.`;
  // second llm call (existing retry pattern)
}
if (!validation.ok) {
  blockObj.fidelity_status = "warn";
  blockObj.fidelity_issues = validation.unsupported_terms;
}
```

## Tests

- Poisoned explanation with invented term → `ok: false`
- Explanation paraphrasing chunk with synonym → `ok: true`
- ≥6 unit cases in cursor-tests suite
