# Data Model: Study Source Fidelity

**Feature**: `20260613-source-fidelity`

## Entidades

### ConceptInventoryItem (extended)

```typescript
interface ConceptInventoryItem {
  id: string;
  order: number;
  title: string;
  scope_one_line: string;
  module?: string;
  prerequisite_ids?: string[];
  source_phrase?: string;       // ≤25 words, verbatim/near-verbatim from material
  anchor_type?: "quoted" | "inferred";  // default "quoted" when source_phrase set
}
```

**Validation**:
- `source_phrase` if present must be substring-normalizable match in cleaned material (tests use normalized compare)
- `inferred` only when concept essential and no quotable phrase

### BlockIndexEntry (extended)

```typescript
interface BlockIndexEntry {
  id: number;
  title: string;
  summary: string;
  signature: string[];
  chunk: string;
  concept_ids?: string[];
  anchor_quality?: "strong" | "weak" | "proportional_fallback";
  chunk_match_terms?: string[];  // terms that anchored the window (debug/export)
}
```

### StudyBlock (generated, extended)

```typescript
interface StudyBlock {
  // existing fields...
  fidelity_status?: "ok" | "warn";
  fidelity_issues?: string[];    // e.g. ["term:amoralismo not in chunk"]
  extracted_claims?: ExtractedClaims;  // strict mode only
  anchor_quality?: BlockIndexEntry["anchor_quality"];
}
```

### ExtractedClaims (strict mode)

```typescript
interface ExtractedClaims {
  claims: Array<{
    type: "definition" | "classification" | "example" | "contrast" | "thesis";
    text: string;
    terms: string[];
  }>;
  source_chunk_hash?: string;  // optional fingerprint for cache invalidation
}
```

### FidelityValidationResult

```typescript
interface FidelityValidationResult {
  ok: boolean;
  unsupported_terms: string[];
  severity: "none" | "retry" | "warn";
  action: "accept" | "retry" | "warn_user";
}
```

### SourceFidelityConfig (session / flags)

```typescript
interface SourceFidelityFlags {
  SOURCE_FIDELITY_STRICT: boolean;  // default false — extract→rewrite pipeline
}
```

Stored in `src/js/config/flags.js`; strict mode also persisted on `session._meta.source_fidelity_mode?: "standard" | "strict"` when user toggles at create time.

### GuideContext (extended, ephemeral)

```typescript
interface GuideContext {
  sessionId: string;
  language: string;
  title: string;
  currentBlockIndex: number;
  sessionContext: string;
  currentBlockChunk?: string;      // Phase A
  documentExcerpt?: string;          // Phase C — resolved per query
  studiedBlockIndices: number[];
}
```

## State transitions

```text
upload + normalize
  → concept inventory (with source_phrase)
  → pack blocks
  → assignAlignedChunks → block_index with anchor_quality
  → [strict?] extract claims
  → generate block JSON (fidelity prompts)
  → validateBlockFidelity → retry | warn | ok
  → enrich concepts (existing pass, same rules)
  → study / guide (chunk + rules)
```

## Relationships

- `BlockIndexEntry.concept_ids[]` → `ConceptInventoryItem.id`
- `ConceptInventoryItem.source_phrase` → input to `assignAlignedChunks` term scoring
- `StudyBlock.fidelity_status` derived from validation + `anchor_quality`

## Storage

- `block_index` in localStorage (`LS_BLOCK_INDEX_KEY`) gains `anchor_quality`, `chunk_match_terms`
- `concept_inventory` in split run meta / block split cache gains `source_phrase`
- `extracted_claims` on block object in session `blocks[]` (strict mode)
- No new backend collections
