# Data Model: SM-2 Priority Queue

**Feature**: `20260620-sm2-priority-queue`  
**Extends**: `20260609-unified-session` → `SharedLayer.smItems`

## SmItem (canonical)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `string` | yes | UUID | Stable item id |
| `sourceType` | enum | yes | — | `rsvp_block` \| `cloze_item` \| `slow_flashcard` \| `vault_concept` |
| `sourceId` | `string` | yes | — | Block id, cloze item id, flashcard/annotation id, vault entry id |
| `docId` | `string` | yes | — | Owning document session |
| `interval` | `number` | yes | `1` | Days until next due (SM-2) |
| `easeFactor` | `number` | yes | `2.5` | SM-2 EF, floor 1.3 |
| `repetitions` | `number` | yes | `0` | Count of on-time reviews with quality ≥ 3 |
| `scheduledDue` | `number` | yes | `now` | ms timestamp when SM-2 says item is due |
| `lastReviewed` | `number \| null` | yes | `null` | ms timestamp of last attempt (early or on-time) |
| `observations` | `SmObservation[]` | yes | `[]` | Full attempt history |
| `createdAt` | `number` | yes | `now` | ms |
| `title` | `string` | yes | — | Short label for UI |
| `contentPreview` | `string` | yes | `""` | Truncated context |

### Optional legacy compatibility (write-only deprecated)

Readers MUST normalize and MUST NOT depend on: `nextReview`, `sourceMode`, `source`, `reviewCount`, `question`, `answer`, `vaultEntryId`, `priority`, `conceptTitle`.

## SmObservation

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | `number` | yes | ms |
| `quality` | `0..5` | yes | SM-2 quality |
| `wasEarly` | `boolean` | yes | true if outside on-time window |
| `intervalAtTime` | `number` | yes | `item.interval` at attempt |
| `daysEarly` | `number` | yes | Days before `scheduledDue` if early, else 0 |

## SharedLayer (unchanged container)

```text
DocumentSession.shared.smItems: SmItem[]
```

Default `[]` in `normalizeSession` (already present).

## Identity & upsert rules

1. Primary key: `id`
2. Secondary dedup: `(sourceType, sourceId)` within same `docId`
3. Vault concept items: `sourceType = 'vault_concept'`, `sourceId = vaultEntryId`, `id` stable as `vault:{entryId}`

## State transitions (on-time review)

```text
[new item] --first on-time q>=3--> interval=1, repetitions=1
[repetitions=1, q>=3] --> interval=6, repetitions=2
[repetitions>1, q>=3] --> interval=round(interval*EF), repetitions+=1
[any, q<3 on-time] --> repetitions=0, interval=1
[early, any q] --> observations+=1, lastReviewed=now, SM-2 fields unchanged
```

After any on-time update: `scheduledDue = now + interval * 86400000`, `easeFactor` recalculated, `observations` appended.

## Queue view (derived, not stored)

`buildReviewQueue(items, now)` → sorted copy by `scheduledDue` asc.

## Queue stats (derived)

| Stat | Rule |
|------|------|
| `dueNow` | `scheduledDue <= now` |
| `dueToday` | `scheduledDue <= now + 86400000` |
| `total` | `items.length` |

## Validation (`session-types.js`)

- `shared.smItems` must be array
- Each item after normalize: finite `scheduledDue`, `interval >= 0`, `easeFactor >= 1.3`, `sourceType` in enum

## Relationships

```text
DocumentSession 1──* SmItem
SmItem *──* SmObservation (embedded)
SmItem.sourceId ──> RSVP Block | ClozeItem | SlowFlashcard | VaultEntry (logical, not FK)
```

## Migration from v1 partial shapes

`normalizeSmItem(raw)` called:
- On `getSession` return
- Before `upsertSmItem` merge
- In `buildReviewQueue` / tests

Persist writes canonical fields only.
