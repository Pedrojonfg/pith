# Contract: Vault Curation Module

**Module**: `src/js/vault/vault-curation.js`

## getStudiedConcepts(session)

Returns `conceptInventory` rows whose `id` appears in union of:

- RSVP/Questions block `concept_ids` from blockIndex
- `shared.assessmentSignals[].conceptId`
- Cloze items with `studyProgress`
- Recall questions with `answered === true`

## commitVaultCuration(session, selections)

```typescript
selections: Array<{
  conceptId: string;
  definition?: { text: string; accepted: boolean };
  reviewItems: Array<{ facet, prompt, answer, accepted: boolean }>;
}>
```

Steps per accepted concept:
1. `normalizeConceptsToVault` for merge
2. Append `VaultDefinition` if accepted and no existing def for `sourceDocId`
3. Append `VaultReviewItem` for each accepted review item
4. `saveVault`

## Idempotency

`hasDefinitionFromDoc(entry, docId)` prevents duplicate definitions.
