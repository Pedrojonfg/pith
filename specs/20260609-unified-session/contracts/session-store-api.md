# Contract: Session Store API

**Module**: `src/js/session-store.js`

## localStorage keys

| Key | Value |
|-----|-------|
| `pith_doc_sessions` | `DocumentSession[]` JSON |
| `pith_active_doc_id` | `string \| null` |
| `pith_doc_text_{docId}` | `string` — markdown externalizado |
| `pith_v1_backup` | backup migración (ver migration contract) |

## Public API

```js
// Active session
export function getActiveSession()                    // → DocumentSession | null (rehydrates rawMarkdown)
export function setActiveSession(docId)               // void; throws if docId unknown
export function saveActiveSession(session)            // void; validate + persist + touch updatedAt

// CRUD
export async function createSession(rawMarkdown, options?)  // → DocumentSession; computes docId async
export function getSession(docId)                     // → DocumentSession | null
export function getAllSessions()                      // → DocumentSession[] sorted updatedAt desc
export function deleteSession(docId)                  // void; removes text key if externalized

// Shared layer helpers
export function addConceptsToShared(docId, concepts)  // merge by canonicalId
export function addAnnotationToShared(docId, annotation)
export function upsertSmItem(docId, item)             // by item.id
export function getSmItemsDueToday(docId?)           // docId optional → all docs

// Validation
export function validateDocumentSession(session)      // → { ok: boolean, errors: string[] }
export function computeDocId(rawMarkdown)             // async → string (12 hex)
```

## Persistence rules

1. Always call `validateDocumentSession` before write.
2. Update `session.updatedAt = Date.now()` on every save.
3. If serialized size > 400KB, externalize `rawMarkdown` (see `data-model.md`).
4. `getActiveSession` reads `pith_active_doc_id` then `getSession`.

## createSession defaults

```js
{
  docId, // computed
  schemaVersion: 2,
  createdAt: now,
  updatedAt: now,
  shared: {
    rawMarkdown,
    docMeta: inferDocMeta(rawMarkdown),
    docHierarchy: null,
    conceptInventory: [],
    annotations: [],
    smItems: [],
  },
  modes: { rsvp: null, slow: null, cloze: null, questions: null },
}
```

## Error handling

- `setActiveSession(unknownId)` → throw `Error('session not found')`
- Corrupt JSON in `pith_doc_sessions` → log, return `[]` from `getAllSessions`
- Missing externalized text → session load with `rawMarkdown: ''` + console.warn
