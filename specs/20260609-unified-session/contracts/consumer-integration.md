# Contract: Consumer Integration Hooks

## 1. Boot (`main.js`)

```js
import { detectAndMigrateV1 } from './session-migration.js'
detectAndMigrateV1()  // sync, before loadSessionsByMode consumers
```

## 2. Session wrapper (`session.js`)

`loadSessionForMode(mode)` / `storeSessionForMode(mode, slice)`:

```js
const doc = getActiveSession()
if (!doc) return null
// read/write doc.modes[mode], then saveActiveSession(doc)
```

Legacy `loadSessionsByMode()` deprecated — delegate to active DocumentSession for compatibility during T03.

## 3. Upload (`study.js`)

After `normalizeStudyMaterial`:

```js
const markdown = normalized.markdown
const existing = await getSession(await computeDocId(markdown))
if (existing) {
  setActiveSession(existing.docId)
} else {
  const session = await createSession(markdown)
  setActiveSession(session.docId)
}
// Pass session.modes[activeMode] or full session to mode init
```

**Mode switch**: do NOT clear session; update `state.studyMode` and load `session.modes[newMode]`.

## 4. Slow Mode annotations (`slow/reader.js` or annotations module)

On save annotation:

```js
addAnnotationToShared(docId, annotation)
// dual-write: session.modes.slow.annotations.push(annotation) — T05 only
```

## 5. Slow Mode Phase 0 (`slow/phase0.js`)

On concepts detected:

```js
addConceptsToShared(docId, conceptsFromPhase0)
```

## 6. Cloze pipeline (`cloze/pipeline.js`)

```js
const shared = getActiveSession()?.shared
const skipPhase0 =
  session.modes.slow?.graphEnrichedUnlocked === true ||
  (shared?.conceptInventory?.length ?? 0) >= 5

if (skipPhase0) {
  // seed graph from shared.conceptInventory + shared.annotations context
  startPhase = 1
} else {
  startPhase = 0  // current behavior
}
```

On item generation: `upsertSmItem(docId, smItem)`.

## 7. Graph adapters (`graph/adapters.js`)

```js
export function buildSessionGraph(session, options = {}) {
  const shared = options.shared ?? session?.shared ?? null
  // buildClozeEpistemicGraph(session, { shared })
  // resolveEnrichedGraphInputs: annotations from shared ?? slow slice
}
```

## 8. Documents list screen (`study.js` / `index.html`) — T08 optional

```js
getAllSessions().map(doc => ({
  title: doc.shared.docMeta.titleInferred,
  modes: Object.entries(doc.modes).filter(([,v]) => v).map(([k]) => k),
  smDue: getSmItemsDueToday(doc.docId).length,
  updatedAt: doc.updatedAt,
}))
```

## Backward compatibility

| Condition | Behavior |
|-----------|----------|
| Pre-migration V1 | `detectAndMigrateV1` on boot |
| Mode code still uses flat session object | `session.js` wrapper passes slice shape |
| No shared data yet | Cloze/RSVP behave as today |
| `docHierarchy` only in slice | Migration copies to `shared` |
