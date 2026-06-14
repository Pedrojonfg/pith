# Contract: hub-navigation

**Modules**: `src/js/study.js`, `src/js/mode-bootstrap.js`  
**FR**: FR-003, FR-004, FR-006

## enterRetrievalHub(options?)

```javascript
/**
 * @param {{ docId?: string, entrySource?: string }} [options]
 */
export function enterRetrievalHub(options)
```

1. Resolve `docId` from options or active session.
2. If no document or no shared material → show upload guidance (reuse upload_required UX).
3. Render hub options via `getDocumentRetrievalModes()`.
4. `showScreen('retrievalHub')`.

## Hub option click

```javascript
function onRetrievalHubPick(modeKey) {
  void enterModeWithContinuity(modeKey);
}
```

- Delegates to existing bootstrap/resume/generate paths — **no duplicate** mode logic in hub.
- Cloze: `enterModeWithContinuity('cloze')` triggers pipeline if needed (no hub generate button).

## Exposure completion wiring

| Source | Current | New |
|--------|---------|-----|
| Slow phase 3 finish | `enterModeSelectScreen()` | `enterRetrievalHub({ entrySource: 'exposure_complete' })` |
| RSVP session complete screen primary CTA | mode select / review push | `enterRetrievalHub({ entrySource: 'exposure_complete' })` |
| Embedded block test/socratic | unchanged | unchanged |

## Back navigation

`retrievalHubBackBtn` → `enterModeSelectScreen()` if doc active, else `enterDocLibraryScreen()`.

## Out of scope

- Do not intercept Cloze/Questions/Recall **mid-session** exits — only exposure endings and explicit practice entry.
