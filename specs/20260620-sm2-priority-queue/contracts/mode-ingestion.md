# Contract: mode-ingestion

**Modules**: `src/js/sm2-ingest.js`, `study.js`, `cloze/study.js`, `cloze/pipeline.js`, `slow/phase3.js`, `vault/spaced-review.js`  
**FR**: FR-008–FR-011, FR-015

## registerOrUpdateSmItem

```javascript
registerOrUpdateSmItem(docId, {
  sourceType,
  sourceId,
  title,
  contentPreview,
  quality,        // optional — if provided, runs updateSmItem
  meta?,          // optional passthrough
}) → SmItem
```

Behavior:
1. Load session `shared.smItems` (normalized)
2. Find by `(sourceType, sourceId)` or create via `createSmItem`
3. If `quality` provided: `updateSmItem` → `upsertSmItem(docId, item)`
4. Else: `upsertSmItem` with create-only

## RSVP / Questions (`study.js`)

Hook after block answer recorded (assessment signals path):

```javascript
mapMcqOutcomeToQuality({ correct, firstTry, usedHint, skipped }) → 0..5
registerOrUpdateSmItem(docId, {
  sourceType: 'rsvp_block',
  sourceId: blockId,
  title: block.title,
  contentPreview: conceptIds.slice(0,3).join(', '),
  quality,
});
```

## Cloze (`cloze/study.js`)

After each answer:

```javascript
mapClozeResultToQuality(result) → 5|4|3|1
registerOrUpdateSmItem(docId, {
  sourceType: 'cloze_item',
  sourceId: clozeItemId,
  title: sentence excerpt,
  contentPreview: blank context,
  quality,
});
```

## Cloze pipeline (`cloze/pipeline.js`)

`persistClozeItemsToShared` writes canonical shape (no quality yet — scheduledDue = now).

## Slow Mode (`slow/phase3.js`)

On flashcard create:

```javascript
registerOrUpdateSmItem(docId, {
  sourceType: 'slow_flashcard',
  sourceId: flashcardId || annotationId,
  title: front,
  contentPreview: back.slice(0, 80),
});
```

## Vault bridge (`vault/spaced-review.js`)

`buildVaultSmItem` output:

```javascript
{
  id: `vault:${vaultEntryId}`,
  sourceType: 'vault_concept',
  sourceId: vaultEntryId,
  docId,
  title: canonicalTitle,
  contentPreview: definition slice,
  ...SM2_DEFAULTS,
  scheduledDue: now - floor(priority * PRIORITY_SCHEDULE_MS), // urgency ordering
}
```

On vault review answer in Review UI → `applyVaultReviewObservation` + `updateSmItem`.

## session-store extensions

```javascript
upsertSmItem(docId, item)
// merge by id; normalize both sides

getSmItemsDueToday(docId)
// uses scheduledDue after normalize
```

## Invariants

- No duplicate `(sourceType, sourceId)` per doc after upsert
- Non-vault items preserved when `syncVaultToReviewPool` runs (existing filter)
- Ingestion hooks MUST NOT throw into study flow — log warn on failure
