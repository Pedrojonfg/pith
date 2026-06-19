# Contract: Session Store API (Supabase)

**Module**: `src/js/session-store.js`

## Auth prerequisite

All methods except project-store helpers require an authenticated Supabase user. Throws `not authenticated` if missing.

## Public API (async)

```js
export async function createSession(rawMarkdown, options?)
export async function getSession(docId)
export async function getActiveSession()
export async function setActiveSession(docId)
export async function saveActiveSession(session)
export async function getAllSessions()  // rawMarkdown omitted
export async function deleteSession(docId)
export async function addConceptsToShared(docId, concepts)
export async function addAnnotationToShared(docId, annotation)
export async function updateRecommendation(docId, recommendation)
export async function upsertSmItem(docId, item)
export async function setUploadMeta(docId, meta)
export async function syncAssessmentSignalsToShared(docId, slice, sourceMode)
export async function getAssessmentSignals(docId)
export async function syncAssessmentSignalsFromRecall(docId, question)
export async function getSmItemsDueToday(docId?)
export async function getVaultReviewDueCount()
export async function backfillMissingProjectIds()
```

## Persistence rules

1. `validateDocumentSession` before every write.
2. `rawMarkdown` always uploaded to Storage on save.
3. `getAllSessions` does not hydrate markdown.
4. `getSession` / `getActiveSession` merge markdown from Storage.

## Project store (unchanged, sync)

`loadProjectStore`, `saveProjectStore`, `getProjectStore`, `persistProjectStore` remain localStorage.
