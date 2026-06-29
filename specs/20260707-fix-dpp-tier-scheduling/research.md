# Research: Fix DPP Tier Scheduling

## R1: Root cause T2.3 in wave 3

**Decision**: `PHASE_DEPS["T2.3"] = ["T1.1"]` allows wave builder to schedule T2.3 with T1.2.  
**Rationale**: Topological sort only checks direct deps; T2.3 does not depend on T1.2.  
**Fix**: Add gate deps T1.2, T1.4, T1.5.

## R2: Early gate vs full Tier 1

**Decision**: Split gate vs deferred Tier-1 phases; `stopAfterTier: 1` runs gate only.  
**Rationale**: `hasTier1Artifacts` ignores T1.3/T1.6–T1.9; user waits unnecessarily.  
**Alternatives**: Keep full tier1 but show UI earlier — rejected (pipeline still blocks finalize).

## R3: Phase 0 failure mode

**Decision**: Mirror inventory chunk retry + bisect; 3072 tokens for partial chunks.  
**Rationale**: Section 1 of 187k doc hits 2048 cap; no retry today.  
**Alternatives**: Single-call with higher cap — rejected (context too large).

## R4: Cloze zero-valid

**Decision**: `partial` phase result, `degraded` slice status, continue preparation.  
**Rationale**: Other modes usable; matches T1.2 sparse inventory pattern.
