# Data Model — Document Preparation Front-Load

**Feature**: `20260618-document-preparation-frontload`  
**Schema bump**: DocumentSession `schemaVersion` 2 → 3

## shared.preparation

```typescript
type PreparationStatus = 'pending' | 'running' | 'ready' | 'partial' | 'failed' | 'legacy';

interface PhaseResult {
  phaseId: string;       // e.g. 'T1.2'
  status: 'skipped' | 'success' | 'failed';
  startedAt?: number;
  completedAt?: number;
  outputHash?: string;
  error?: string;
}

interface PreparationState {
  status: PreparationStatus;
  fingerprint: string;
  startedAt: number | null;
  completedAt: number | null;
  currentPhase: string | null;
  currentWave: number;
  waves: { wave: number; phaseIds: string[] }[];
  phaseResults: Record<string, PhaseResult>;
  errors: { phaseId: string; message: string; at: number }[];
}
```

## shared.conceptGraph

```typescript
interface ConceptGraphNode {
  id: string;
  label: string;
  importance?: number;
  sentence_context?: string;
  nodeType?: string;
}

interface ConceptGraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  sentence_context?: string;
}

interface ConceptGraph {
  nodes: ConceptGraphNode[];
  edges: ConceptGraphEdge[];
  generatedAt?: number;
}
```

## shared.blockRecommendation

```typescript
interface BlockRecommendation {
  nBlocks: number;
  rationale: string;
  computedAt: number;
  signals: Record<string, unknown>;  // computeBlockCountRecommendation output
}
```

## shared.slowOrientation

```typescript
interface SlowOrientationCache {
  fingerprint: string;
  scopeKey: 'full_document';
  payload: object;  // Phase 0 orientation result
  generatedAt: number;
}
```

## State transitions

```text
upload → pending → running → ready | partial | failed
legacy sessions → legacy (no auto DPP until re-upload)
studyNotes change → fingerprint mismatch → pending (invalidate Tier 1+2 artifacts)
retry → re-run failed phases + dependents only
```

## Migration (schemaVersion 3)

1. If `shared.preparation` missing → `{ status: 'legacy', ... }`
2. If `modes.cloze.epistemicGraph` && !`shared.conceptGraph` → copy
3. Validate optional fields (no hard fail on missing new keys)
