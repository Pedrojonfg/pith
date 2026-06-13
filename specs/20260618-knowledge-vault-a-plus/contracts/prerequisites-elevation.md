# Contract: prerequisites-elevation

**Module**: `src/js/vault/prerequisites.js`

## Export

```javascript
elevatePrerequisiteRelations(session, normalizationMap: Record<string, string>): void
addPrerequisiteRelation(vault, dependentId: string, prereqId: string): void
```

## Algorithm

For each `concept` in `session.shared.conceptInventory`:
- `vaultId = normalizationMap[concept.id]` — skip if missing
- For each `prereqConceptId` in `concept.prerequisite_ids || []`:
  - `prereqVaultId = normalizationMap[prereqConceptId]`
  - Skip if missing or `prereqVaultId === vaultId`
  - `addPrerequisiteRelation(vault, vaultId, prereqVaultId)` if not already present

## addPrerequisiteRelation

- Append `prereqId` to `dependent.prerequisites` if absent
- Append `dependentId` to `prereq.dependents` if absent

## Cycles

- Allowed in A+; no topological sort
- Prompt injection ignores unstable prereqs only by mastery, not cycle detection
