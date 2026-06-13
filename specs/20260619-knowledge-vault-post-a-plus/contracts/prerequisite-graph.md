# Contract: prerequisite-graph

**Module**: `src/js/vault/prerequisite-graph.js` + extend `vault-store.js`  
**FR**: FR-501–FR-503

## Cycle-safe add

```javascript
addPrerequisiteSafe(fromId, toId) → { type: 'one_way' | 'co_prerequisite' }
```

Runs DFS; on cycle → add mutual `coPrerequisites`, skip one-way edge.

## Cross-document inference

```javascript
maybeInferPrerequisites(vault, topic) → InferredEdge[]
```

Trigger: `countDocsForTopic(topic) >= 5` and not run in last 7 days (store `lastInferenceAt` on vault meta).

LLM output: `{ fromId, toId, confidence }[]`  
Auto-apply if confidence ≥ 0.85.

## Centrality

```javascript
computeImportanceScore(entry, vault) → number
// dependents.length + 0.5 * coPrerequisites.length
```

Recompute on prereq change; cache on entry optional.

## Prompt / review consumers

- `prompt-injection`: co-prereq pairs → "teach together" hint
- `spaced-review`: multiply priority by importance

## Debug UI

- Show co-prerequisite badge on detail view
- Pending inferred edges queue (confidence 0.6–0.84) with Accept/Reject
