# Data Model: Global Knowledge Vault (Post A+)

**Feature**: `20260619-knowledge-vault-post-a-plus`  
**Extends**: `20260618-knowledge-vault-a-plus` data model (schema v1 → v2)

## Schema version bump

`GlobalKnowledgeVault.schemaVersion`: `1` → `2` (migration on read: v1 entries get default post-A+ fields).

## GlobalKnowledgeVault (persisted) — changes

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | `2` | yes | Bumped for post-A+ |
| `entries` | `KnowledgeVaultEntry[]` | yes | Extended entry shape |
| `lastUpdated` | `number` | yes | Unix ms |
| `importHistory` | `ImportRecord[]` | no | Last 20 import jobs |

## KnowledgeVaultEntry — new/extended fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `masteryDeclarativeBase` | `number` | no | mirrors `masteryBase` on migrate | Stored declarative mastery |
| `masteryProceduralBase` | `number` | no | mirrors `masteryBase` on migrate | Stored procedural mastery |
| `masteryDeclarativeLastUpdated` | `number` | no | `masteryLastUpdated` | Decay anchor declarative |
| `masteryProceduralLastUpdated` | `number` | no | `masteryLastUpdated` | Decay anchor procedural |
| `useBkt` | `boolean` | no | `false` | Auto-set when obs ≥ 15 |
| `bktParams` | `BktParams` | no | defaults | Per-entry BKT parameters |
| `misconceptions` | `Misconception[]` | no | `[]` | Active and resolved |
| `coPrerequisites` | `string[]` | no | `[]` | Bidirectional partners |
| `importanceScore` | `number` | runtime | computed | Centrality cache (optional persist) |
| `manualOrigin` | `boolean` | no | `false` | User-created vs session |

**Removed/changed behavior**: `mastery` runtime may derive from BKT when `useBkt`; else weighted declarative/procedural if both exist; else A+ `masteryBase` decay.

## VaultObservation — extended

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wrongAnswer` | `string` | no | Selected distractor or free-text error |
| `wrongAnswerPattern` | `string` | no | LLM cluster label |
| `taskKind` | `'declarative' \| 'procedural'` | no | Routes mastery dimension |
| `importJobId` | `string` | no | Provenance for imports |

## Misconception

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | yes | UUID |
| `description` | `string` | yes | e.g. "Confuses X with Y" |
| `confidence` | `number` | yes | 0–1 |
| `observationIds` | `string[]` | yes | Evidence obs indices or ids |
| `detectedAt` | `number` | yes | Unix ms |
| `resolved` | `boolean` | yes | default false |
| `resolvedAt` | `number` | no | When marked resolved |

## BktParams

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `pL0` | `number` | `0.3` | Prior knowledge |
| `pT` | `number` | `0.2` | Learn rate |
| `pG` | `number` | `0.2` | Guess rate |
| `pS` | `number` | `0.1` | Slip rate |

## ImportRecord

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Job id |
| `type` | `'text' \| 'document' \| 'csv' \| 'json'` | Source |
| `startedAt` | `number` | Unix ms |
| `completedAt` | `number` | Unix ms |
| `conceptsAdded` | `number` | Count |
| `conceptsMerged` | `number` | Count |
| `errors` | `string[]` | Validation messages |

## Co-prerequisite invariant

If `A.coPrerequisites` includes `B`, then `B.coPrerequisites` includes `A`, and neither `A.prerequisites` nor `B.prerequisites` contains a direct cycle pair (one-way edges between co-prereq partners removed).

## State transitions (additions)

```text
[Manual edit / merge / delete]
    → vault-store CRUD → persistVault → invalidate importance cache

[Import text | document | file]
    → import.js → extract concepts → normalizeConceptsToVault → apply default mastery
    → append ImportRecord

[Session close — misconception path]
    → if ≥3 related negative obs → detectMisconceptionPattern (LLM optional)
    → append Misconception on entry

[Session close — standard]
    → route observation to declarative or procedural mastery dimension
    → if obs count ≥ 15 → enable useBkt

[Prerequisite add]
    → cycle detect → coPrerequisite or one-way edge → recompute importanceScore

[Topic threshold — 5 docs]
    → inferCrossDocumentPrerequisites (LLM) → merge high-confidence edges

[Mode select / scheduler tick]
    → spaced-review.js: decaying entries → shared.smItems

[Review complete]
    → observations → vault mastery update
```

## Migration v1 → v2

On `loadVault()`: if `schemaVersion < 2`, for each entry set `misconceptions = []`, `coPrerequisites = []`, `manualOrigin = false`, copy `masteryBase` to both dimension bases, set `schemaVersion = 2`.
