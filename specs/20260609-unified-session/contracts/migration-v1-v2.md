# Contract: V1 → V2 Migration

**Module**: `src/js/session-migration.js`

## Trigger

```js
export function detectAndMigrateV1()  // void; idempotent; called from main.js boot BEFORE study init
```

## Detection

| Condition | Action |
|-----------|--------|
| `mylearning_doc_sessions` exists with any `schemaVersion >= 2` | **Skip** (already migrated) |
| `sessions_by_mode` empty/missing AND no legacy data | **Skip** |
| `sessions_by_mode` has data | **Migrate** |

## Migration algorithm

1. `loadSessionsByMode()` — reuse existing parser from `session.js`
2. `rawMarkdown` = first non-empty among:
   - `slow.rawMarkdown` \| `slow.rawText` \| `slow.materialText`
   - `rsvp.rawMarkdown` \| `rsvp.rawText` \| `rsvp.originalMaterialText`
   - `cloze.rawMarkdown` \| `cloze.rawText`
   - `questions.*` equivalents
3. `docId` = `computeDocId(rawMarkdown)` or `'legacy-' + Date.now()` if no text
4. Build `DocumentSession`:
   - `modes.rsvp/slow/cloze/questions` = V1 slots (migrate html_min per slot if needed)
   - `shared.annotations` = copy from `slow.annotations` if array
   - `shared.conceptInventory` = best-effort from `slow.phase0.conceptsToFind`, `_meta.material_graph.conceptInventory`, cloze graph concepts
   - `shared.docHierarchy` = first found `docHierarchy` in any slot
   - `shared.smItems` = merge SM items from cloze/rsvp slices if present
5. `validateDocumentSession(session)` — abort if `!ok` (keep V1 intact)
6. Write `mylearning_v1_backup` = `{ migratedAt, sessionsByMode: copy, activeSession }`
7. Append/replace in `mylearning_doc_sessions`
8. `setActiveSession(docId)`
9. Remove `sessions_by_mode` key **only** after steps 5–8 succeed

## Idempotency

- Second boot: step 1 finds v2 sessions → return immediately
- If backup exists but v2 missing → retry migration from backup

## Rollback (manual)

User can restore from `mylearning_v1_backup` via settings (future) or dev console:

```js
localStorage.setItem('sessions_by_mode', JSON.stringify(backup.sessionsByMode))
localStorage.removeItem('mylearning_doc_sessions')
```

## Tests required

- slow-only V1 → v2 with annotations + slow slice intact
- empty `sessions_by_mode` → no-op
- corrupt JSON → no crash, V1 preserved
- multi-slot V1 → single DocumentSession
