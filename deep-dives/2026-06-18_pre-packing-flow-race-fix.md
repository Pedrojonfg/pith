# Deep Dive: Pre-packing flow race fix

## 1. What we built

Guards around RSVP pre-packing async state so background block packing cannot write to `prePackingFlow` after the flow has been torn down. The bug surfaced as `Cannot set properties of null (setting 'packedResult')` when parallel packing finished after the user skipped, ignored the profile, or otherwise reset the flow. The fix keeps parallel packing behavior but makes completion callbacks and post-`await` paths safe when `prePackingFlow` is cleared.

## 2. Design decisions

### Identity check (`prePackingFlow === flow`) vs simple null guard in `.then()`

- **Chosen:** Capture `const flow = prePackingFlow` at promise creation; in `.then()`, write `packedResult` only if `prePackingFlow === flow`.
- **Alternative:** `if (prePackingFlow) prePackingFlow.packedResult = packed` — simpler but would write to a *new* flow if the user started another upload before the old pack finished.
- **Trade-off:** Identity check is slightly more code but correctly scopes side effects to the flow instance that started the work.

### Post-`await` null guards on all pack completion paths

- **Chosen:** `if (!prePackingFlow) return` after every `await` that mutates flow state (`handlePrePackingSkip`, `finishPrePackingAssessment` fast path, `handlePrePackingAccept`, `handlePrePackingIgnore`).
- **Alternative:** Only fix the `.then()` callback — would leave other paths vulnerable if another handler resets the flow during `await`.
- **Trade-off:** Repetitive guards; could be centralized later, but explicit checks match existing `if (!prePackingFlow) return` style in the file.

### Clear `packingPromise` on Ignore

- **Chosen:** `prePackingFlow.packingPromise = null` before starting re-pack without profile.
- **Alternative:** Abort/cancel the in-flight pack (not available without AbortController wiring through `packInventoryToBlocks`).
- **Trade-off:** Old promise may still complete in memory, but identity guard prevents stale writes; Accept path won't accidentally await a profile-based pack the user rejected.

## 3. Concepts applied

| Concept | What it is | Where in our code |
|--------|------------|-------------------|
| **Stale async callback** | A callback registered before `await` runs later when its captured context is invalid | `.then()` on `packingPromise` firing after `resetPrePackingFlow()` |
| **Ephemeral module state** | Single global variable holding UI flow state, cleared on navigation/completion | `let prePackingFlow = null` + `resetPrePackingFlow()` |
| **Promise chaining** | `.then()` runs when upstream resolves; ordering relative to other `await` callers matters | `runPrePackingPack(...).then((packed) => …)` |
| **Identity vs null check** | Comparing object reference detects "same session" vs merely "something exists" | `if (prePackingFlow === flow)` |
| **Cooperative cancellation** | Without abort APIs, invalidate work by clearing handles and ignoring late results | `packingPromise = null` + identity guard |

## 4. Technical debt and improvements

**Well done:** Minimal diff; no change to packing semantics; aligns with existing early-return pattern for `prePackingFlow`.

**Duct tape:** Repeated `if (!prePackingFlow) return` after awaits; no true cancellation of in-flight LLM pack calls (wasted work still runs).

**Won't scale:** Any new background writer to `prePackingFlow` must remember the same pattern. A small `PrePackingFlowController` class with `dispose()` and generation tokens would scale better than module-level null checks.

## 5. Consolidation questions

1. Why does `if (prePackingFlow)` in the `.then()` callback fail to protect against a *new* upload starting before the old pack completes, and how does the identity check fix that?
2. In `finishPrePackingAssessment`, when `counts.full === 0`, the code awaits `packingPromise` and then resets — walk through the microtask order when the parallel `.then()` and the `await` both try to set `packedResult`.
3. If you added a third button on the results screen that starts a new pack with different options, what three things would you need to guarantee to avoid regressing this bug?

## 6. Suggested update for .cursorrules

1. **Ephemeral flow globals:** Any async callback that writes to module-level flow state must verify the flow is still active (identity or generation token), not only non-null.
2. **Parallel background work:** When starting background promises that mutate shared flow objects, document the teardown contract (who calls reset, what happens to in-flight work).
3. **Post-await guards:** After `await` in multi-step UI flows, re-check flow/session handles before mutation — another handler may have run during the yield.
