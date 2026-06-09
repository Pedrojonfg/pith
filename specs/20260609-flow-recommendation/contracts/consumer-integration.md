# Contract: Consumer Integration (study.js + session-store)

## session-store.js

### Schema default

```js
shared: {
  // ...existing
  modeRecommendation: null,
}
```

### New helper

```js
/**
 * @param {string} docId
 * @param {ModeRecommendation} recommendation
 */
export function updateRecommendation(docId, recommendation)
```

Validates session exists; merges recommendation; `saveActiveSession` equivalent.

### validateDocumentSession

`modeRecommendation` optional; if present must be object with `primaryFlow` array.

---

## study.js — Upload pipeline

After normalization + `buildDocumentHierarchy`:

```js
const textMetrics = analyzeText(cleanedText);
const pedagogicalMeta =
  hierarchyResult?.pedagogicalMeta ??
  buildDeterministicPedagogicalMeta(textMetrics);
const method = hierarchyResult?.method === 'llm' ? 'llm_meta' : 'deterministic';

if (!doc.shared.modeRecommendation) {
  doc.shared.modeRecommendation = computeModeRecommendation(
    textMetrics,
    pedagogicalMeta,
    { method }
  );
  updateRecommendation(doc.docId, doc.shared.modeRecommendation);
}
```

**Existing session**: skip compute; call `updateFlowProgress` on load.

---

## study.js — Mode select screen

On mount `#screenCreate` or mode picker:
1. `renderRecommendationPanel(session.shared.modeRecommendation)`
2. Wire `#recommendationStartBtn` → `startMode(primaryFlow[0].mode)`
3. Wire override → `recordUserOverride` + `startMode(chosen)`

---

## study.js — Mode lifecycle

**On enter mode**:
```js
if (recommendedStep && chosenMode !== recommendedStep.mode) {
  session.shared.modeRecommendation = recordUserOverride(
    session.shared.modeRecommendation,
    chosenMode
  );
}
```

**On exit mode / phase complete**:
```js
session.shared.modeRecommendation = updateFlowProgress(
  session.shared.modeRecommendation,
  session
);
updateRecommendation(docId, session.shared.modeRecommendation);
```

---

## Dependencies

| Prerequisite | Required for |
|--------------|--------------|
| unified-session T01 | `shared.modeRecommendation` field |
| unified-session T04 | DocumentSession in upload flow |
| doc-hierarchy-index | `buildDocumentHierarchy` with extended prompt |

---

## Error handling

- `analyzeText` on empty string → valid TextMetrics zeros; recommender returns default flow
- Missing `pedagogicalMeta` → `buildDeterministicPedagogicalMeta`
- Never throw to user; log console.warn on parse failures
