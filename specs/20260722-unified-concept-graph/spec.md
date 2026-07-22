# Feature Specification: Unified Concept Graph

**Feature Branch**: `20260722-unified-concept-graph`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "Unified Concept Graph (merge conceptInventory + conceptGraph) and edge-weighted block packing" — source `spec-unifcg.md`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Single canonical concept identity (Priority: P1)

A learner uploads a document and the system prepares study material. Concepts extracted for inventory, graph view, and Cloze share one identity — the same real-world idea is not listed twice under different labels or ids.

**Why this priority**: Duplicate extraction causes identity drift and wasted work; every downstream consumer needs one canonical node.

**Independent Test**: After document preparation through the graph phase, the concept list used for packing/vault and the graph node list are the same set of concept ids (one generation step for nodes).

**Acceptance Scenarios**:

1. **Given** a document with concepts ready in inventory, **When** the graph/relations phase runs, **Then** graph nodes are exactly those inventory concepts (same ids), and edges only connect existing concept ids.
2. **Given** inventory is empty or missing, **When** the graph/relations phase would run, **Then** the phase is skipped (or records empty edges) without inventing concepts.
3. **Given** the LLM proposes an edge to an unknown concept id, **When** edges are validated, **Then** that edge is dropped and the phase still succeeds with the remaining valid edges.

---

### User Story 2 - Graph and Cloze consume the shared graph (Priority: P1)

A learner opens the concept graph view or starts Cloze on a prepared document. Both use the shared concept graph from preparation — Cloze does not regenerate a separate concept graph over the same text.

**Why this priority**: Second independent graph generation is the main source of cost and drift; Cloze and the graph screens must read one artifact.

**Independent Test**: Cloze item generation and graph rendering run successfully using only the shared concept graph produced in preparation; no second full concept-extraction call for the same document.

**Acceptance Scenarios**:

1. **Given** a document whose shared concept graph already has nodes and edges, **When** Cloze preparation runs, **Then** it consumes that graph and does not overwrite it with a freshly extracted concept set.
2. **Given** a shared concept graph with inventory-shaped nodes (`label`, etc.), **When** the learner opens the graph view, **Then** nodes and edges render without requiring the old graph-only field names (e.g. `text` instead of `label`).
3. **Given** a shared concept graph with nodes but zero edges (degraded preparation), **When** Cloze or packing proceeds, **Then** the flow continues without throwing.

---

### User Story 3 - Prerequisite-aware, affinity-aware block packing (Priority: P2)

When the system recommends how to split concepts into study blocks, prerequisite relations influence block order, and strong affinity relations bias which concepts share a block — without replacing the existing block-count decision.

**Why this priority**: Improves pedagogical sequencing; riskier because it changes RSVP/Questions block boundaries.

**Independent Test**: With a fixed inventory and fixed edge set (mocked), packing respects prerequisite ordering as a repair constraint and tends to keep high-affinity pairs together when size allows.

**Acceptance Scenarios**:

1. **Given** concept A is a prerequisite of concept B, **When** blocks are ordered, **Then** the block that first substantially treats A is not scheduled after the block that first substantially treats B (prerequisite wins over prior order when they conflict).
2. **Given** two concepts linked by a strong affinity relation (e.g. part-of) and both fit in the configured max block size, **When** concepts are grouped, **Then** packing prefers keeping them in the same block over splitting them arbitrarily.
3. **Given** edge-weight constants are configured, **When** packing scores structural importance, **Then** affinity weights may nudge importance within a small bounded bonus; ordering weights do not feed importance scoring.

---

### Edge Cases

- Inventory present but LLM relation call fails entirely → graph stored as nodes + empty edges (degraded, usable).
- LLM invents new concept ids in edges → those edges dropped; phase does not fail hard.
- Old persisted sessions with legacy graph shape → treated as stale; next preparation regenerates (no migration required).
- Unmapped relation types in weight tables → default ordering 0 / affinity 0.1 with a visible warning, not silent ignore.
- Empty edge list → packing and Cloze behave as today for inventory-only (no crash).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST produce a single shared concept graph whose nodes are the document's concept inventory entries (superset of current inventory fields; no inventory field currently relied upon by packing, vault linking, novelty, or similarity MAY be dropped).
- **FR-002**: System MUST generate graph edges in a phase that depends on inventory completion, receiving the fixed concept id/label/definition list and proposing only relations between those ids (no new entity invention).
- **FR-003**: System MUST validate edges against known relation types and drop edges whose endpoints are not in the inventory id set, without failing the phase for such noise.
- **FR-004**: On total relation-generation failure, System MUST persist nodes with an empty edge list and allow downstream packing and Cloze to continue.
- **FR-005**: Cloze MUST consume the shared concept graph from preparation and MUST NOT regenerate a parallel full concept extraction for the same document.
- **FR-006**: Graph view adapters MUST read unified node field names (inventory `label` as display label) so rendering continues to work.
- **FR-007**: Registry promotion from the graph MUST use unified node fields (not legacy graph-only names such as `text` where inventory uses `label`).
- **FR-008**: Block packing MUST treat edges as two signals: ordering (prerequisite-led sequencing repair) and affinity (grouping / tie-break), using configurable per-type weights for all known relation types.
- **FR-009**: Block packing MUST NOT let structural affinity bonus override LLM importance beyond a small configurable scale (ordering weights MUST NOT affect importance).
- **FR-010**: System MUST NOT implement practice-ontology, new Vault entry types, session migration of legacy graph shape, or unrelated RSVP/Questions UI / SM-2 changes as part of this feature.
- **FR-011**: All call sites that previously regenerated the epistemic concept graph for a prepared document MUST read the shared concept graph instead (except the single preparation phase that creates edges).

### Key Entities

- **ConceptNode**: Canonical study concept — identity, label, definition, importance, question class, aliases, optional global id, optional graph metadata (semantic cluster, node type).
- **ConceptEdge**: Typed relation between two ConceptNode ids (relation type, optional registry type, optional sentence context).
- **ConceptGraph**: Container of nodes + edges; nodes are the inventory set (same identity as `shared.conceptInventory` within a preparation run).
- **Edge weight tables**: Configurable ordering and affinity weights keyed by relation type, plus structural bonus scale.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a prepared document, concept identity used by packing/vault consumers and by the graph view is one set of concept ids (no second independent concept extraction for nodes).
- **SC-002**: Relation generation never introduces concepts that are not already in inventory; invalid edge endpoints are discarded and preparation still completes.
- **SC-003**: Cloze study on a prepared document runs without a second full concept-graph extraction call for that document.
- **SC-004**: With prerequisite edges present, packed block order does not place a dependent concept's first substantial block before its prerequisite's first substantial block.
- **SC-005**: Affinity-linked concept pairs that fit within max block size are not split solely by importance tie-breaking when affinity weights prefer co-location (property-based check, not exact layout snapshot).
- **SC-006**: Edge weight constants are tunable in one configuration location without hunting through packing logic.

## Assumptions

- Open questions in the source design (`spec-unifcg.md` §2) are resolved by repo inspection during planning/research before code lands; reasonable defaults if ambiguous: keep `shared.conceptInventory` as source of truth and set `shared.conceptGraph.nodes` to the same array reference within a run; prefer updating call sites to `label` over a long-lived dual-field compatibility layer when few call sites remain.
- No real end-user migration of old graph shapes is required (testing-phase product).
- Practice ontology and Vault type changes remain out of scope.
- Existing Cloze relation-type and registry-type enums are reused; weights cover every enum value with defaults for gaps.
- Tier-1 gate set does not include T1.3; making T1.3 depend on T1.2 only changes wave ordering, not the gate membership.
- Source design document: `spec-unifcg.md` at repo root (implementation detail reference for plan/tasks; this spec is the Speckit authority for WHAT/WHY).

## Out of Scope

- Practice ontology / PKST-style problem-solving graphs
- New Vault entry types
- Migrating persisted legacy graph shapes
- Changing vault linking, novelty, similarity algorithms beyond adapting to inventory/graph location
- RSVP/Questions UI, socratic/test screens, SM-2 behavior
- Redesigning canvas edge colors / EDGE_TYPES beyond what is required for renderers to keep working
- Deriving graph `layer` from `nodeType` (keep default `"concept"`)
