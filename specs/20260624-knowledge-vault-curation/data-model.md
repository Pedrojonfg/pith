# Data Model: Knowledge Vault Curation

**Feature**: `20260624-knowledge-vault-curation`

Extends `20260618-knowledge-vault-a-plus` and `20260623-study-projects`.

## ConceptFacet

```typescript
type ConceptFacet = 'synthesis' | 'relational' | 'argumentative' | 'applicative' | 'cloze';
```

Reuses Recall recall_type values plus `cloze` for vault review cards.

## VaultDefinition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | `string` | yes | Markdown definition in source material terms |
| `sourceDocId` | `string` | yes | Originating document session id |
| `sourceChunk` | `string` | no | Aligned chunk excerpt |
| `addedAt` | `number` | yes | Unix ms |

## KnowledgeVaultEntry extensions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `definitions` | `VaultDefinition[]` | `[]` | Multi-source definitions |
| `facetCoverage` | `Partial<Record<ConceptFacet, number>>` | `{}` | facet → last verified ms |

All A+ fields unchanged. `mastery` remains scalar runtime field.

## VaultReviewItem

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | yes | UUID |
| `vaultEntryId` | `string` | yes | Target entry |
| `facet` | `ConceptFacet` | yes | Question perspective |
| `prompt` | `string` | yes | Review question |
| `answer` | `string` | yes | Expected answer |
| `sourceDocId` | `string` | yes | Session that produced item |
| `sm2` | `Sm2State` | yes | interval, easeFactor, dueDate, repetitions |
| `createdAt` | `number` | yes | Unix ms |

**Cardinality**: 0..N per entry; multiple same-facet allowed.

## VaultObservation extension

| Field | Type | Description |
|-------|------|-------------|
| `facet` | `ConceptFacet?` | Optional metadata |

### New ObservationType values

```
'review_correct' | 'review_partial' | 'review_wrong'
```

| Type | rawSignal |
|------|-----------|
| review_correct | +1.0 |
| review_partial | +0.3 |
| review_wrong | -0.5 |

## GlobalKnowledgeVault extension

| Field | Type | Default |
|-------|------|---------|
| `reviewItems` | `VaultReviewItem[]` | `[]` |

`schemaVersion` stays `2`.

### Migration on load

```text
if !vault.reviewItems → reviewItems = []
for each entry:
  if !entry.definitions → definitions = []
  if !entry.facetCoverage → facetCoverage = {}
```

## DecayCalibrationLogEntry (instrumentation only)

| Field | Type |
|-------|------|
| `vaultEntryId` | `string` |
| `facet` | `ConceptFacet?` |
| `daysSinceLastUpdate` | `number` |
| `predictedMastery` | `number` |
| `observedSignal` | `number` |
| `timestamp` | `number` |

Storage: `localStorage['mylearning_decay_calibration_log']`, max 1000 entries FIFO.

## Review queue union item

Runtime shape for merged pool:

```typescript
{
  source: 'session' | 'vault';
  // session: normalized SmItem
  // vault: VaultReviewItem + sm2 fields mapped for UI
}
```

## State transitions

```text
[Study session — modes touch concepts]
  → getStudiedConcepts(session) for upload candidate set

[Upload to vault — commit]
  → normalizeConceptsToVault
  → append definitions (idempotent per sourceDocId)
  → append VaultReviewItem (sm2 dueDate = now)
  → saveVault

[Review — vault item answered]
  → VaultObservation with facet
  → applyObservations → masteryBase, masteryLastUpdated = now
  → facetCoverage[facet] = now
  → update VaultReviewItem.sm2
  → appendDecayCalibrationLog
```
