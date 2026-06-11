# Contract: Consumer Integration (study.js + session-store)

## session-store.js

### Schema defaults (`createSession`)

```js
shared: {
  // ...existing
  uploadMeta: null,
  assessmentSignals: [],
}
```

### New helpers

```js
export function setUploadMeta(docId, uploadMeta)
export function syncAssessmentSignalsToShared(docId, slice, sourceMode)
export function getAssessmentSignals(docId)
```

`validateDocumentSession`: `assessmentSignals` optional array; `uploadMeta` optional object.

---

## study.js — Recommendation upload

In `recommendFlowFromUploadedFile(file)` after `ensureDocumentSessionForUpload`:

```js
setUploadMeta(doc.docId, {
  fileName: file.name,
  originalFormat: inferFormat(file),
  uploadedAt: new Date().toISOString(),
});
state.lastCleanedMaterialText = cleanedText;
state.lastUploadedFileNames = [file.name];
// existing hierarchy + recommendation
```

---

## study.js — Mode entry (replace bare enterCreateScreenForMode)

```js
async function enterModeWithContinuity(mode) {
  const doc = getActiveSession();
  const entry = await applyModeEntry(doc, mode, { llmModel: getSessionLlmModel() });
  if (entry.action === 'resume') {
    resumeXxxSession(entry.slice);
    return;
  }
  if (entry.action === 'bootstrap') {
    state.activeSession = entry.slice;
    showBootstrappedCreateScreen(mode, entry.slice); // material loaded banner, no file input
    return;
  }
  enterCreateScreenForMode(mode); // legacy upload path
}
```

Wire:
- `startModeFromRecommendation`
- `input[name=studyMode]` change handler
- Flow panel Continue / quick flow

---

## study.js — Bootstrapped create UI

When `bootstrap` and no blocks yet (RSVP/Questions):

- Hide file input section OR show read-only “Document loaded: {title}”
- Show `Generate blocks` enabled (uses `state.lastCleanedMaterialText` or `shared.rawMarkdown`)
- Reuse `blockSplitCache` if fingerprint matches

When `bootstrap` Cloze:

- Show cloze panel with “Material loaded” + `Generate items`
- Skip re-upload handler

When `bootstrap` Slow:

- Jump to scope screen with hierarchy from `shared.docHierarchy`

---

## study.js — RSVP generate → shared inventory

After successful `twoPhaseConceptSplit` / cache pack:

```js
if (conceptInventory?.length) {
  addConceptsToShared(doc.docId, conceptInventory.map(c => ({ ...c, detectedBy: 'rsvp' })));
}
```

---

## study.js — Response sync

After persisting block responses (RSVP/Questions):

```js
syncAssessmentSignalsToShared(doc.docId, sessionObj, 'rsvp');
```

---

## cloze/pipeline.js + cloze/study.js

On pipeline complete or study start:

```js
const signals = doc.shared.assessmentSignals || [];
session.cloze.items = prioritizeByAssessmentSignals(session.cloze.items, signals);
session.cloze.studyOrder = items.map(it => it.id);
```

When `shouldSkipClozePhase0` true, pass `assessmentSignals` into item generation prompts as “weak concepts” hint (optional v1: order only).

---

## Flow panel exit hooks

On navigation to `modeSelect` from ready screen / slow phase complete / cloze study end:

```js
const doc = getActiveSession();
if (doc?.shared?.modeRecommendation) {
  doc.shared.modeRecommendation = updateFlowProgress(doc.shared.modeRecommendation, doc);
  updateRecommendation(doc.docId, doc.shared.modeRecommendation);
}
renderFlowPanel(doc);
```

---

## Backward compatibility

| Condition | Behavior |
|-----------|----------|
| No `assessmentSignals` field | Treat as `[]` |
| No `uploadMeta` | Bootstrap uses `titleInferred` as fileName |
| Legacy upload-only entry | `upload_required` path unchanged |
| Existing mode slice | Always `resume` wins over bootstrap |
