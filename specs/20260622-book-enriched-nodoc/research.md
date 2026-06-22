# Research: Book-Enriched Nodoc Interview

## R1 — Nodoc flow seam

**Decision**: Insert `enterBookSearchScreen()` between `createSessionNoFileBtn` click and `enterInterviewCaptureScreen()` when `BOOK_LOOKUP_ENABLED`.

**Rationale**: `study.js` line ~3874 wires no-file directly to interview; book search is a pre-interview sub-step.

**Alternatives considered**: Separate `screenBookSearch` section with three panel states (search / confirm / levelC) — chosen for minimal surgery vs. new top-level screen.

## R2 — Vault source fields

**Decision**: Add optional `source_title` and `source_author` to vault entries in `mergeNormalizationResult` via new `bookSource` parameter from `session-close.js`.

**Rationale**: Grep shows no existing `source_title`/`source_author` in vault-store; fields applied when session has `uploadMeta.bookMeta`.

## R3 — Google Books API key

**Decision**: Add `LS_GOOGLE_BOOKS_KEY` in `config.js` + optional Settings input with hint that Google Books enrichment requires it.

**Rationale**: No existing `GOOGLE_BOOKS_API_KEY` in codebase; mirrors Gemini optional key pattern.

## R4 — Opening question bank format

**Decision**: Extend `getOpeningQuestions(studyLang, bookMeta?)` to return `{ questions: string[], defaultIndex: number }` — same shape as today.

**Rationale**: `opening-questions.js` returns this structure; Level A builds chapter questions in study language templates.

## R5 — uploadMeta persistence

**Decision**: Extend `setUploadMeta` to merge optional `bookMeta`; write via `ensureInterviewSession` on confirm.

**Rationale**: `session-store.setUploadMeta` currently strips to three fields; must spread `bookMeta` for persistence.

## R6 — Supabase cache access

**Decision**: Use existing `supabase-client.js`; table `pith_book_cache` with RLS disabled and public read/write.

**Rationale**: Matches document-images and belief-persist patterns; global anonymous cache per spec.
