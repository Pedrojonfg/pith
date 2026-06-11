# Contract: Mode Bootstrap API

**Module**: `src/js/mode-bootstrap.js` (NEW)

## `resolveModeEntryState(doc, mode)`

Pure resolution — no DOM, no localStorage.

```js
/**
 * @param {import('../session-types.js').DocumentSession | null} doc
 * @param {'rsvp'|'slow'|'cloze'|'questions'|'review'} mode
 * @returns {{
 *   kind: 'resume' | 'bootstrap' | 'upload_required',
 *   mode: string,
 *   reason: string,
 *   existingSlice: object | null,
 * }}
 */
export function resolveModeEntryState(doc, mode)
```

### Rules

| Condition | Result |
|-----------|--------|
| `!doc` or no `shared.rawMarkdown` / ref | `upload_required` |
| `doc.modes[mode]` non-null and resumable | `resume` |
| else `shared.rawMarkdown` present | `bootstrap` |

**Resumable** per mode:
- RSVP/Questions: slice with `n_blocks > 0` and `blocks` array
- Slow: `slow.phase` not empty
- Cloze: `cloze.normalizedText` present (any pipeline status)

## `buildModeSliceFromShared(doc, mode, options)`

Creates a new mode slice without file upload.

```js
/**
 * @param {DocumentSession} doc
 * @param {StudyMode} mode
 * @param {{ llmModel?: string, language?: string, criticalMode?: boolean }} [options]
 * @returns {object} mode slice ready for storeSessionForMode
 */
export function buildModeSliceFromShared(doc, mode, options = {})
```

### Behavior

- Text source: `doc.shared.rawMarkdown` (rehydrated)
- `materialMeta` from `doc.shared.uploadMeta` or `{ fileName: doc.shared.docMeta.titleInferred, ... }`
- RSVP/Questions: slice shell only (no blocks) — user still taps Generate; UI must not show empty upload
- Slow: `createSlowSession({ normalizedText, ... })` + copy `doc.shared.docHierarchy` to slice
- Cloze: `createClozeSession({ normalizedText, ... })`

## `applyModeEntry(doc, mode, options)` (orchestrator, may live in study.js)

Side-effecting wrapper used by UI:

1. `resolveModeEntryState`
2. If `resume` → return `{ action: 'resume', slice }`
3. If `bootstrap` → `buildModeSliceFromShared`, `persistModeSliceToDocument`, return `{ action: 'bootstrap', slice }`
4. If `upload_required` → return `{ action: 'upload_required' }`

**Consumers**: `startModeFromRecommendation`, mode radio `change`, flow panel Continue.
