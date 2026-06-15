# Data Model: Cross-Document Concept Vault

**Feature**: `20260626-cross-doc-vault`

Extends `20260609-unified-session`, `20260620-sm2-priority-queue`, `20260621-recall-mode`.

## ConceptMaturity (visual states)

| State | Registry row | Meaning |
|-------|--------------|---------|
| `gray` | none | Local inventory only, `globalConceptId: null` |
| `yellow` | yes | Engaged; has schedule, no user content |
| `green` | yes | Has `ConceptContent` blocks |

Maturity is monotonic; decay affects `mastery` only.

## ConceptFacet

```typescript
type ConceptFacet =
  | 'recognition'   // MCQ/cloze/RSVP default
  | 'synthesis'
  | 'relational'
  | 'argumentative'
  | 'applicative';
```

Extends session-types Recall facets with `recognition`.

## Concept (global registry)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | yes | UUID PK |
| `canonicalName` | `string` | yes | Display name |
| `slug` | `string` | yes | Normalized identifier |
| `aliases` | `string[]` | yes | Alternate phrasings |
| `maturity` | `'yellow' \| 'green'` | yes | No gray rows |
| `mastery` | `number` | yes | 0–1 cached scalar |
| `facets` | `ConceptFacetSchedule[]` | yes | Per-facet SM-2 |
| `content` | `ConceptContent \| null` | no | Green only |
| `sourceDocIds` | `string[]` | yes | Contributing documents |
| `relatedConceptIds` | `string[]` | no | Ambiguous match hints |
| `createdAt` | `string` | yes | ISO |
| `updatedAt` | `string` | yes | ISO |

**Storage key**: `mylearning_concept_registry`

```typescript
interface ConceptRegistry {
  schemaVersion: number;  // 1
  concepts: Concept[];
  observations: VaultObservation[];
  lastUpdated: number;
}
```

## ConceptFacetSchedule

| Field | Type | Description |
|-------|------|-------------|
| `facet` | `ConceptFacet` | |
| `interval` | `number` | Days, SM-2 |
| `repetitions` | `number` | |
| `easeFactor` | `number` | |
| `dueDate` | `string` | ISO date |
| `lastReviewedAt` | `string` | ISO |
| `lastQuality` | `number` | 0–5 |

## ConceptContent

| Field | Type |
|-------|------|
| `blocks` | `ConceptContentBlock[]` |

### ConceptContentBlock

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID |
| `facet` | `ConceptFacet` | |
| `text` | `string` | User words post-tutor |
| `sourceDocId` | `string` | |
| `sourceSessionDate` | `string` | ISO |
| `supersededBy` | `string \| null` | Later block id |

## DocumentSession extensions

### ConceptInventoryEntry

| Field | Type | Default |
|-------|------|---------|
| `globalConceptId` | `string \| null` | `null` |

### AssessmentSignal

| Field | Type | Default |
|-------|------|---------|
| `globalConceptId` | `string \| null` | `null` |

### shared.smItems

**Deprecated** — read-through during migration; new writes go to global registry when resolved.

`DocumentSession.schemaVersion` bump via `session-migration.js`.

## VaultObservation (global)

| Field | Type |
|-------|------|
| `conceptId` | `string` |
| `facet` | `ConceptFacet` |
| `observedAt` | `string` |
| `quality` | `number` |
| `sourceDocId` | `string` |

## State transitions

```text
[Inventory created — ingest or full upload]
  → all entries gray (globalConceptId: null)

[First engagement — any mode]
  → identity resolution
  → create/reuse Concept (yellow)
  → set globalConceptId on inventory + signals
  → create ConceptFacetSchedule for triggering facet

[Qualifying Recall / Slow Phase 3]
  → append ConceptContentBlock (supersede if improved)
  → maturity = green

[Review answer]
  → update ConceptFacetSchedule SM-2
  → append VaultObservation
  → recompute Concept.mastery cache

[Decay loop — app open]
  → recompute mastery from observations + schedules
  → maturity unchanged
```

## Vault graph runtime shapes

```typescript
interface VaultGraphNode {
  id: string;           // global concept id or local inventory id
  label: string;
  maturity: 'gray' | 'yellow' | 'green';
  mastery?: number;
  scope: 'global' | 'local';
}

interface VaultGraphEdge {
  source: string;
  target: string;
  type: 'co_occurrence' | 'prerequisite' | 'explicit_link';
  weight?: number;
}
```
