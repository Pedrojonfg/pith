# Research: Adaptive Knowledge Probing Engine

**Feature**: `specs/20260630-adaptive-knowledge-probing`  
**Date**: 2026-06-21

## 14.1 — Current question-selection logic

**Decision**: Replace the *concept subset* chosen by `buildAssessmentCoveragePlan` (holistic path) or the full-inventory LLM prompt (legacy path), not the generation mechanics.

**Findings** (`study.js`, `assessment-coverage.js`, `api.js`):
- Entry: `createPrePackingItemsPromise` → `resolveHolisticAssessmentContext` when `isHolisticAssessmentEnabled()`.
- Holistic path: `computeHolisticAssessmentBudget` (≈50% of N concepts + edge quota) → `buildAssessmentCoveragePlan` batches concepts by doc hierarchy sections → `generateHolisticPrePackingAssessmentItems` map-reduces LLM calls per batch.
- Legacy path: `generatePrePackingAssessmentItems` sends full inventory to LLM with "cover evenly" instruction.
- Adaptive probing inserts **before** generation: `selectAdaptiveProbeConcepts(plan, graph, state, n)` returns ordered concept IDs; holistic plan is rewritten to scope batches to those IDs (same batch machinery, different concept selection).

**Rationale**: Preserves map-reduce, prefetch keys, and `ASSESSMENT_PARALLEL_PACKING` contract.

**Alternatives considered**: Per-probe LLM round-trip — rejected (breaks parallel packing).

---

## 14.2 — conceptGraph availability at assessment time

**Decision**: Explicit fallback to **independent-node mode** when `conceptGraph` is null, has no PREREQUISITE edges, or inventory-only prerequisites via `deriveInventoryEdges`.

**Findings**:
- `shared.conceptGraph` populated during DPP (`document-preparation.js`); may be null for interrupted ingest or legacy sessions.
- `deriveInventoryEdges` already merges `prerequisite_ids` from inventory with graph edges.
- Probe graph builder uses merged PREREQUISITE edges; if edge count = 0, `propagationEnabled: false` flag on graph object.

**Rationale**: Assessment must never block on missing graph.

---

## 14.3 — PART_OF / EXEMPLIFIES propagation

**Decision**: **Excluded entirely in v1** per draft spec §2 non-goals.

**Rationale**: No obvious default weight; prerequisite-only matches existing vault typed-edge model for "knowing A makes B likely."

---

## 14.4 — Edge weights for cycle-breaking

**Decision**: Use `edge.weight ?? edge.strength ?? 1.0` for cycle-break tie-break; no dependency on co-occurrence verification.

**Findings**: Concept registry edges may carry `weight` from connection promotion; unverified co-occurrence tracking is separate concern.

**Rationale**: Cycle-break only needs deterministic ordering, not calibrated strength.

---

## 14.5 — vault_belief_state fetch for screenVaultBranch

**Decision**: New module `src/js/adaptive-probing/belief-persist.js` with `loadProjectBeliefs(projectId)` / `mergeSessionBeliefs(projectId, sessionState)` using Supabase client pattern from `embedding-persist.js`.

**Findings**: `enterVaultBranch()` only calls `showScreen("vaultBranch")` — no data fetch today. Frontier section added to `index.html` + render in `study.js` on vault branch entry.

**Rationale**: Matches existing Supabase persistence patterns; keeps vault branch read-only for beliefs.

---

## Algorithm notes

**EIG**: Binary entropy H(p) = -p log2 p - (1-p) log2 (1-p). For candidate node, simulate knew/didn't-know outcomes using current belief as P(knew), apply `updateBeliefs` clone, measure ΔH summed over all nodes.

**Batch diversity**: After each selected probe, clone state, apply simulated `knew` at 0.5 confidence midpoint, re-run EIG on remaining candidates.

**Propagation**: Log-odds or direct belief update with clamp [0.01, 0.99]; asymmetric dampers for up/down along prerequisite direction (child→prereq up, prereq miss→child down).
