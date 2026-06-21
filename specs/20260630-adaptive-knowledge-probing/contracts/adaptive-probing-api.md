# Contract: Probe Graph Builder

**Module**: `src/js/adaptive-probing/probe-graph.js`

## `buildProbeGraph({ conceptInventory, conceptGraph, projectId, docId, persistWarning })`

**Input**:
- `conceptInventory`: array with `id`/`concept_id`, optional vault link maturity
- `conceptGraph`: `{ nodes?, edges? }` or null
- `projectId`, `docId`: for warning persistence

**Output**: `ProbeGraph`

**Behavior**:
1. Collect node IDs from inventory (+ resolved vault concepts if present).
2. Filter edges to `type === 'PREREQUISITE'` (normalize via connection-types).
3. Merge `deriveInventoryEdges` prerequisite_ids when graph sparse.
4. DFS cycle detection; break lowest `weight` edge per cycle; append to `warnings`.
5. If zero edges after filter → `propagationEnabled: false`.
6. Reject duplicate node IDs with `Error('Duplicate probe graph node: …')`.

**Side effects**: Optional async persist of warnings to `probe_graph_warnings`.

---

# Contract: Belief State

**Module**: `src/js/adaptive-probing/belief-state.js`

## `initializeBeliefState({ conceptInventory, vaultEntries, flags })`

Returns `KnowledgeBeliefState` seeded from maturity table (green/yellow/gray).

## `isProbeCandidate(conceptId, state, flags)`

Returns false when belief outside skip thresholds or already probed in session.

---

# Contract: EIG Selection

**Module**: `src/js/adaptive-probing/eig-selection.js`

## `nextProbe(graph, state, options?)`

Returns `{ conceptId, expectedInformationGain }` or null if no candidates.

## `nextProbeBatch(graph, state, n, options?)`

Returns array length ≤ n; diversity via simulated propagation between picks.

## `selectAdaptiveProbeConcepts({ graph, state, n, inventory })`

High-level helper for study.js — returns ordered concept ID list for assessment scoping.

---

# Contract: Belief Propagation

**Module**: `src/js/adaptive-probing/belief-propagation.js`

## `updateBeliefs(graph, state, conceptId, response)`

**response**: `'knew' | 'partial' | 'missed'`

Mutates `state` in place; tags `source: 'propagated'` with `triggeredBy`.

## `computeGraphEntropy(state, nodeIds)`

Sum of binary entropies — used internally by EIG.

---

# Contract: Knowledge Frontier

**Module**: `src/js/adaptive-probing/knowledge-fringe.js`

## `computeFringes(graph, state, flags)`

Returns `{ outerFringe: string[], innerFringe: string[] }`.

---

# Contract: Assessment Integration

**Module**: `src/js/adaptive-probing/assessment-integration.js`

## `buildAdaptiveCoveragePlan({ inventory, edges, graph, state, budget, docHierarchy, materialText })`

When adaptive enabled: uses `nextProbeBatch` to pick concept IDs, then delegates to existing `buildAssessmentCoveragePlan` with filtered inventory subset.

When disabled: passthrough to existing plan builder unchanged.

**Invariant**: Full batch precomputed; `itemsPromise` created before packing parallel start.

---

# Contract: Belief Persistence

**Module**: `src/js/adaptive-probing/belief-persist.js`

## `loadProjectBeliefs(projectId) → Promise<Record<string, BeliefEntry>>`

## `mergeSessionBeliefs(projectId, sessionState) → Promise<void>`

Max-merge rule on upsert.

## `persistProbeGraphWarnings(warnings, { projectId, docId }) → Promise<void>`
