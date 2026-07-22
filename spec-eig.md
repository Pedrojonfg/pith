# Spec: Wire adaptive probing (EIG selection + vault-prior skip) into the live holistic assessment generator

Status: ready for implementation
Supersedes: nothing directly written. Corrects an integration gap between `20260621-adaptive-knowledge-probing` / `20260711-adaptive-prepacking-activation` (the selection engine) and `20260629` concept-coverage (`generateHolisticPrePackingAssessmentItems`, the currently-live generator). Both prior specs remain valid; this spec fixes the wiring between them that a follow-up audit confirmed was never completed.
Depends on: `20260621-adaptive-knowledge-probing` (EIG selection, belief propagation — already implemented), `20260711-adaptive-prepacking-activation` (Phases A/B/C — already implemented), `20260629-...concept-coverage` design (batched one-MCQ-per-concept generator — already implemented, being modified here)

---

## 0. Problem statement (confirmed by audit, not hypothesis)

Two systems exist and both run today, but do not talk to each other:

1. **Adaptive probing** (EIG selection via `nextProbeBatch`/`selectAdaptiveProbeConcepts`, Bayesian belief propagation, vault-prior high-confidence exclusion). Flagged on (`ADAPTIVE_PROBING_ENABLED: true`). Computes a filtered candidate set and stores it in `flow.adaptiveProbing` / `flow.coveragePlan`.
2. **Concept-coverage generation** (`generateHolisticPrePackingAssessmentItems`). Flagged on (`HOLISTIC_ASSESSMENT_ENABLED: true`). Generates one MCQ per concept, batched in groups of ≤20, over `conceptInventory` — **the full inventory, unfiltered**, per confirmed audit trace in `study.js` (`createPrePackingItemsPromise`, ~L7836–7856): `edges`, `plan`, `conceptGraph` are computed and attached to `flow.*` but never passed into or read by the generator itself.

Net effect confirmed by audit: adaptive probing computes a smaller, smarter candidate set, but the live generator ignores it and asks about (nearly) every concept regardless. The three-state `knowledge_profile` design (`tested` / `inferred` / `presumed_known_vault`) degrades to almost-all-`tested`, because almost everything gets asked. Worse, `presumed_known_vault` is currently stamped **after** generation onto concepts that may have already been asked and answered — the exclusion is cosmetic labeling, not an actual skip.

This spec makes the selection engine's output the actual input to generation, and moves the vault-confidence skip to before generation, not after.

---

## 1. Non-goals (explicit)

- Do NOT change the EIG algorithm, belief propagation math, damping factors, or any constant in `eig-selection.js` / the belief-propagation module. Those are validated by their own spec and tests; this spec only fixes what consumes their output.
- Do NOT change the UI/screen flow. Per audit, the happy path already goes through the shared gate → `enterPrePackingAssessmentRunner` → `screenTest`, not the legacy `screenPrePackingAssessment`. Leave that entirely alone.
- Do NOT remove the batching mechanism (≤20 concepts per LLM call) in `generateHolisticPrePackingAssessmentItems`. Keep it as a safety net — even a well-selected EIG subset could in principle be large for very rich documents; the batching logic stays, it will simply usually process one small batch instead of several large ones.
- Do NOT touch the non-holistic branch (`filterInventoryForAdaptiveProbing`, the dead-in-production `else` path) beyond what Open Question 2 requires you to report. If it turns out to be genuinely dead code with `HOLISTIC_ASSESSMENT_ENABLED` permanently true, flag that as a separate cleanup candidate for `a_implementar` — do not delete it as part of this spec.
- Do NOT change `ADAPTIVE_PROBING_ENABLED` or `HOLISTIC_ASSESSMENT_ENABLED` flag semantics — both stay as master switches; this spec only fixes what happens when both are true (the live default).
- Do NOT change early-stop logic itself (`applyAdaptiveBeliefUpdate` + early-stop trigger) — only ensure it continues to operate correctly on the now-correctly-scoped candidate set.

---

## 2. Open questions for Cursor to resolve via repo inspection before writing code

1. Confirm the exact current return shape of `buildAdaptiveCoveragePlan` (`ctx.plan` in the audit trace) — specifically, does it expose a field like `selectedConceptIds` (or equivalent) that is *already* the EIG-selected, vault-high-confidence-excluded candidate set? Paste the actual function/return shape before modifying anything downstream of it.
2. Confirm whether Phase C of `20260711-adaptive-prepacking-activation` (vault-prior exclusion via `HIGH_CONFIDENCE_SKIP_THRESHOLD`) is implemented *inside* `buildAdaptiveCoveragePlan`/`selectAdaptiveProbeConcepts`, or only inside the dead `filterInventoryForAdaptiveProbing` non-holistic branch. This determines whether the holistic path gets vault-skip "for free" once wired, or whether that exclusion logic needs to be duplicated/moved into the path this spec touches. Report which is the case — do not assume.
3. Confirm whether `filterInventoryForAdaptiveProbing` (non-holistic branch) and `buildAdaptiveCoveragePlan` (holistic branch) are two independent implementations of essentially the same filtering logic, or whether one already calls the other. If they are independent/duplicated, flag this explicitly in your implementation notes — do not silently unify them as part of this spec (out of scope per §1), just report the duplication risk for a future cleanup decision.
4. Confirm the exact current signature and internals of `generateHolisticPrePackingAssessmentItems` (paste in full before modifying), specifically how `runConceptBatches(inventory, "initial")` chunks and iterates — confirm there is no other logic inside that function that assumes it received the *full* inventory (e.g. any coverage-percentage calculation, progress bar denominator, or completion check computed against total inventory size rather than against the concepts actually being assessed). If such logic exists, it must be updated to use the size of the passed-in (now filtered) set, not the full inventory — otherwise progress/completion indicators will be wrong even after the fix.
5. Confirm the exact current logic of `enrichKnowledgeProfileWithAdaptiveStatuses` (paste in full) — specifically confirm the audit's finding that it can overwrite an already-`tested` concept's status to `presumed_known_vault`. Trace whether this is even possible after this spec's fix (if vault-high-confidence concepts are excluded before generation, they should never reach `tested` status in the first place, making the overwrite path unreachable) — confirm this reasoning against the actual code rather than assuming it.
6. Grep all call sites of `generateHolisticPrePackingAssessmentItems` to confirm `study.js`'s `createPrePackingItemsPromise` is the only caller. If there are others, they need the same fix.

Do not proceed with implementation until 1–6 are confirmed against live code. Record findings at the top of the implementation log.

---

## 3. Required changes

### 3.1 Compute and pass the real candidate set at the call site

In `study.js`, `createPrePackingItemsPromise` (holistic branch, ~L7836–7856):

```diff
  if (isHolisticAssessmentEnabled()) {
    return Promise.resolve(resolveHolisticAssessmentContext(flow)).then((ctx) => {
      flow.edges = ctx.edges;
      flow.docHierarchy = ctx.docHierarchy;
      flow.coveragePlan = ctx.plan;
      flow.holisticBudget = ctx.budget;
+     const candidateConcepts = resolveAdaptiveCandidateConcepts(flow.conceptInventory, ctx.plan);
+     flow.assessedConceptIds = candidateConcepts.map((c) => getConceptId(c));
      return generateHolisticPrePackingAssessmentItems({
-       conceptInventory: flow.conceptInventory,
+       conceptsToAssess: candidateConcepts,
        edges: ctx.edges,
        materialText: flow.cleanedText,
        docHierarchy: ctx.docHierarchy,
        conceptGraph: ctx.conceptGraph,
        plan: ctx.plan,
        // ...
      });
    });
  }
```

`resolveAdaptiveCandidateConcepts(inventory, plan)` is a new small helper (co-locate with `buildAdaptiveCoveragePlan` or in `study.js` near the call site, Cursor's choice) that:

- If `ctx.plan` already exposes the correct pre-filtered id set (per Open Question 1), maps those ids back to full inventory entries and returns that list.
- If `ADAPTIVE_PROBING_ENABLED` is false (defensive check, even though it's true today), falls back to returning the full inventory unchanged — this preserves current behavior exactly when adaptive probing is off, so this fix does not silently change behavior for anyone who disables the flag.
- Must never return an empty list when the inventory is non-empty (guard: if the plan's selection is empty for any reason — e.g. a bug upstream — fall back to full inventory and log a warning, rather than silently generating zero assessment questions for a document that has concepts).

### 3.2 Rename the generator's parameter, on purpose, as a defensive measure

Rename `conceptInventory` → `conceptsToAssess` in `generateHolisticPrePackingAssessmentItems`'s signature (per the diff in §3.1). This is not cosmetic: the original bug likely happened *because* the parameter was named `conceptInventory`, which invites a caller to reflexively pass "the inventory" rather than "the subset to assess." Add a one-line JSDoc comment above the function: `// conceptsToAssess MUST be the pre-filtered candidate set (adaptive probing / vault-skip already applied upstream), NOT the full document inventory.`

Update every internal reference inside the function accordingly (`inventory` local variable naming can stay if you prefer, just be consistent).

### 3.3 Fix or confirm-unreachable the vault-skip overwrite bug

Per Open Question 5: if excluding vault-high-confidence concepts before generation (§3.1) makes the overwrite in `enrichKnowledgeProfileWithAdaptiveStatuses` structurally unreachable, add an explicit assertion/guard there anyway (throw or warn-log if it ever finds a concept that is both in `vaultSkippedIds` AND already has a `tested`/`assessed` entry in the profile) — this turns a silent semantic bug into a loud one if the invariant is ever violated by a future change, rather than leaving it as a latent trap.

If Open Question 5 reveals the overwrite is still reachable for some other reason (e.g. a concept can be both selected by EIG and independently flagged by vault-skip in some edge case), fix the precedence explicitly: a concept excluded by vault-skip must never appear as `tested` regardless of what else touches the profile — vault-skip status wins and is set once, upstream, not patched on afterward.

### 3.4 Progress/coverage indicators

Per Open Question 4: any UI or internal calculation that reports "X of Y concepts assessed" must use the size of `conceptsToAssess` (the filtered set) as the denominator, not the full document inventory size. If such a denominator exists and currently reads full inventory length, fix it. If it doesn't exist, no action needed here.

---

## 4. Risk-ordered implementation steps

1. **(Safest)** Answer Open Questions 1–6 against live code. No code changes yet.
2. Implement `resolveAdaptiveCandidateConcepts` in isolation with a fixture test: given a mock inventory of 10 concepts and a mock plan selecting 4 of them, assert the function returns exactly those 4 full concept objects (not just ids). Also test the `ADAPTIVE_PROBING_ENABLED: false` fallback path (returns full inventory).
3. Wire `resolveAdaptiveCandidateConcepts` into `createPrePackingItemsPromise` and rename the generator parameter (§3.1, §3.2). This is the core fix.
4. Add or confirm-unreachable the vault-skip overwrite guard (§3.3).
5. Fix progress/coverage denominators if Open Question 4 found any (§3.4).
6. **(Riskiest — user-visible behavior change)** End-to-end test exercising the actual live holistic branch (see §5 — this is the gap the audit specifically called out: existing tests only assert that `study.js` *contains the string* `filterInventoryForAdaptiveProbing`, they do not exercise the real branch). Build a fixture with: a document inventory of ~15 concepts, a mock EIG plan selecting 5 of them, 2 concepts pre-marked as vault-high-confidence. Run the real `createPrePackingItemsPromise` holistic path (mocking only the LLM call itself) and assert: (a) the LLM is invoked with exactly the 5 selected concepts, not all 15; (b) the 2 vault-high-confidence concepts never appear in any LLM prompt payload; (c) the final `knowledge_profile` correctly labels the 2 vault-skipped concepts as `presumed_known_vault` and the 5 assessed ones as `tested` (or `inferred` if early-stop applies to any).

---

## 5. Testing requirements

- All new/modified logic: fixture-based, deterministic, no reliance on a real LLM call (mock it).
- The step-6 end-to-end test is mandatory and must actually invoke the real code path (`createPrePackingItemsPromise` → `generateHolisticPrePackingAssessmentItems` with mocked LLM), not merely assert a function name appears somewhere in a file — this is explicitly called out because it's how the original disconnect went undetected despite "green tests."
- Add one regression test asserting that when `ADAPTIVE_PROBING_ENABLED` is manually set to `false`, the generator still receives the full inventory (i.e. confirm the fix doesn't silently change behavior with the flag off).
- Report, in the PR description, the concrete before/after question count for the fixture used in the step-6 test (e.g. "before: 15 concepts asked; after: 5 concepts asked, 2 vault-skipped, matching profile labeled correctly") so this can be sanity-checked without re-reading code.

---

## 6. Files expected to be touched (confirm against actual repo layout)

- `src/js/study.js` — `createPrePackingItemsPromise`, new `resolveAdaptiveCandidateConcepts` helper (or co-located elsewhere, Cursor's choice per Open Question placement)
- `src/js/api.js` — `generateHolisticPrePackingAssessmentItems` signature/param rename, `runConceptBatches` internals if Open Question 4 finds a denominator issue
- Wherever `enrichKnowledgeProfileWithAdaptiveStatuses` lives — guard per §3.3
- New/updated test file, e.g. `cursor-tests/20260722_adaptive-holistic-wiring-e2e.mjs`
