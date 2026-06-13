# Contract: vault-store.js

**Module**: `src/js/vault/vault-store.js`

## Exports

```javascript
loadVault(): GlobalKnowledgeVault
saveVault(vault: GlobalKnowledgeVault): void
getEntryById(id: string): KnowledgeVaultEntry | null
upsertEntry(entry: KnowledgeVaultEntry): void
addSource(entryId: string, source: VaultSource): void
clearVault(): void
exportVaultJson(): string
getEntriesByTopic(docTopics: string[]): KnowledgeVaultEntry[]
```

## Behavior

- `loadVault()` returns empty vault `{ schemaVersion: 1, entries: [], lastUpdated: Date.now() }` if missing or corrupt JSON.
- `saveVault()` updates `lastUpdated`; if serialized size > 300KB, split metadata vs. payload per large-session pattern.
- `getEntriesByTopic(docTopics)` uses flexible match: `topic.toLowerCase().includes(docTopic.toLowerCase())` OR reverse.
- `clearVault()` removes primary and overflow keys.

## Errors

- Corrupt JSON: log warning, return empty vault (no throw to caller).
