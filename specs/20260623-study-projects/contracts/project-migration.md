# Contract: Project Migration

**Module**: `src/js/session-migration.js`

## Entry point

```javascript
export function migrateProjects({ projectStore, sessions, saveProjectStore, saveSessions })
```

Called during app boot alongside existing V1→V2 migration.

## Steps (idempotent)

1. **Ensure store**: If `loadProjectStore()` null/invalid → `saveProjectStore({ schemaVersion: 1, projects: [MISC_PROJECT] })`.
2. **Ensure misc**: If no project with `id === 'misc'` → append MISC_PROJECT.
3. **Backfill sessions**: For each session where `!session.projectId` → set `projectId = 'misc'`.
4. **Persist** only if mutations occurred.

## MISC_PROJECT seed

```javascript
{
  id: 'misc',
  name: 'Misc',
  parentId: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}
```

## Non-goals

- Does not infer project from docTopics
- Does not reassign sessions already having projectId
- Does not bump DocumentSession.schemaVersion

## Verification

- Re-run migration twice → no duplicate misc, no session field churn
- Legacy sessions without projectId → all `misc` after first run
