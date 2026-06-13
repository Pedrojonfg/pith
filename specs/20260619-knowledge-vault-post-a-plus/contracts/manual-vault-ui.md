# Contract: manual-vault-ui

**Module**: `src/js/vault/debug-ui.js` (extend) + `vault-store.js`  
**Markup**: `index.html` Knowledge Vault section  
**FR**: FR-101–FR-105

## Store API (new)

```javascript
updateEntryTitle(entryId, canonicalTitle) → KnowledgeVaultEntry
mergeEntries(survivorId, mergedId) → KnowledgeVaultEntry
deleteEntry(entryId) → void  // cleans dependents/prereqs
addManualEntry({ canonicalTitle, topic, masteryBase, prerequisites? }) → KnowledgeVaultEntry
setPrerequisites(entryId, prerequisiteIds[]) → KnowledgeVaultEntry
```

## UI — list extensions

- Row actions: **Edit**, **Merge…**, **Delete**
- Toolbar: **Add concept**

## Edit modal

- Fields: canonical title, topic (dropdown), initial mastery slider (add only)
- Prerequisites: multi-select searchable list of vault entries
- Save → store API → refresh list

## Merge flow

1. Select survivor from two selected rows (or pick target in modal)
2. Confirm: shows alias preview + obs/source counts
3. `mergeEntries` → toast success

## Delete flow

- Confirm dialog with entry title + dependent count warning
- `deleteEntry` → remove from all `prerequisites` / `dependents` / `coPrerequisites`

## Validation

- Title non-empty, topic required
- Cannot merge entry with itself
- Prerequisite cannot include self
