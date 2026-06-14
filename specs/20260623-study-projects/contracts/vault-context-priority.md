# Contract: Vault Context Project Priority

**Module**: `src/js/vault/prompt-injection.js`

Extends A+ vault prompt injection with project-scoped ordering. **No exclusion** of unrelated entries.

## Updated signatures

```javascript
// Before: getVaultContextForDoc(docTopics)
// After:
getVaultContextForDoc(session) → VaultContextScoredEntry[]

buildVaultContextBlock(scoredEntries) → string
```

`session` must provide `projectId` and `shared.docTopics`.

## getProjectScopeDepth(entry, ancestorIds)

```javascript
// ancestorIds = getAncestorChain(session.projectId).map(p => p.id)
// For each vault entry, collect projectIds from entry.sources[].docId → session.projectId
// Return minimum depth where entry projectId matches ancestorIds[depth]
// Return Infinity if no match
```

## Sort order

1. Compute topic matches via existing `getEntriesByTopic(session.shared.docTopics)` (unchanged matching logic).
2. Attach `scopeDepth` per entry.
3. Sort by `scopeDepth` ascending (0 first).

## buildVaultContextBlock bands

| Band | Condition | Prompt label |
|------|-----------|--------------|
| sameSubject | `scopeDepth === 0` | `Same-subject mastery (calibrate depth on these first)` |
| relatedSubject | `0 < scopeDepth < Infinity` | `Related-subject mastery (background, lower priority)` |
| general | `scopeDepth === Infinity` | `General mastery (other subjects, awareness only)` |

Within each band, retain A+ mastered/partial/unstable classification via existing `describeEntry` / mastery helpers.

## Truncation priority (token budget)

Drop order: `general` → `relatedSubject` → never drop `sameSubject`.

## Call site updates

- `api.js` `deepSeekPackConceptsToBlocks` — pass session or `{ projectId, docTopics }` wrapper
- `deepSeekGenerateBlockExplanation` / block generation paths using vault hint
- Any other importer of `getVaultContextForDoc(docTopics)` → update to session-aware API

## Optional P2 (out of v1 contract)

`getExistingEntriesForNormalization(docTopics, ancestorIds)` — expand normalization search to ancestor-project sources. Not required for acceptance.

## Non-goals

- Change vault entry schema
- Filter out non-matching projects
- Merge docTopics with projectId into single signal
