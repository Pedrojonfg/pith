# Contract: Gated DPP phases

## Pre-scope runnable set

When `stopAfterScopeGate: true` or scope unresolved: `["T0.1", "T0.2", "T1.1"]` only.

## Post-scope gated set (must not run before resolve)

`T1.2`, `T1.2b`, `T1.3`, `T1.4`, `T1.6`, `T1.7`, `T1.8`, `T1.9`, `T2.1`, `T2.2`, `T2.3`, plus shared/holistic assessment orchestration outside DPP runners.

**Note**: `T1.5` ordering vs inventory is out of scope for PHASE_DEPS edits; if T1.5 runs in a wave, it still must not consume unresolved scoped text incorrectly — prefer excluding it from pre-scope sets (already excluded by SCOPE_PRE).

## Choke points

1. `phasesForStopTier` / resume after confirm.
2. Defensive: `executePhase` / ensure* early returns check `isScopeGateResolved` for gated IDs.
3. `ensureTier1Preparation` must not skip via `isTier1PreparationComplete` when scope never resolved.
4. Fingerprint: `phaseSucceeded` must not use a fingerprint overwritten at pipeline start for the current run’s skip logic incorrectly.

## Text consumers after resolve

All gated phases use `resolveScopedMarkdown` + mini-tree where offsets matter; never `rawMarkdown` except chat.
