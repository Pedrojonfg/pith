# Contract: mastery-refinement

**Module**: `src/js/vault/mastery-model.js`  
**FR**: FR-401–FR-403

## Dimension update

```javascript
updateMasteryDimension(entry, dimension, rawSignal, timestamp) → void
// dimension: 'declarative' | 'procedural'
```

Routes from `VaultObservation.taskKind` or type heuristics (R4).

## Combined mastery

```javascript
getCurrentMastery(entry) → number
```

Logic:
1. If `entry.useBkt` → `bktMastery(entry, observations)`
2. Else if both dimension bases exist → `0.4 * decay(declarative) + 0.6 * decay(procedural)`
3. Else → A+ `masteryBase` decay

## BKT gate

```javascript
maybeEnableBkt(entry) → void
```

Sets `useBkt = true` when `observations.length >= 15`.

## BKT update

Standard BKT posterior after each observation; store in `masteryBase` equivalent for display compatibility.

## Consumers

All existing `getCurrentMastery` callers (debug UI, assessment pre-fill, prompt-injection) work without change.
