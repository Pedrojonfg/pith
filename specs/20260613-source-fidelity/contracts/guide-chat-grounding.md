# Contract: Guide Chat Source Grounding

**Module**: `src/js/guide-chat.js`

## Phase A — Block chunk context

`buildSessionContext` MUST append for each studied block up to current index:

```text
Block N source chunk:
{getBlockChunkFromIndex(i) truncated to 8000 chars}
```

`buildGuidePrompt` system string MUST include `SOURCE_FIDELITY_RULES` and:

- Answer only from session context (chunks + explanations + concepts).
- If unsupported: one-sentence decline without external knowledge.
- Author definition prevails over generic domain knowledge.

## Phase C — Document-wide excerpt

```javascript
export function resolveGuideDocumentExcerpt(query, fullMaterial, { studiedBlockCount, blocksListText });
```

1. Tokenize query (significant words ≥4 chars).
2. Find best-matching position in `fullMaterial` by term density in 4000-char window.
3. Return excerpt centered on match.

### Spoiler policy

| Query type | Behavior |
|------------|----------|
| Definitional (`/qué es|define|significa|what is/i` or query term ∈ inventory titles) | May use `resolveGuideDocumentExcerpt` from full material |
| Synthetic / relational about unread blocks | Reply: "Aún no has estudiado el bloque que desarrolla esto." + if block title findable in `blocks_list_text`, mention block number only |
| Current block term | Prefer current block chunk first |

`fullMaterial` from `session._meta` / `state.lastCleanedMaterialText` / `doc.shared.rawMarkdown` (first available).

## Tests

- `buildGuidePrompt` contains "source chunk" or chunk text when fixture session provided
- `resolveGuideDocumentExcerpt` returns window containing search term
