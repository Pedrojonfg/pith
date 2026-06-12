# Data Model: RSVP Pipeline Levers

**Feature**: `20260617-pipeline-levers`

## Entidades

### PipelineLeversConfig (session._meta)

```typescript
interface PipelineLeversConfig {
  dedupSignatureOverlapThreshold?: number;  // default 3; strict default 2
  minChunkWords?: number;                   // default 400
  overlapPenaltyTermThreshold?: number;     // default 0.4
  jaccardThreshold?: { strict: number; normal: number };  // 0.35 / 0.20
  claimCoverageMin?: number;                // default 0.6
  inventoryCap?: number;                    // default 120
  twoPassInventory?: boolean;               // auto when under target
}
```

### ConceptInventoryItem (extended)

```typescript
interface ConceptInventoryItem {
  id: string;
  title: string;
  module?: string;
  source_phrase?: string;
  prerequisite_ids?: string[];
  level?: 1 | 2;                    // L3 two-pass
  secondary?: boolean;              // level-2 concepts
  concept_type?:                  // L4
    | "definition"
    | "argument"
    | "example"
    | "distinction"
    | "excursus";
}
```

### CoveredClaim (coverageManifest entry)

```typescript
interface CoveredClaim {
  blockId: number;
  claimType: "definition" | "argument" | "example" | "contrast";
  keyTerms: string[];
  questionAsked: string;  // one-line summary
}
```

### SessionCoverageState

```typescript
interface SessionCoverageState {
  coverageManifest: CoveredClaim[];
  alreadyQuestionedTerms: string[];  // denormalized for L18 prompt
}
```

### BlockIndexEntry (extended)

```typescript
interface BlockIndexEntry {
  id: number;
  title: string;
  summary: string;
  signature: string[];
  chunk: string;
  concept_ids?: string[];
  block_type?: "key_terms" | "overview" | "development" | "excursus";
  study_sequence?: boolean;         // L5-D: false for Key terms glossary
  module?: string;
}
```

### BlockQuestionConfig (resolved per block)

```typescript
interface BlockQuestionConfig {
  n_test: number;
  n_socratic: number;
  explanation_profile: string;
  gap_focus: string[];
  include_connection_questions: boolean;
  question_scope?: {               // L14
    allowed: string[];
    forbidden: string[];
    precedingKeyTermsSignature?: string[];
  };
}
```

### FidelityMetrics (extended)

```typescript
interface FidelityMetrics {
  jaccard: number;
  chunk_coverage: number;          // % chunk key terms in explanation
  claimCoverageRatio: number;
  uncoveredClaims: Array<{ source_phrase: string; type: string }>;
  severity: "ok" | "retry" | "warn";
}
```

### OverlapAuditResult

```typescript
interface OverlapAuditResult {
  hasSignificantOverlap: boolean;
  overlappingConcepts: string[];
  confidence?: number;
}
```

## State Transitions

### Block generation (ensureBlockGenerated)

```text
pending → generate explanation (+ optional extract claims)
       → validate fidelity (Jaccard + claim coverage) → retry if below threshold
       → audit overlap vs prev 2 blocks → retry with avoidOverlapWith if overlap
       → generate questions (with coverageManifest + scope)
       → extract claims from questions → append to coverageManifest
       → done
```

### coverageManifest lifecycle

```text
[] → after block N questions generated → append CoveredClaim[]
   → passed to block N+1 question generator
   → passed to deepSeekRegenerateBlockQuestions on regen
```

## Validation Rules

| Field | Rule |
|-------|------|
| Key terms block | `n_test === 0 && n_socratic === 0` always |
| Overview / Course map | same as Key terms |
| `estimatedConceptTarget` | `clamp(round(wordCount/300)*2, 30, 120)` |
| `claimCoverageRatio` | retry if `< claimCoverageMin` (default 0.6) |
| `study_sequence` | Key terms lateral mode: `false` |
| Dedup merge | shared signature terms ≥ threshold OR (≥1 shared concept_id AND ≥2 signature terms) |

## Relationships

- `Session` 1—1 `PipelineLeversConfig` (in `_meta`)
- `Session` 1—1 `SessionCoverageState` (in `_meta`)
- `BlockIndexEntry.block_type` derived from title prefix / pack rules
- `CoveredClaim.blockId` → `BlockIndexEntry.id`
- `ConceptInventoryItem.concept_type` informs `BlockIndexEntry.block_type` eligibility for Key terms
