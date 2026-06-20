# Contract: registry-connection-store

**Module**: `src/js/concept-registry/connection-store.js`

## Exports

```javascript
export const CONNECTION_TYPES = Object.freeze({ ... });
export const CONNECTION_INITIAL_WEIGHT = 0.3;
export const CONNECTION_REINFORCE_DELTA = 0.15;

export function normalizeConnection(raw): RegistryConnection;
export function normalizeConnections(registry): RegistryConnection[];
export function applyLazyDecayToConnections(connections, now?, options?): RegistryConnection[];
export function upsertRegistryConnection({ sourceId, targetId, type }): RegistryConnection;
export function reinforceConnectionsForConcepts(conceptIds, now?): Promise<void>;
export function getConnectionsForGraph(): RegistryConnection[];
export function mapEpistemicTypeToRegistry(epistemicType, registryType?): RegistryRelationshipType;
```

## Invariants

- `type` always one of five enum values after normalize.
- `weight` clamped `[CONNECTION_WEIGHT_FLOOR, 1]`.
- `upsertRegistryConnection` no-ops if either endpoint concept missing or below yellow maturity.
- `reinforceConnectionsForConcepts` reinforces all registry edges whose both endpoints appear in the input set (≥2 unique IDs).
- Decay applied at most once per read when threshold exceeded since `lastReinforcedAt`.
- `reinforceConnectionsForConcepts` never throws to callers when used fire-and-forget.

## Promotion module

**Module**: `src/js/concept-registry/connection-promotion.js`

```javascript
export function promoteGraphConnectionsToRegistry(doc, graph?): number;
```

Maps `doc.shared.conceptGraph` edges through inventory `globalConceptId` lookup; returns count promoted.
