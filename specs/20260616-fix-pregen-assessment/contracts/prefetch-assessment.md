# Contract: Assessment Prefetch (Pre-Generation)

**Feature**: `20260616-fix-pregen-assessment`  
**Module**: `src/js/study.js`

## When

After `runConceptInventory` succeeds and `isPrePackingAssessmentEnabled()` is true, before `enterPrePackingAssessmentScreen()`.

## `itemsPromise` creation

```js
const qCfg = resolvePrePackingQuestionConfig();
prePackingFlow = {
  // …
  prefetchConfigKey: buildPrefetchConfigKey({ qCfg, conceptInventory, cleanedText }),
  itemsPromise: generatePrePackingAssessmentItems({
    conceptInventory,
    edges: [], // or from inventory when available
    materialText: cleanedText,
    n_test: qCfg.n_test,
    n_socratic: qCfg.n_socratic,
    llmModel: splitOpts.llmModel,
    language: splitOpts.language,
  }),
  // NO .catch(() => []) — errors propagate to runner
};
```

## Runner reuse rules

In `enterPrePackingAssessmentRunner`:

1. If `!itemsPromise` OR `prefetchConfigKey` mismatch OR prior result was empty → create fresh promise with same args as above.
2. Await promise; if `questions.length === 0` → throw (handled by failure UX, not auto-skip).

## `buildPrefetchConfigKey` (new pure helper)

```js
/**
 * @returns {string} stable key for prefetch invalidation
 */
export function buildPrefetchConfigKey({ qCfg, conceptInventory, cleanedText })
```

Minimum inputs: `n_test`, `n_socratic`, inventory id list joined, `cleanedText.length`.

## Must not

- Pass only `maxItems` when Questions UI is enabled
- Swallow errors into empty array
- Proceed to `handlePrePackingSkip` without user action on failure
