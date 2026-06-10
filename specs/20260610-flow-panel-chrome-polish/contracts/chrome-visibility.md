# Contract: Floating Study Chrome Visibility

**Location**: `src/js/ui.js` (`syncFloatingChrome`, `resolveChromeVisibility`)

## API (pure, export for tests)

```js
/**
 * @param {ChromeVisibilityContext} ctx
 * @returns {{ showBlockReadFab: boolean, showGuideFab: boolean }}
 */
export function resolveChromeVisibility(ctx)
```

## Rules

### Block-read FAB (`#block-read-toggle-btn`)

```
showBlockReadFab =
  ctx.studyMode === 'rsvp'
  && ctx.blockReadWanted
  && (ctx.screenId === 'test' || ctx.screenId === 'socratic')
  && !ctx.assessmentActive
```

### Guide FAB (`#sidebar-toggle-btn`)

```
showGuideFab =
  (ctx.studyMode === 'cloze' || ctx.studyMode === 'questions')
  && !ctx.offline
  && !ctx.assessmentActive
  && !ctx.guideToggleSuppressed
  && (
    ctx.screenId === 'test'
    || ctx.screenId === 'socratic'
    || (ctx.screenId === 'between' && ctx.hasConcepts)
  )
```

### Always hidden contexts

- `screenId` ∈ `{ modeSelect, create, docLibrary, setup, blocks, assessment, assessmentGenerating, ready, fullPackGenerating, complete, reviewConfig, slowScope, slowPhase0, slowReader, slowPhase3, slowGraph, clozeStudy (pre-questions) }`
- `studyMode === 'slow'` → both FABs false
- `studyMode === 'rsvp'` → guide FAB false

## Integration

- `showScreen(which)` MUST call `syncFloatingChrome()` after `currentScreenId` update.
- `setBlockReadSidebarAvailable` MUST call `syncFloatingChrome()`.
- `registerChromeStudyModeResolver` MUST call `syncFloatingChrome()`.
- `updateDictionaryButtonVisibility` SHOULD pass `hasConcepts` into chrome sync or trigger re-sync.

## Regression matrix (cursor-tests)

Mínimo 12 casos: 4 pantallas × 3 modos representativos documentados en quickstart QA-CHROME.
