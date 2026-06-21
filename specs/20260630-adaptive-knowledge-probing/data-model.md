# Data Model: Adaptive Knowledge Probing Engine

**Feature**: `specs/20260630-adaptive-knowledge-probing`

## Session-scoped (localStorage via session-store)

### `shared.knowledgeBeliefState`

```typescript
type BeliefSource = 'prior' | 'probe' | 'propagated';

interface BeliefEntry {
  belief: number;       // [0, 1]
  lastUpdated: string;  // ISO timestamp
  source: BeliefSource;
  triggeredBy?: string; // conceptId of probe that caused propagated update
}

type KnowledgeBeliefState = Record<string, BeliefEntry>;
```

**Lifecycle**: Created at pre-packing assessment start (R1); updated per answer (R3); merged to project store on finish (R5.2); cleared on new session or explicit assessment restart.

### `shared.probeGraphMeta` (optional audit pointer)

```typescript
interface ProbeGraphMeta {
  nodeCount: number;
  edgeCount: number;
  cyclesBroken: number;
  propagationEnabled: boolean;
  builtAt: string;
}
```

## Supabase tables

### `probe_graph_warnings`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| project_id | text | FK logical to projects |
| doc_id | text | session document |
| from_concept_id | text | dropped edge |
| to_concept_id | text | dropped edge |
| edge_weight | float | weight of dropped edge |
| cycle_path | jsonb | ordered concept IDs in cycle |
| created_at | timestamptz | default now() |

RLS: user owns row via project membership (match existing vault tables pattern).

### `vault_belief_state`

| Column | Type | Notes |
|--------|------|-------|
| project_id | text | composite PK part |
| concept_id | text | composite PK part |
| belief | float | [0, 1] |
| source | text | prior \| probe \| propagated |
| updated_at | timestamptz | |

**Merge rule**: `belief = max(existing.belief, incoming.belief)` on upsert.

## In-memory pure types (not persisted)

### `ProbeGraph`

```typescript
interface ProbeGraph {
  nodes: string[];                    // concept IDs
  edges: { from: string; to: string; weight: number }[];
  adjacency: {
    prerequisites: Map<string, string[]>;  // node → prereqs
    dependents: Map<string, string[]>;     // node → children
  };
  propagationEnabled: boolean;
  warnings: ProbeGraphWarningDraft[];   // flushed to Supabase async
}
```

## Config (`config/flags.js`)

```javascript
ADAPTIVE_PROBING_FLAGS = {
  ADAPTIVE_PROBING_ENABLED: true,
  BASE_RATE_PRIOR: 0.25,
  HIGH_CONFIDENCE_SKIP_THRESHOLD: 0.9,
  LOW_CONFIDENCE_SKIP_THRESHOLD: 0.1,
  UPWARD_PROPAGATION_DAMPING: 0.6,
  DOWNWARD_PROPAGATION_DAMPING: 0.8,
  MAX_PROPAGATION_HOPS: 2,
  ADAPTIVE_PROBING_EARLY_STOP: false,
}
```

## Relationships

```
conceptInventory ──► ProbeGraph (PREREQUISITE filter)
vault maturity ──► BeliefEntry priors
ProbeGraph + BeliefState ──► nextProbeBatch ──► assessment generation
assessment responses ──► updateBeliefs ──► knowledgeBeliefState
knowledgeBeliefState ──► vault_belief_state (project merge)
vault_belief_state + ProbeGraph ──► computeFringes ──► vault branch UI
```
