# Contract: prompt-injection

**Module**: `src/js/vault/prompt-injection.js`

## Exports

```javascript
getVaultContextForDoc(docTopics: string[]): KnowledgeVaultEntry[]
buildVaultContextBlock(vaultEntries: KnowledgeVaultEntry[]): string
buildBlockVaultHint(blockConceptIds: string[], vaultEntries: KnowledgeVaultEntry[]): string
```

## getVaultContextForDoc

Returns all vault entries matching any docTopic (flexible substring via vault-store).

## buildVaultContextBlock (for packInventoryToBlocks)

English block appended to `buildConceptPackPrompt()`:

```
GLOBAL KNOWLEDGE CONTEXT (from user's cross-document study history):
Mastered concepts (skip or compress): ...
Partial concepts (brief review recommended): ...
Unstable prerequisites (reinforce before dependents): ...
```

Filters:
- Mastered: `getCurrentMastery(e) >= 0.7`
- Partial: `0.3 <= m < 0.7`
- Unstable prereqs: `dependents.length > 0 && m < 0.5`

## buildBlockVaultHint (for ensureBlockGenerated)

```
User's mastery on concepts in this block: Chain rule (mastered), ...
Calibrate depth accordingly.
```

Resolve concepts via `entry.sources.some(s => s.conceptId === id)`.

## Assessment pre-fill (T08)

Separate consumer in study.js / assessment UI:
- Entries with `getCurrentMastery >= 0.7` → UI `presumed_known: true`
- User override → emit `assessment_*` observation on submit
