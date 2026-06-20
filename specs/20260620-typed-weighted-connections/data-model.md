# Data Model: Typed & Weighted Concept Connections

**Feature**: `20260620-typed-weighted-connections`

Extends `20260626-cross-doc-vault` registry.

## RegistryRelationshipType (v1 enum)

```typescript
type RegistryRelationshipType =
  | 'PREREQUISITE'
  | 'CONTRADICTS'
  | 'EXEMPLIFIES'
  | 'PART_OF'
  | 'ASSOCIATED';
```

## ConnectionEvidence

| Field | Type | Description |
|-------|------|-------------|
| `reinforcedCount` | `number` | Times both concepts co-occurred in correct response |
| `lastReinforcedAt` | `number \| null` | Epoch ms |
| `createdAt` | `number` | Epoch ms |

## RegistryConnection

| Field | Type | Required | Default (read) |
|-------|------|----------|----------------|
| `sourceId` | `string` | yes | — |
| `targetId` | `string` | yes | — |
| `type` | `RegistryRelationshipType` | yes | `ASSOCIATED` |
| `weight` | `number` | yes | `0.3` |
| `evidence` | `ConnectionEvidence` | yes | zeros + `createdAt` now |

**Storage**: `ConceptRegistry.connections: RegistryConnection[]` (additive; missing → `[]` on load).

**Identity**: Directed edge keyed by `sourceId|targetId` (no duplicate same direction).

## ConceptRegistry (extended)

```typescript
interface ConceptRegistry {
  schemaVersion: number;  // 2 when connections present
  concepts: Concept[];
  connections: RegistryConnection[];  // NEW
  observations: VaultObservationGlobal[];
  lastUpdated: number;
}
```

## Constants

| Constant | Value |
|----------|-------|
| `CONNECTION_INITIAL_WEIGHT` | `0.3` |
| `CONNECTION_REINFORCE_DELTA` | `0.15` |
| `CONNECTION_WEIGHT_MAX` | `1.0` |
| `CONNECTION_WEIGHT_FLOOR` | `0.05` |
| `CONNECTION_DECAY_DELTA` | `0.1` |
| `CONNECTION_DECAY_DAYS` | `30` (config/flags.js) |

## Promotion gate

An epistemic/document graph edge promotes to `RegistryConnection` only when:

1. Both inventory nodes resolve to `globalConceptId`.
2. Both registry concepts have `maturity` in `yellow` | `green`.

Document-local `shared.conceptGraph` is never mutated by this feature.

## Legacy read defaults (R8)

Missing `type` / `weight` / `evidence` → normalize to `ASSOCIATED`, `0.3`, `{ reinforcedCount: 0, lastReinforcedAt: null, createdAt: 0 }`.
