# Contract: session-close-pipeline

**Module**: `src/js/vault/session-close.js`  
**Trigger**: `study.js` exit handlers → `updateVaultFromSession(session, mode)`

## Export

```javascript
updateVaultFromSession(session: DocumentSession, mode: string): Promise<void>
```

## Pipeline steps

1. `filterNewConcepts(session.shared.conceptInventory, vault)` — concepts not yet in any entry.sources
2. `getDocTopics(session)` → `session.shared.docTopics`
3. `getExistingEntriesByTopic(vault, docTopics)` via vault-store
4. If new concepts exist: `normalizeConceptsToVault(existing, newConcepts, topic)` (api.js)
5. `mergeNormalizationResult(vault, mappings, newConcepts, docTopics)` → `normalizationMap: Record<conceptId, vaultEntryId>`
6. `collectObservations(session, mode)` from `assessmentSignals` + answered blocks
7. `applyObservations(vault, observations, normalizationMap)`
8. `elevatePrerequisiteRelations(session, normalizationMap)` (prerequisites.js)
9. `saveVault(vault)`

## collectObservations mapping

| Source | ObservationType |
|--------|-----------------|
| Pre-packing assessment mastered | assessment_mastered |
| Pre-packing partial | assessment_partial |
| Pre-packing unknown | assessment_unknown |
| MCQ correct/wrong | mcq_correct / mcq_wrong |
| Socratic pass/partial | socratic_passed / socratic_partial |
| Cloze correct/wrong | cloze_correct / cloze_wrong |

## Non-blocking

- Caller must not await before navigation; fire-and-forget with `.catch` log acceptable.
- If normalization fails: steps 6–9 still run with identity map (concept title as new entries).

## Phase rollout

- **T02**: Steps 1–3, 6–9 without step 4 (raw concept names as canonicalTitle).
- **T04**: Enable step 4–5.
