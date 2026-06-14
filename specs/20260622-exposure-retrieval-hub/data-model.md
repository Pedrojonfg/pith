# Data Model: Exposure / Retrieval Architecture & Retrieval Hub

**Feature**: `20260622-exposure-retrieval-hub`

Does **not** increment global `schemaVersion` when legacy review slot kept empty. No new mandatory persisted fields on `DocumentSession` for v1.

## ModeTaxonomy (code-only, not persisted)

| Field | Type | Description |
|-------|------|-------------|
| `role` | `'exposure' \| 'retrieval'` | Pedagogical function |
| `scope` | `'document' \| 'vault'` | Data boundary |
| `label` | string | UI display name |
| `hint` | string | Short description for hub card |

### Static entries (v1)

| mode key | role | scope |
|----------|------|-------|
| `rsvp` | exposure | document |
| `slow` | exposure | document |
| `questions` | retrieval | document |
| `cloze` | retrieval | document |
| `recall` | retrieval | document |
| `review` | retrieval | vault |

`review` is **not** in `MODE_KEYS`; taxonomy includes it for vault navigation only.

## RetrievalHubContext (transient UI state, not persisted)

| Field | Type | Description |
|-------|------|-------------|
| `docId` | string | Active document for hub |
| `entrySource` | `'exposure_complete' \| 'library' \| 'mode_select'` | Analytics/debug only; same UI |
| `returnScreen` | string | Screen id if user backs out |

## Shared fields (existing — new readers)

### `shared.assessmentSignals`

Unchanged shape per `20260612-mode-continuity`. **New consumers**: Questions block ordering; Recall already reads via `recall-api.js`.

### `shared.smItems`

Unchanged per `20260620-sm2-priority-queue`. Each item MUST carry `docId` when normalized from vault aggregate (already set in `getSmItemsDueToday`).

Vault Review write path: `upsertSmItem(originDocId, patch)` — never write to wrong document.

## Legacy `modes.review` (optional empty)

If present on old sessions:

| Field | v1 behavior |
|-------|-------------|
| entire slot | Ignored by UI; not created on new sessions |

Migration step (T09): strip or noop in `session-migration.js` if non-empty config found.

## Reserved: `shared.exposureSignals` (NOT v1)

Documented for forward compatibility only:

| Field | Type | Description |
|-------|------|-------------|
| `conceptId` | string | Inventory canonical id |
| `questionText` | string | Learner's spontaneous question |
| `source` | `'guide-chat' \| 'slow-sidebar'` | Capture origin |
| `timestamp` | number | ms epoch |

Implement in future `exposure-signals-capture` spec.

## Navigation state transitions

```text
screenModeSelect --[Practice document]--> screenRetrievalHub
screenDocLibrary --[open doc]--> screenModeSelect --[Practice]--> screenRetrievalHub
RSVP/Slow complete -----------------------> screenRetrievalHub
screenRetrievalHub --[pick mode]--> enterModeWithContinuity(questions|cloze|recall)
screenDocLibrary --[Review due]--> screenReview (vault queue)
```

## Validation rules

- Hub MUST NOT render if `docId` invalid or document missing.
- Hub options filtered from taxonomy; empty filter → error banner "No retrieval modes configured".
- Vault Review with zero due items → existing empty state in `review.js`.
