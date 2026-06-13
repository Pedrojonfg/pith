# Research: Global Knowledge Vault (Phase A+)

**Feature**: `20260618-knowledge-vault-a-plus`  
**Date**: 2026-06-13  
**Source**: `spec-a-plus.md` + dependency specs

## Decision 1: Session-close batch update vs. real-time

**Decision**: Update vault only on session close (`onSessionClose`), not during study.

**Rationale**: Avoids latency on critical study path; batches one normalization LLM call per session; matches user mental model of "saving progress."

**Alternatives considered**:
- Real-time after each answer — rejected: too many writes and possible normalization churn.
- Daily background job — rejected: no service worker schedule in A+ scope.

## Decision 2: Mastery model — exponential decay EMA

**Decision**: Store `masteryBase` + `masteryLastUpdated`; on read apply `masteryBase * exp(-λ * days)`; on write apply decay then `decayed + α * signal`, clamp [0,1]. Constants: `ALPHA=0.3`, `LAMBDA=0.05`.

**Rationale**: Simple, deterministic, testable without LLM; decay addresses forgetting; signal weights rank retrieval effort (cloze > socratic > assessment > MCQ).

**Alternatives considered**:
- BKT — deferred post-A+ (FR-012 out of scope).
- Plain running average — rejected: no forgetting over time.

## Decision 3: Concept deduplication via bounded LLM normalization

**Decision**: One `normalizeConceptsToVault()` call per session close, input filtered by document topic tags vs. vault entry topics (flexible substring match).

**Rationale**: Heuristic title match insufficient for aliases ("chain rule" vs "derivación compuesta"); LLM cost bounded by topic filter (<50 existing + <30 new typical).

**Alternatives considered**:
- Embeddings-only dedup — rejected: adds dependency and offline complexity.
- Exact string match only — rejected: fails cross-language aliases.

## Decision 4: Topic tags from existing hierarchy LLM call

**Decision**: Extend `buildDocumentHierarchy()` JSON output with `topics: string[]` (2–5 tags); persist as `shared.docTopics`.

**Rationale**: Zero extra LLM round-trip; hierarchy call already reads full document.

**Alternatives considered**:
- Separate topic LLM call — rejected: unnecessary cost.
- User-entered tags — rejected: friction; out of A+ UX.

## Decision 5: Prerequisite elevation without cycle resolution

**Decision**: Copy `prerequisite_ids` from concept inventory through normalization map into vault entry edges; allow cycles; ignore heuristically in prompts.

**Rationale**: Cross-document graph emerges free from RSVP inventory; cycle resolution is hard and deferred.

**Alternatives considered**:
- LLM inference of prerequisites — rejected: cost and inconsistency.
- Topological sort enforcement — deferred post-A+.

## Decision 6: Storage split at ~300KB

**Decision**: Primary key holds metadata; overflow to `pith_knowledge_vault_data` following large-session pattern.

**Rationale**: localStorage 5MB limit; 800–1000 concepts estimated at threshold.

**Alternatives considered**:
- IndexedDB — rejected: new storage abstraction for A+.
- Cap and LRU evict — rejected: loses calibration value silently.

## Decision 7: Assessment integration — presumed known at mastery ≥ 0.7

**Decision**: Pre-fill assessment UI with check icon for vault concepts ≥0.7 current mastery; user can contradict; contradiction becomes observation.

**Rationale**: Complements per-doc assessment without replacing it; threshold aligns with "acquired/mastered" band boundary.

**Alternatives considered**:
- Skip assessment entirely if vault full — rejected: violates per-doc layer requirement.
- Hide vault from user — rejected: no trust/transparency.

## Decision 8: Debug UI as sole A+ user surface

**Decision**: Settings → Knowledge Vault panel with table, filter, detail, clear, export; no manual edit.

**Rationale**: Required to validate SC-001/SC-002; full graph UI deferred.

**Alternatives considered**:
- No UI until post-A+ — rejected: impossible to QA.
- Inline study HUD — rejected: scope creep.

## Signal weight table (canonical)

| Observation type | rawSignal |
|------------------|-----------|
| cloze_correct | +1.0 |
| socratic_passed | +0.85 |
| assessment_mastered | +0.75 |
| mcq_correct | +0.6 |
| socratic_partial | +0.2 |
| assessment_partial | +0.1 |
| mcq_wrong | -0.3 |
| cloze_wrong | -0.5 |
| assessment_unknown | -0.1 |

## Mastery bands

| Range | Label |
|-------|-------|
| 0.0 – 0.29 | unknown |
| 0.30 – 0.59 | partial |
| 0.60 – 0.79 | acquired |
| 0.80 – 1.0 | mastered |
