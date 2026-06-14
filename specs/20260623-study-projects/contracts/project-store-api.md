# Contract: Project Store API

**Module**: `src/js/project-store.js` (pure + thin persistence wrappers)

All tree helpers are pure functions over `(ProjectStore, sessions[])`. Mutations return new store or mutate via explicit save calls per project convention.

## Types

```javascript
/** @typedef {{ id: string, name: string, parentId: string|null, color?: string, createdAt: number, updatedAt: number }} Project */
/** @typedef {{ schemaVersion: 1, projects: Project[] }} ProjectStore */
/** @typedef {{ project: Project, children: ProjectTreeNode[] }} ProjectTreeNode */
```

## Read API

| Function | Input | Output | Rules |
|----------|-------|--------|-------|
| `getProject(store, id)` | store, id | `Project \| null` | |
| `getAncestorChain(store, id)` | store, id | `Project[]` | `[self, parent, …, root]` |
| `getDescendantIds(store, id, opts?)` | `{ includeSelf?: boolean }` | `string[]` | Recursive |
| `getChildren(store, id)` | store, id | `Project[]` | Direct children only |
| `getProjectTree(store, rootId?)` | optional root | `ProjectTreeNode[]` | Full or subtree |
| `getSessionsByProject(sessions, projectId, opts?)` | `{ includeDescendants?: boolean }` | `DocumentSession[]` | Default includeDescendants false |

## Mutation API

| Function | Behavior | Errors / no-ops |
|----------|----------|-----------------|
| `createProject(store, name, parentId)` | New UUID project | Empty name rejected |
| `renameProject(store, id, newName)` | Updates name + updatedAt | misc allowed |
| `moveProject(store, id, newParentId)` | Reparent | misc: no-op; cycle: reject |
| `deleteProject(store, id, sessions)` | Remove if empty | misc: no-op; has children/sessions: reject |
| `assignSessionToProject(session, projectId)` | Sets root projectId | Invalid id rejected |

## Cycle check (moveProject)

Before reparent: `newParentId` MUST NOT be in `getDescendantIds(store, id, { includeSelf: true })`.

## Delete guard

Reject when:
- `getChildren(store, id).length > 0`, OR
- `getSessionsByProject(sessions, id, { includeDescendants: true }).length > 0`

## Persistence (session-store integration)

| Function | Description |
|----------|-------------|
| `loadProjectStore()` | Parse `mylearning_projects` or null |
| `saveProjectStore(store)` | Write JSON |
| `ensureMiscProject(store)` | Insert MISC if missing |

## UI error strings (English)

| Key | Message |
|-----|---------|
| `cycle` | `Cannot move a project into its own subproject` |
| `deleteBlocked` | `Move subprojects and documents out before deleting` |
