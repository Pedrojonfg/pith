# Contract: Unified Concept Graph

## `generateConceptRelations(markdown, inventory, opts)`

**Purpose**: Propose typed edges between fixed inventory concept ids only.

### Input

- `markdown`: string (study markdown)
- `inventory`: `ConceptNode[]` (non-empty)
- `opts`: `{ llmModel?, signal?, temperature? }` — temperature default ~0.1

### LLM output (JSON)

```json
{
  "edges": [
    {
      "id": "e1",
      "source_id": "<inventory id>",
      "target_id": "<inventory id>",
      "type": "prerequisite_of",
      "registry_type": "PREREQUISITE",
      "sentence_context": "optional quote"
    }
  ]
}
```

### Rules

1. Prompt MUST list allowed concept `{id, label|title, definition|scope_one_line}` and forbid inventing concepts.
2. `max_tokens`: named constant with sizing comment (expected max edges × tokens/edge).
3. Post-parse: drop edges whose endpoints ∉ inventory id set; normalize `type` via RELATION_TYPES.
4. On total LLM failure: caller stores `{ nodes: inventory, edges: [] }` (partial).

### Output

`ConceptEdge[]` (possibly empty).

---

## `runPhaseT13` contract

- **Deps**: `["T1.2"]`
- Empty inventory → `{ skipped: true, hash: "no_inventory" }`
- Success → `doc.shared.conceptGraph = { nodes: inventory, edges }` (same nodes array ref)
- Still calls `promoteGraphConnectionsToRegistry(doc, graph)`

---

## Cloze Phase 0 contract

- If `doc.shared.conceptGraph` has nodes aligned with inventory (post-T1.3), **do not** call `generateEpistemicGraph`.
- Consume edges as-is for NODE/EDGE item generation.

---

## Pack pipeline contract (edge-weighted)

### `finalImportance(node, edges)`

`llmImportance(node) + structuralBonus(node, edges)` where structuralBonus uses affinity weights only, capped (±1.0 before scale).

### Prerequisite repair

After blocks assigned: if block of dependent precedes block of prerequisite (`prerequisite_of`), move dependent’s block minimally after prerequisite’s block (repair, not full topo redesign).

### Affinity

Prefer co-locating high-affinity pairs when both fit max block size (property assertion, not exact layout).
