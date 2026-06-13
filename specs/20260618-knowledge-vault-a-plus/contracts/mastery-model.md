# Contract: mastery-model.js

**Module**: `src/js/vault/mastery-model.js`

## Constants

```javascript
export const ALPHA = 0.3;
export const LAMBDA = 0.05;
export const OBSERVATION_WEIGHTS: Record<ObservationType, number>
export const PRESUMED_KNOWN_THRESHOLD = 0.7;
```

## Exports

```javascript
updateMastery(entry: KnowledgeVaultEntry, observation: VaultObservation): void
getCurrentMastery(entry: KnowledgeVaultEntry, now?: number): number
getMasteryLabel(entry: KnowledgeVaultEntry, now?: number): 'unknown' | 'partial' | 'acquired' | 'mastered'
hydrateMastery(entry: KnowledgeVaultEntry, now?: number): KnowledgeVaultEntry
```

## updateMastery algorithm

1. `daysSince = (obs.timestamp - entry.masteryLastUpdated) / MS_PER_DAY`
2. `decayed = entry.masteryBase * Math.exp(-LAMBDA * daysSince)`
3. `entry.masteryBase = clamp(decayed + ALPHA * observation.rawSignal, 0, 1)`
4. `entry.masteryLastUpdated = observation.timestamp`
5. Append observation to `entry.observations`

## getMasteryLabel bands

| Range | Label |
|-------|-------|
| [0, 0.29] | unknown |
| [0.30, 0.59] | partial |
| [0.60, 0.79] | acquired |
| [0.80, 1.0] | mastered |

## Tests (deterministic, no LLM)

- Observation sequence monotonicity for repeated positive signals.
- 7-day idle decay lowers `getCurrentMastery` without new observation.
- Wrong answer decreases base after prior mastery.
