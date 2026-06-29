# Implementation Plan: Fix DPP Tier Scheduling & Tier-2 Robustness

**Branch**: `fix-dpp-tier-scheduling` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

## Summary

Realign DPP phase dependencies and `phasesForStopTier(1)` with the gate artifact contract; harden Slow Phase 0 map-reduce with inventory-style retry/bisect; soften Cloze T2.1 to `partial` degradation with diagnostic logs.

## Technical Context

**Language**: JavaScript ES modules (browser PWA)  
**Primary modules**: `document-preparation.js`, `slow/phase0.js`, `cloze/pipeline.js`, `study.js`  
**Testing**: `cursor-tests/*.mjs` (Node)  
**Constraints**: PWA SW bump on `src/js/**` changes; LLM `max_tokens` named constants

## Constitution Check

- LLM JSON outputs >20 fields: explicit `max_tokens` with comment ✓
- Parse failure categories: TRUNCATED vs PARSE_ERROR ✓
- No localStorage wipe in update flows ✓

## Project Structure

```text
src/js/document-preparation.js   # PHASE_DEPS, phasesForStopTier, deferred kickoff, T2.1
src/js/slow/phase0.js            # mapReducePhase0 resilience
src/js/cloze/pipeline.js         # diagnostic logs
cursor-tests/20260707_fix-dpp-tier-scheduling.mjs
```

## Implementation

### 1. Scheduling (`document-preparation.js`)

- Add `TIER1_GATE_PHASES` set: T0.1, T0.2, T1.1, T1.2, T1.4, T1.5
- Add `TIER1_DEFERRED_PHASES`: T1.3, T1.6, T1.7, T1.8, T1.9
- Update `PHASE_DEPS["T2.3"]` → `["T1.2", "T1.4", "T1.5"]`
- `phasesForStopTier(1)` → gate phases only
- `phasesForStopTier(2)` → gate + deferred + tier2
- Export `kickoffDeferredTier1AndTier2InBackground` replacing tier2-only kickoff path in `study.js`
- `allTier1PhasesComplete` for stopAfterTier 1 checks gate phases only

### 2. Phase 0 (`slow/phase0.js`)

- `PHASE0_CHUNK_MAX_TOKENS = 3072` with comment
- `callPhase0PartialChunkWithRetry` wrapper: detect truncation via `looksLikeTruncatedModelJson`, retry terse, bisect at depth≤2
- Export `buildWaves` test helper or export `PHASE_DEPS` for tests from document-preparation

### 3. Cloze (`document-preparation.js` runPhaseT21)

- Log counts after pipeline
- On zero valid: `markPhase` partial/skipped, set `modes.cloze.pipelineStatus: degraded`, no throw

### 4. Tests + SW

- Pure tests for wave order, gate phase list, phase0 bisect helper
- SW bump

## Research

See [research.md](./research.md)
