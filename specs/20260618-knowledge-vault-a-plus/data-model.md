# Data Model: Global Knowledge Vault (Phase A+)

**Feature**: `20260618-knowledge-vault-a-plus`

Extends unified session shared layer. Vault is global (not per-document session).

## GlobalKnowledgeVault (persisted)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `schemaVersion` | `1` | yes | `1` | Vault schema version |
| `entries` | `KnowledgeVaultEntry[]` | yes | `[]` | All normalized concepts |
| `lastUpdated` | `number` | yes | `Date.now()` | Unix ms |

**Storage keys**:
- Primary: `localStorage['mylearning_knowledge_vault']`
- Overflow data: `localStorage['mylearning_knowledge_vault_data']` when JSON > ~300KB

## KnowledgeVaultEntry

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | yes | UUID at creation |
| `canonicalTitle` | `string` | yes | Normalized display name |
| `aliases` | `string[]` | yes | Alternate names seen |
| `topic` | `string` | yes | Thematic domain |
| `mastery` | `number` | runtime | 0–1, recalculated on read (not persisted) |
| `masteryBase` | `number` | yes | Stored value after last observation |
| `masteryLastUpdated` | `number` | yes | Unix ms |
| `lastSeen` | `number` | yes | Unix ms last appearance |
| `sources` | `VaultSource[]` | yes | Originating documents |
| `prerequisites` | `string[]` | yes | Vault entry ids |
| `dependents` | `string[]` | yes | Vault entry ids (inverse index) |
| `observations` | `VaultObservation[]` | yes | Signal history |

### VaultSource

| Field | Type | Description |
|-------|------|-------------|
| `docId` | `string` | Document session id |
| `conceptId` | `string` | Original `conceptInventory` id |
| `addedAt` | `number` | Unix ms |

### VaultObservation

| Field | Type | Description |
|-------|------|-------------|
| `type` | `ObservationType` | Signal category |
| `rawSignal` | `number` | -1 to +1 before weighting in update |
| `timestamp` | `number` | Unix ms |
| `docId` | `string` | Session that produced signal |

### ObservationType

```
'mcq_correct' | 'mcq_wrong' | 'socratic_passed' | 'socratic_partial'
| 'cloze_correct' | 'cloze_wrong'
| 'assessment_mastered' | 'assessment_partial' | 'assessment_unknown'
```

## DocumentSession.shared extension

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `docTopics` | `string[]` | no | `[]` | 2–5 thematic tags from hierarchy LLM |

Populated during `buildDocumentHierarchy()`; used for vault normalization filter.

## NormalizationMapping (runtime, LLM response)

| Field | Type | Description |
|-------|------|-------------|
| `conceptId` | `string` | New document concept id |
| `action` | `'merge' \| 'alias' \| 'new'` | Dedup decision |
| `vaultEntryId` | `string \| null` | Target entry for merge/alias |

## State transitions

```text
[Session study — MCQ/Socratic/Cloze/Assessment]
    → signals accumulate in session (assessmentSignals, block responses)
    → vault unchanged during study

[User leaves study / session close]
    → updateVaultFromSession(session, mode)
        → filterNewConcepts from conceptInventory
        → getExistingEntriesByTopic(docTopics)
        → normalizeConceptsToVault (LLM) if new concepts
        → mergeNormalizationResult
        → collectObservations → applyObservations (updateMastery)
        → elevatePrerequisiteRelations
        → persistVault

[Read mastery anywhere]
    → getCurrentMastery(entry) applies decay from masteryLastUpdated

[Assessment start — third doc same topic]
    → getVaultContextForDoc(docTopics)
    → UI marks entries with current mastery ≥ 0.7 as presumed_known

[Pack / generate block]
    → buildVaultContextBlock(entries) injected into api.js prompts
```

## Invariants

- `mastery` field in memory always derived from `masteryBase` + time decay; never written to localStorage.
- Each `VaultObservation.rawSignal` must match the canonical weight table for its `type`.
- `prerequisites` and `dependents` must stay in sync when adding an edge.
- Normalization with empty vault: all concepts → `action: 'new'`.

## Size expectations

- First document (~50–80 concepts): vault JSON < 5KB (SC-006).
- ~800–1000 concepts: ~300KB → trigger split storage migration.
