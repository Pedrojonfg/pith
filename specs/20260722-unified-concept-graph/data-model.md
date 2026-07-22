# Data Model: Unified Concept Graph

## ConceptNode

Superset of T1.2 inventory entry. Canonical id: `id` (also accept `canonicalId` as alias when present).

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | Stable concept id from inventory |
| `order` | usual | Document order |
| `title` | usual | Primary display from T1.2 LLM |
| `scope_one_line` | usual | Primary definition from T1.2 LLM |
| `label` | optional | Alias / Slow-merge; adapters use `label \|\| title` |
| `definition` | optional | Alias; adapters use `definition \|\| scope_one_line` |
| `questionClass` | optional | Set post-inventory |
| `globalConceptId` | optional | T1.6 |
| `aliases` | optional | Array |
| `importance` | optional | 1–5 when present |
| `semanticCluster` / `semantic_cluster` | optional | Prefer camelCase on write; accept snake on read |
| `nodeType` / `type` | optional | CONCEPT\|THESIS\|TERM\|AUTHOR\|CAUSE\|EFFECT |
| plus | optional | `module`, `prerequisite_ids`, threshold/anchor/novelty fields |

**Invariant**: Within one DPP run, `shared.conceptGraph.nodes === shared.conceptInventory` (same array reference).

## ConceptEdge

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | Stable edge id |
| `source_id` | yes | Must exist in node id set |
| `target_id` | yes | Must exist in node id set |
| `type` | yes | One of RELATION_TYPES (9 values) |
| `registry_type` | optional | Free string; often uppercase family |
| `sentence_context` | optional | Grounding snippet |

**Validation**: Drop edges with unknown endpoints (log). Clamp/normalize `type` via existing normalize helpers.

## ConceptGraph

```text
{ nodes: ConceptNode[], edges: ConceptEdge[] }
```

Degraded valid state: `edges: []` with non-empty nodes.

## Packing weights (config)

- `EDGE_ORDERING_WEIGHTS[relationType] → number`
- `EDGE_AFFINITY_WEIGHTS[relationType] → number`
- `STRUCTURAL_BONUS_SCALE` (default 0.3)
- Unmapped → ordering 0, affinity 0.1 + warn

## Relationships

- T1.2 writes inventory → T1.3 attaches edges → Cloze/graph/pack read graph  
- T1.4 reads inventory length only (unchanged)  
- Pack pipeline reads graph edges for ordering/affinity  

## Migration

None. Legacy graph shapes stale until next DPP.
