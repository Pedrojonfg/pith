# Deep Dive: Typed & Weighted Registry Connections

**Date:** 2026-06-20  
**Module:** `concept-registry/connection-*`, vault graph adapter, DPP epistemic graph

---

## 1. What we built

Cross-document concept links in the global registry now carry an explicit relationship type (prerequisite, contradicts, exemplifies, part-of, or associated) and a weight in `[0.05, 1.0]` that reflects demonstrated recall, not LLM confidence alone. Types are assigned during the existing DPP epistemic-graph LLM call via a `registry_type` enum field; weights start at `0.3`, increase by `+0.15` when a correct response involves both endpoint concepts, and decay lazily on graph read after 30 days of neglect. Document-local `shared.conceptGraph` edges are unchanged—only registry-level connections are typed and weighted. The vault graph renders type via stroke style/color and weight via thickness/opacity.

---

## 2. Design decisions

### Registry `connections[]` vs extending `relatedConceptIds`

**Chosen:** A dedicated `ConceptRegistry.connections` array of directed `{ sourceId, targetId, type, weight, evidence }` objects.

**Alternatives:** Reuse per-concept `relatedConceptIds` (identity-resolution hints only today) or vault `prerequisites` (Knowledge Vault entry model, separate storage).

**Why discarded:** `relatedConceptIds` is undirected and untyped; vault prerequisites are document-scoped mastery entries, not cross-doc registry edges. A first-class connection list keeps direction, type, and evidence in one place without migrating vault rows.

**Trade-off:** Two graph edge sources in vault UI (registry connections + legacy co-occurrence/explicit-link heuristics) until co-occurrence is retired.

### Pair reinforcement from response concept sets, not `assessmentSignals`

**Chosen:** At MCQ/recall submit time, collect `concept_ids` for that response, map to global IDs, call `reinforceConnectionsForConcepts` fire-and-forget.

**Alternatives:** Extend `assessmentSignals` with pair co-occurrence fields; scan all signals on session close.

**Why discarded:** `assessmentSignals` is per-concept aggregated (`mergeAssessmentSignals` keys on `canonicalId`). Adding pairs would complicate merge semantics and every consumer. Session-close batching would miss real-time graph updates and couple reinforcement to vault close.

**Trade-off:** Reinforcement only fires on paths wired through `ingest.js` (MCQ block + recall today; cloze single-concept path does not reinforce pairs unless extended).

### Same LLM call for typing (`registry_type` on epistemic edges)

**Chosen:** Add `registry_type` to the Phase 0 / T1.3 JSON schema in `generateEpistemicGraph`; map epistemic `type` + `registry_type` to the five-value enum at promotion.

**Alternatives:** Separate “classify this edge” LLM pass; infer type only from free-text epistemic `type`.

**Why discarded:** Spec forbids extra LLM round trips (G3/R10). Free-text cloze types (`implies`, `causes`, …) do not align 1:1 with registry enum without an explicit field or brittle mapping table.

**Trade-off:** LLM may omit or mis-set `registry_type`; `mapEpistemicTypeToRegistry` falls back to epistemic `type` string then `ASSOCIATED`.

### Lazy read-time decay (no background job)

**Chosen:** `getConnectionsForGraph()` normalizes, applies decay if `now - lastReinforcedAt > 30 days`, persists when changed.

**Alternatives:** Cron/interval job; decay only on reinforcement write.

**Why discarded:** PWA has no reliable background worker; write-only decay never weakens edges the user never revisits.

**Trade-off:** Decay runs only when the vault graph is opened; stale weights linger until next read. One-shot decrement per stale read (not continuous exponential decay).

### Yellow+ promotion gate

**Chosen:** `upsertRegistryConnection` no-ops unless both endpoints exist with `maturity` yellow or green.

**Alternatives:** Promote at graph build time regardless of maturity; promote only at green.

**Why discarded:** Spec R7 requires both endpoints engaged (yellow+) before registry typed edges exist. Gray inventory-only concepts should not create cross-doc commitments.

**Trade-off:** Edges from DPP T1.3 may exist in `conceptGraph` long before promotion; `onConceptEngagement` re-scans the document graph after each engagement.

### Fire-and-forget reinforcement

**Chosen:** `reinforceConnectionsFireAndForget` wraps `Promise.resolve().then(...).catch(console.warn)`.

**Alternatives:** Await reinforcement in study submit handlers; queue with retry UI.

**Why discarded:** Spec G4 mirrors LLM usage logging R1—study flow must never block on connection writes.

**Trade-off:** Silent data loss if localStorage fails; acceptable per spec.

---

## 3. Concepts applied

| Concept | Where it appears |
|--------|------------------|
| **Additive schema migration** | `registry-store.js`: `connections: []` on load when absent; `REGISTRY_SCHEMA_VERSION = 2`; `normalizeConnection` supplies defaults for legacy rows (R8). |
| **Closed enum / coercion** | `connection-types.js`: `CONNECTION_TYPES`, `coerceRegistryConnectionType`, `VALID_TYPES` set. |
| **Normalization layer** | `connection-types.js`: `normalizeConnection`, `normalizeConnections` dedupe by `sourceId\|targetId`. |
| **Strategy / mapping table** | `EPISTEMIC_TO_REGISTRY` maps cloze epistemic vocabulary → registry enum. |
| **Lazy evaluation + write-through cache** | `getConnectionsForGraph()` reads, decays, persists if `changed`. |
| **Fire-and-forget async** | `reinforceConnectionsFireAndForget` in `connection-store.js`; called from `ingest.js`. |
| **Adapter pattern** | `vault-graph-adapter.js` projects registry connections into graph `{ source, target, type, weight }`; `graph-mount.js` maps to canvas `{ from, to, type, weight }`. |
| **Presentation encoding** | `canvas.js`: `EDGE_DASH_SOLID` / `EDGE_DASH_HEAVY`, `weightStrokeScale` maps weight → SVG stroke-width and opacity. |
| **Promotion pipeline hook** | `connection-promotion.js` + DPP T13 + `onConceptEngagement` re-scan. |
| **Integration tests (Node + jsdom storage)** | `cursor-tests/20260620_typed-weighted-connections.mjs` |

---

## 4. Technical debt and improvements

**Well done**

- Pure normalize/map/reinforce/decay functions are testable without DOM.
- Legacy registry loads without migration script.
- Reinforcement isolated from study critical path.
- Co-occurrence edges suppressed when a registry connection exists for the same pair.

**Functional duct tape**

- `registry-store.js` has `import` after `export const` — valid ESM but unconventional; should move import to top.
- Promotion re-scans entire document graph on every `onConceptEngagement` — O(edges × engagements) with no fingerprint.
- MCQ reinforcement uses inventory `globalConceptId` map but falls back to raw local IDs if unmapped — may miss or mis-target edges.
- Cloze correct answers do not call pair reinforcement (single `conceptId` path only).
- Decay updates `lastReinforcedAt` to `now` when applying decay, which resets the decay clock rather than tracking `lastDecayedAt` separately.

**Would not scale**

- `addExplicitLinkEdges` still does O(n²) content substring matching across all concepts.
- No index on connections by endpoint; reinforcement scans full `connections[]` each time.
- Directed edges only — mutual relationships require two rows or future undirected type.
- No user-facing connection list/edit; debugging requires localStorage inspection.

---

## 5. Consolidation questions

1. When DPP T1.3 runs before T1.6 vault linking, which edges promote immediately vs on later `onConceptEngagement`, and what happens if `globalConceptId` is backfilled out of order?

2. Why was pair reinforcement implemented at the ingest layer with global ID resolution instead of extending `assessmentSignals`, and which study modes are still missing that hook?

3. How does lazy decay interact with reinforcement timestamps — after decay fires once, does updating `lastReinforcedAt` to `now` prevent repeated decay until the next reinforcement + 30 days, and is that the intended semantics?

---

## 6. Suggested update for .cursorrules

1. **Registry connections are user-evidence weighted, not LLM-weighted:** New registry-level concept edges MUST initialize at weight `0.3`; only correct multi-concept retrieval may increase weight. Never set connection weight from LLM confidence scores.

2. **No extra LLM calls for connection typing:** Relationship `type` MUST be emitted in the same structured JSON call that proposes the edge (e.g. `registry_type` on epistemic graph edges). Do not add a classify-edge pass.

3. **Connection side effects are fire-and-forget:** Weight reinforcement and decay persistence MUST NOT block recall, cloze, review, or MCQ submission paths — wrap in `.catch()` and log only.
