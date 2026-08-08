# Research: Native Viewer Post-Ship Fixes 01

## R1 — pdfSource retention

**Decision:** Stash `{ kind: "base64", data }` on `shared.pdfSource` at **upload time** on every PDF path that still has a live `File`/`ArrayBuffer`. Do not rely on DPP.

**Rationale:** Inspection found bytes are discarded after markdown extraction. Only legacy Slow generate (`study.js` ~10325) stashes today. DPP sees markdown + `uploadMeta` only — cannot resolve bytes. Lazy resolve without prior stash always fails.

**Alternatives considered:**
- DPP-only stash — impossible without bytes.
- New IndexedDB binary store — rejected (parent feature comment: no binary IndexedDB; keep session JSON base64 like legacy).
- Per-entry-path Slow-only patches — rejected by FR-001/R1.1 (document property).

**Call sites to cover:** `processCreateSessionStagedUpload`, `recommendFlowFromUploadedFile`, and any other upload/ingest that normalizes a PDF `File` before clearing it. Extract small helper next to `encodePdfSourceBase64` usage to avoid drift.

## R2 — IA context severity & approach

**Decision:** Current bug is **empty context** (`maxReadCharEnd` unset → `slice(0,0)`), not spoiler leak. Fix: branch on `viewerMode`; PDF builds context from pages `1..maxReadPdfPage` via pdf.js text extraction (async inside `askSlowReaderIA`).

**Rationale:** `buildIAContext` only reads `maxReadCharEnd`; PDF sessions never set it.

**Alternatives considered:**
- Map PDF pages to markdown char offsets — fragile; markdown ≠ page layout.
- Pass full `normalizedTextFull` — spoiler leak; violates anti-spoiler.
- Sync-only char heuristic — wrong content for native PDF viewer.

## R3 — Migration persistence

**Decision:** After `migrateSlowAnnotationsInSession` mutates a loaded session, persist via the same `storeActiveSession`/`saveDocumentSession` path that owns that load — version flag + annotations in one write. Keep migration idempotent when `annotationSchemaVersion >= 2` and when re-run on already new-shape data without flag.

**Rationale:** Today migration only mutates memory during `normalizeLoadedSession`; version may never hit disk until incidental save.

**Alternatives considered:**
- Separate “touch” write after migration — risks split-brain if only one lands.
- Skip persist and rely on idempotency — still wastes work and risks notice flag flicker.

## R4 — Drop notice

**Decision:** On Slow reader init, if `pdfLegacyAnnotationsDroppedNotice` and not yet shown, display one-time banner (reuse inventory/status banner pattern), then clear/mark shown and persist in same save.

**Rationale:** Flag already set by migration; zero UI consumers today.

## R5 — Orphan consumers

**Decision:** Skip orphans in: Module A proximity, devil’s-advocate/context slice, graph proximity linking, `navigateToAnnotation`. Keep orphans for flashcards / depth / text lists.

**Rationale:** Position-sensitive paths produce false matches or dummy jumps; text-only paths still valuable to the learner.

**Report (pre-fix inspection):** See [contracts/orphan-annotation-consumers.md](./contracts/orphan-annotation-consumers.md).
