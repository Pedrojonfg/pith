# Research: Global Knowledge Vault (Post A+)

**Feature**: `20260619-knowledge-vault-post-a-plus`

## R1 — Manual merge semantics

**Decision**: `mergeVaultEntries(survivorId, mergedId)` reassigns aliases (includes merged canonical title), concatenates observations (cap 500/entry with FIFO trim), unions sources/prerequisites/dependents (deduped), updates inverse dependent links, deletes merged entry.

**Rationale**: Matches user expectation of "these are the same concept"; preserves audit trail via observations.

**Alternatives considered**: Soft-delete merged entry — rejected (complicates all reads); re-run LLM merge — rejected (cost, non-deterministic).

## R2 — External import default mastery

**Decision**: Self-declared imports default `masteryBase` 0.7; document "already known" import defaults 0.8; CSV/JSON allows per-row override.

**Rationale**: Aligns with spec-post-a-plus; high enough to skip scaffolding, low enough to allow contradiction signals.

**Alternatives considered**: 1.0 default — rejected (no room for contradiction learning); 0.5 — rejected (insufficient skip benefit).

## R3 — Misconception detection threshold

**Decision**: Minimum 3 `mcq_wrong` or `socratic_partial` observations on same entry within 30 days sharing same `wrongAnswer` or LLM-clustered pattern; one optional LLM call at session-close.

**Rationale**: Balances false positives vs. detection latency per spec FR-302.

**Alternatives considered**: 2 observations — rejected (too noisy); continuous LLM on every wrong — rejected (cost).

## R4 — Declarative vs procedural routing

**Decision**: Map observation types: `mcq_correct/wrong` + textual MCQ → declarative; calculation/application MCQ + socratic problem-solving → procedural; cloze definition → declarative; weighted overall `0.4 * declarative + 0.6 * procedural`.

**Rationale**: Literature-weighted per spec-post-a-plus Block 4a.

**Alternatives considered**: Single mastery only — rejected (regression vs. spec); user-tagged — rejected (UX burden).

## R5 — BKT activation gate

**Decision**: Per-entry `useBkt: true` only when `observations.length >= 15`; store BKT params `{ pL0, pT, pG, pS }` with defaults; fall back to weighted average below threshold.

**Rationale**: Spec explicitly warns BKT worse with sparse data.

**Alternatives considered**: Global BKT switch — rejected; always BKT — rejected.

## R6 — Prerequisite cycle resolution

**Decision**: On `addPrerequisite(from, to)`, run DFS cycle detect; if cycle, convert pair to `coPrerequisites: string[][]` stored on both entries and remove conflicting one-way edge.

**Rationale**: Preserves both relationships as "teach together" per spec Block 5a.

**Alternatives considered**: Drop newer edge — rejected (loses doc evidence); warn only — rejected (invalid graph breaks topo sort).

## R7 — LLM cross-document prerequisite inference

**Decision**: Trigger after 5th document sharing a topic tag; batch up to 80 entries/topic; output `{ from, to, confidence }`; auto-add edges with confidence ≥ 0.85, queue others for debug UI review.

**Rationale**: Limits cost; high-confidence auto reduces manual work.

**Alternatives considered**: Every session-close — rejected (cost); manual only — rejected (does not scale).

## R8 — Topological importance for review

**Decision**: `importanceScore = dependents.length + 0.5 * coPrerequisitePartners`; multiply review urgency by `1 + importanceScore/10`.

**Rationale**: Simple, explainable centrality without full PageRank for v1.

**Alternatives considered**: PageRank — deferred (complexity); mastery-only — rejected (ignores graph structure).

## R9 — Vault graph UI adapter

**Decision**: Reuse `graph/view.js` with `buildVaultGraph(vault)` producing nodes `{ id, label, type: 'vault_concept', mastery }` and edges `{ from, to, type: 'prerequisite' | 'co_prerequisite' }`.

**Rationale**: Existing canvas infrastructure per spec-post-a-plus Block 6.

**Alternatives considered**: New D3 dependency — rejected (framework rule); list-only — rejected (spec FR-601).

## R10 — Spaced review integration

**Decision**: Nightly/on-mode-select hook: entries with `getCurrentMastery(e) < 0.5` → push/update `shared.smItems` with `vaultEntryId`, `priority = decaySeverity * importanceScore`; reuse existing SM scheduler in `session-store.js`.

**Rationale**: Minimal new SM code; spec Block 7 depends on SM v1 hardening first.

**Alternatives considered**: Separate review store — rejected (duplication); FSRS rewrite — out of scope.

## R11 — Multi-device sync (deferred)

**Decision**: Document only; per-entry LWW with `updatedAt` + `deviceId` when backend ships.

**Rationale**: Block 8 tied to general backend roadmap.

**Alternatives considered**: CRDT full vault — rejected (overkill v1).

## R12 — Collaborative filtering (deferred)

**Decision**: Document only; anonymized aggregate difficulty priors per concept fingerprint hash.

**Rationale**: Requires user mass and privacy review.

**Alternatives considered**: On-device federated — deferred (complexity).
