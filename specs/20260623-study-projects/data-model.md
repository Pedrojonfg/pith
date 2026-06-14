# Data Model: Study Projects

**Feature**: `20260623-study-projects`

Does **not** bump global `DocumentSession.schemaVersion` (remains 2). Adds optional root field with migration backfill. New persisted store for projects.

## Project

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | UUID, except special `misc` |
| `name` | string | yes | Display name (default "Misc" for special) |
| `parentId` | string \| null | yes | `null` = root level |
| `color` | string | no | Optional swatch for UI |
| `createdAt` | number | yes | ms epoch |
| `updatedAt` | number | yes | ms epoch |

### Invariants

- At most one parent per project (tree, not DAG).
- `misc` MUST exist after migration; `parentId === null`.
- `misc` MUST NOT be deleted or reparented.
- Project names non-empty after trim.

## ProjectStore (persisted)

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | `1` | Store version |
| `projects` | `Project[]` | Flat list; tree derived by `parentId` |

**Storage key**: `localStorage['mylearning_projects']`

### Boot seed

```text
MISC_PROJECT = { id: 'misc', name: 'Misc', parentId: null, createdAt, updatedAt }
```

## DocumentSession (extended)

| Field | Location | Type | Description |
|-------|----------|------|-------------|
| `projectId` | root | string | Required after migration; default `misc` |

Unchanged: `docId`, `shared`, `modes`, `schemaVersion: 2`.

`shared.docTopics` — unchanged; orthogonal signal for vault topic search.

## ProjectTreeNode (derived, not persisted)

| Field | Type | Description |
|-------|------|-------------|
| `project` | Project | Node payload |
| `children` | ProjectTreeNode[] | Direct child projects |
| `sessionCount` | number | Optional UI aggregate |

## ReviewScope (transient UI)

| Field | Type | Description |
|-------|------|-------------|
| `projectId` | `'all' \| string` | `'all'` = no filter |
| `includeDescendants` | boolean | Default `true` when project selected |

## VaultContextScoredEntry (transient)

| Field | Type | Description |
|-------|------|-------------|
| `entry` | KnowledgeVaultEntry | Existing vault shape |
| `scopeDepth` | number | `0` same project, `1..n` ancestor, `Infinity` unrelated |

## Constants

| Name | Value |
|------|-------|
| `MISC_PROJECT_ID` | `'misc'` |
| `PROJECT_STORE_KEY` | `'mylearning_projects'` |
| `PROJECT_STORE_SCHEMA` | `1` |

## State transitions

### Project lifecycle

```text
[create] → active
active --[rename]→ active
active --[move/reparent]→ active (if no cycle)
active --[delete]→ removed (only if no children, no sessions)
misc --[rename]→ misc (delete/move blocked)
```

### Session assignment

```text
upload/create → projectId = context project | misc
library "Move to project…" → projectId = selected
migration backfill → projectId = misc (if missing)
```

## Migration (`migrateProjects`)

1. If no ProjectStore → create `{ schemaVersion: 1, projects: [MISC] }`.
2. For each session: if `!session.projectId` → `session.projectId = 'misc'`.
3. Idempotent on repeat runs.

## Relationships diagram

```text
ProjectStore (1) ──< (N) Project (tree via parentId)
Project (1) ──< (N) DocumentSession via projectId
DocumentSession (1) ──< (N) smItems via shared
KnowledgeVaultEntry.sources[].docId ──→ DocumentSession.docId ──→ projectId
```

## Out of scope (data model)

- Multi-project membership per document
- `projectId` on vault entries or smItems
- Auto-suggested project from docTopics
- Drag-order index on projects
