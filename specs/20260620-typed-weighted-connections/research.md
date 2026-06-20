# Research: Typed & Weighted Concept Connections

**Feature**: `20260620-typed-weighted-connections` | **Date**: 2026-06-20

## Q1 — assessmentSignals pair granularity

**Decision**: Use per-response concept ID sets at reinforcement time; do not extend `assessmentSignals` with pair fields.

**Rationale**: `assessmentSignals` aggregates per-concept (`canonicalId`, counts, `lastResult`). Recall already exposes `concept_ids[]` on questions; `buildRecallAssessmentSignals` emits one signal per ID. Reinforcement hook reads the same response's concept set and reinforces all endpoint pairs—no persisted pair index required.

**Alternatives considered**: Adding `coOccurredWith: string[]` on each signal—rejected as redundant and harder to merge.

## Q2 — Current edge shape from graph generation

**Decision**: DPP T1.3 (`generateEpistemicGraph` in `cloze/pipeline.js`) emits edges with free-text `type` (`prerequisite_of`, `contradicts`, `exemplifies`, `part_of`, etc.). Add parallel `registry_type` enum field to the same JSON schema and map at promotion.

**Rationale**: Satisfies G3 (same LLM call) without replacing cloze-internal edge vocabulary.

**Alternatives considered**: Replacing cloze edge types with registry enum—rejected; breaks cloze pipeline prompts.

## Q3 — Promotion hook location

**Decision**: New `connection-promotion.js` called from `document-preparation.js` after T1.3 (graph ready) and from `promotion.js` `onConceptEngagement` when a concept newly reaches yellow+ (re-scan document graph edges for promotable pairs).

**Rationale**: Keeps promotion and typing in one pass; re-scan handles late yellow promotion.

**Alternatives considered**: Separate T1.7 DPP phase—acceptable but adds orchestration; deferred to single module invoked from existing hooks.

## Epistemic → registry type mapping

| Epistemic `type` / `registry_type` | Registry `type` |
|-----------------------------------|-----------------|
| `prerequisite_of`, `PREREQUISITE` | `PREREQUISITE` |
| `contradicts`, `CONTRADICTS` | `CONTRADICTS` |
| `exemplifies`, `is_a`, `defines`, `EXEMPLIFIES` | `EXEMPLIFIES` |
| `part_of`, `PART_OF` | `PART_OF` |
| other / missing | `ASSOCIATED` |

## Fire-and-forget pattern

**Decision**: `reinforceConnectionsForConcepts(ids).catch(() => {})` at submission sites; log warnings only.

**Rationale**: Matches vault/session-close non-blocking observation writes.
