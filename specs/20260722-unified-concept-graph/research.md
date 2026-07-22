# Research: Unified Concept Graph

**Feature**: `20260722-unified-concept-graph`  
**Date**: 2026-07-22  
**Source open questions**: `spec-unifcg.md` §2

## Q1 — Inventory node shape

**Decision**: Unified `ConceptNode` is a **superset of the T1.2 LLM inventory shape** (`id`, `order`, `title`, `scope_one_line`, plus optional/parser/post fields). Do **not** replace `title`/`scope_one_line` with `label`/`definition` only.

**Rationale**: `parseConceptInventoryFromModelResponse` persists `title`/`scope_one_line`. Consumers already use dual fallbacks (`label || title`, `definition || scope_one_line`) inconsistently. Dropping `title`/`scope_one_line` would break RSVP slim pack and deterministic pack.

**Also preserve when present**: `module`, `prerequisite_ids`, `source_phrase`, `anchor_type`, `questionClass`, threshold/anchor/novelty fields (`isThreshold`, `thresholdScore`, `anchorRange`, `globalConceptId`, `noveltyScore`, …), and Slow-merge fields (`canonicalId`, `label`, `definition`, `importance`, `aliases`) when those paths wrote them.

**Compatibility**: Within adapters and edge LLM prompt, treat `label = label || title`, `definition = definition || scope_one_line`. Prefer writing dual fields on normalize when building graph nodes from inventory so Cloze/normalize paths that still expect `text`/`label` work via thin adapters.

**Alternatives considered**: Force rename all inventory to `label`/`definition` in T1.2 — rejected (large blast radius, out of FR-010 spirit).

---

## Q2 — Relation types

**Decision**: Edge validation reuses `normalizeEpistemicEdge` / `normalizeEpistemicGraph` against private `RELATION_TYPES` (9 values). Export or re-export for packing weights.

**Enum** (`cloze/normalize.js`):

`implies | causes | supports | contradicts | defines | exemplifies | is_a | part_of | prerequisite_of`

**registry_type**: not a hard enum in normalize; prompt historically used `PREREQUISITE | CONTRADICTS | EXEMPLIFIES | PART_OF | ASSOCIATED`. Keep optional passthrough string; map via existing `mapEpistemicTypeToRegistry`.

**Weight keys**: use lowercase `RELATION_TYPES` values (not the uppercase table in the source design). Map design intent:

| Design name | RELATION_TYPES key | ordering | affinity |
|---|---|---|---|
| PREREQUISITE | `prerequisite_of` | 1.0 | 0.3 |
| PART_OF | `part_of` | 0.0 | 0.9 |
| EXEMPLIFIES | `exemplifies` | 0.4 | 0.7 |
| CONTRADICTS | `contradicts` | 0.0 | 0.5 |
| ASSOCIATED | (no direct type; use `supports` / default) | — | — |
| (unlisted) | `implies`, `causes`, `defines`, `is_a`, … | 0.0 | 0.1 |

Default for any unmapped type: `{ ordering: 0, affinity: 0.1 }` + `console.warn`.

---

## Q3 — `promoteGraphConnectionsToRegistry`

**Decision**: **No node-field changes required.** Function only reads edges + inventory id→`globalConceptId` map (`concept-registry/connection-promotion.js`).

**Rationale**: Does not read `nodes[].text` or `label`.

---

## Q4 — `nodes[].text` vs `label`

**Decision**: Prefer a **thin compatibility adapter** in normalize + `buildClozeEpistemicGraph`: accept `text || label || title`. After T1.3 stores inventory-shaped nodes, adapters synthesize display text without rewriting all inventory writers.

**Call sites that need adapter or update**:
- `graph/build.js` `buildClozeEpistemicGraph`
- `cloze/normalize.js` `normalizeEpistemicNode`
- `cloze/pipeline.js` `epistemicGraphFromShared`
- `pack-concept-editor.js` (reads/writes `node.text`)
- `session-migration.js` (already `text || label`)

**Do not** change Slow argument-map `node.text` paths (different artifact).

**Alternatives considered**: Global rename inventory→`label` and purge `text` — more invasive; deferred unless adapters prove insufficient.

---

## Q5 — Where to inject edge-weighted packing

**Decision**: **Do not rewrite `runPhaseT14`.** T1.4 only computes `blockRecommendation.nBlocks` from aggregate signals. Inject affinity/ordering into the **pack pipeline**:

1. Affinity / structural bonus: `packInventoryDeterministic` and/or a shared helper used before/after novelty bias; optional hint for LLM pack via slim inventory order.
2. Prerequisite ordering repair: post-pass at end of `packInventoryToBlocks` using `conceptGraph.edges` where `type === "prerequisite_of"` (minimal move-up repair, not full topo sort).

**Rationale**: Matches FR-008/009 without expanding T1.4 scope; aligns with repo reality.

---

## Q6 — `generateEpistemicGraph` call sites

**Decision**: Replace T1.3 body with `generateConceptRelations(markdown, inventory, opts)`. Cloze Phase 0 must **skip** regeneration when `shared.conceptGraph` already has inventory-aligned nodes (always after successful T1.3); never call `generateEpistemicGraph` when consuming prepared docs.

**Call sites today**: only `runPhaseT13` and `runClozePipelinePhases` Phase 0. No UI regenerate.

**PHASE_DEPS**: change `"T1.3": ["T1.2"]`. Tier-1 gate unchanged (`T0.1, T0.2, T1.1, T1.2, T1.4`); T1.3 remains deferred.

---

## New module placement

**Decision**: Add `generateConceptRelations` in `src/js/cloze/pipeline.js` (or thin `src/js/concept-graph/relations.js` imported by pipeline) reusing `normalizeEpistemicGraph` edge validation. Prefer **`src/js/concept-graph/relations.js`** to avoid bloating pipeline further, export from there, call from `document-preparation.js` and Cloze skip path.

**Config**: `src/js/config/packing-weights.js` with `EDGE_ORDERING_WEIGHTS`, `EDGE_AFFINITY_WEIGHTS`, `STRUCTURAL_BONUS_SCALE`, `DEFAULT_UNMAPPED_AFFINITY`.

---

## Persistence identity

**Decision**: Keep `shared.conceptInventory` as write source of truth for T1.2 consumers. Set `doc.shared.conceptGraph = { nodes: inventory, edges }` using the **same array reference** within the run. JSON persistence may duplicate arrays on reload — acceptable; next DPP regenerates.

---

## Testing strategy

- Fixture TDD with mocked LLM for relations + packing invariants.
- Property-based: prerequisite order repair; PART_OF affinity co-location when size allows.
- No exact block layout snapshots.
