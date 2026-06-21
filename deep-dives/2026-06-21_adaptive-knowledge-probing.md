# Deep Dive: Adaptive Knowledge Probing Engine

**Date**: 2026-06-21  
**Feature**: `20260630-adaptive-knowledge-probing`  
**Spec**: `specs/20260630-adaptive-knowledge-probing/spec.md`

---

## 1. What we built

An **adaptive probe-selection and belief-propagation layer** sits between the concept vault graph and the existing pre-packing assessment pipeline. Before any LLM question generation runs, pure JavaScript picks the N concepts that maximize expected information gain (EIG) along `PREREQUISITE` edges; after each answer, beliefs update locally with asymmetric Bayesian propagation. The same engine surfaces a **knowledge frontier** (“ready to learn next” / “recently solidified”) on the vault branch from project-scoped Supabase state. No new LLM calls — same question budget, smarter targeting.

---

## 2. Design decisions

### 2.1 Insert before holistic coverage plan, not replace generation

**Chosen**: `buildAdaptiveCoveragePlan` filters the concept subset, then delegates to existing `buildAssessmentCoveragePlan` / `generateHolisticPrePackingAssessmentItems`.

**Alternatives**: Per-probe LLM round-trips; rewrite assessment prompts to accept EIG scores.

**Trade-off**: Map-reduce batching and prefetch keys stay intact, but adaptive selection is constrained by whatever the coverage plan does with the filtered inventory (section batching still applies).

### 2.2 PREREQUISITE-only probe DAG with deterministic cycle break

**Chosen**: Filter `shared.conceptGraph` to `PREREQUISITE` edges; DFS cycle detection; drop lowest-weight edge; log to `probe_graph_warnings`.

**Alternatives**: Treat all edge types with reduced weights; abort assessment on cycles.

**Trade-off**: Cross-document merges can introduce cycles — silent break is safer than non-terminating propagation, but dropped edges are a data-quality signal users never see unless curation tooling is added later.

### 2.3 Flat fallback when graph is empty

**Chosen**: `propagationEnabled: false` → EIG over independent nodes; assessment never blocks.

**Alternatives**: Require concept graph before assessment; infer edges from inventory only.

**Trade-off**: Documents without DPP graph completion get selection quality similar to random/heuristic, not worse.

### 2.4 Session beliefs ephemeral; project beliefs max-merge

**Chosen**: `shared.knowledgeBeliefState` per assessment session; `vault_belief_state` upsert with `max(existing, incoming)`.

**Alternatives**: Single global belief store; overwrite on every assessment.

**Trade-off**: “Knowledge only upgrades” avoids erasing prior mastery without an explicit “forgotten” signal — stale high beliefs can persist incorrectly.

### 2.5 Sibling redundancy in batch selection

**Chosen**: After simulating a probe, nodes sharing the same prerequisite set get a +0.72 belief lift so near-duplicate siblings are not both selected.

**Alternatives**: Explicit PART_OF / ASSOCIATED propagation; graph clustering.

**Trade-off**: Heuristic correlation, not principled inference — tuned to pass diversity tests, not calibrated on real sessions.

### 2.6 Asymmetric propagation damping

**Chosen**: Missed prerequisite → dependents pushed toward 0.04 with `DOWNWARD_PROPAGATION_DAMPING` (0.8); knew dependent → prerequisites lifted mildly with `UPWARD_PROPAGATION_DAMPING` (0.55× on target 0.72).

**Alternatives**: Symmetric Pearl belief propagation; log-odds full junction tree.

**Trade-off**: Constants are starting points (spec §10); wrong tuning will mis-rank probes and mis-pack blocks without user-visible errors.

---

## 3. Concepts applied

| Concept | What it is | Where in our code |
|--------|------------|-------------------|
| **DAG construction** | Directed acyclic graph from prerequisite edges | `probe-graph.js` — `buildProbeGraph`, `findCycles`, `breakCycles` |
| **DFS cycle detection** | Back-edge detection on directed graph | `probe-graph.js` — `findCycles` |
| **Binary entropy** | \(H(p) = -p\log_2 p - (1-p)\log_2(1-p)\) | `belief-propagation.js` — `binaryEntropy` |
| **Expected information gain** | Expected reduction in total graph entropy under probe outcomes | `eig-selection.js` — `expectedInformationGain`, `nextProbe` |
| **Greedy batch selection with simulation** | Pick top EIG, simulate state, repeat | `eig-selection.js` — `nextProbeBatch` |
| **Belief propagation (approximate)** | Local message passing with hop limit and damping | `belief-propagation.js` — `propagateFromNode`, `updateBeliefs` |
| **Prior seeding** | Initial beliefs from categorical maturity | `belief-state.js` — `priorBeliefForMaturity`, `initializeBeliefState` |
| **Threshold gating** | Skip probes when belief already extreme | `belief-state.js` — `isProbeCandidate` |
| **Frontier set extraction** | Nodes ready when prereqs mastered but self not | `knowledge-fringe.js` — `computeFringes` |
| **Optimistic merge (max)** | Monotonic knowledge upgrade across sessions | `belief-persist.js` — `mergeSessionBeliefs` |
| **Feature flag rollback** | Master switch restores legacy selection path | `flags.js` — `isAdaptiveProbingEnabled`; `assessment-integration.js` passthrough |
| **Adapter / facade** | Thin integration without forking LLM APIs | `assessment-integration.js` — `buildAdaptiveCoveragePlan` |

---

## 4. Technical debt and improvements

**Well done**
- Pure algorithm module under `src/js/adaptive-probing/` — testable without browser or LLM.
- Preserves `ASSESSMENT_PARALLEL_PACKING` contract (full batch precomputed).
- Graceful degradation when graph missing; Supabase persist failures are logged, not blocking.
- Seven focused cursor-tests cover cycle break, EIG correctness, diversity, asymmetry, hop limit, fringe, parallel contract.

**Functional duct tape**
- Sibling redundancy (+0.72) is a blunt instrument — not derived from the graph model.
- `renderVaultKnowledgeFringe` builds a trivial graph from belief keys only — no cross-document prerequisite context for frontier display.
- Propagation uses direct belief damping, not log-odds; multi-path nodes double-count evidence.
- `ADAPTIVE_PROBING_EARLY_STOP` flag exists but is not wired in `study.js`.
- Flags landed in the vault-embedding commit before the module existed — organizational smell, not runtime bug.

**Would not scale**
- EIG recomputes full-graph entropy per candidate — O(n²) per probe; fine for ~200 nodes, painful at thousands without incremental entropy or candidate pruning.
- `mergeSessionBeliefs` upserts row-by-row concept set — large projects need batch RPC.
- No UI for `probe_graph_warnings` — cycle breaks are invisible to users.
- Belief state in session JSON grows with inventory size; no compaction.

---

## 5. Consolidation questions

1. **When holistic assessment is enabled, exactly which concept IDs reach the LLM** — walk from `buildAdaptiveCoveragePlan` → filtered inventory → `buildAssessmentCoveragePlan` batches and explain why a concept might still get a question even if EIG ranked it low (hint: section batching and edge quotas).

2. **Why does upward propagation use weaker damping than downward**, and what user-visible mistake happens if you swap `UPWARD_PROPAGATION_DAMPING` and `DOWNWARD_PROPAGATION_DAMPING`?

3. **What happens to probe selection and belief persistence** if `shared.conceptGraph` is null, if a PREREQUISITE cycle exists, and if the user sets `ADAPTIVE_PROBING_ENABLED: false` mid-session after `knowledgeBeliefState` was already written?

---

## 6. Suggested update for .cursorrules

1. **Adaptive probing is selection-only** — Never add LLM calls to EIG/propagation/fringe paths; probing changes *which* concept IDs enter existing assessment generation, not how questions are phrased.

2. **Probe graph must be acyclic before propagation** — Any code building belief message passing on `PREREQUISITE` edges must run cycle detection first; log breaks to `probe_graph_warnings`, never silent infinite loops.

3. **Pre-packing batch must be fully known before parallel packing starts** — Adaptive selection must precompute the full probe batch synchronously; per-answer LLM fetches break `ASSESSMENT_PARALLEL_PACKING`.
