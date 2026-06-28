# Spec: Multi-File Upload with Source Provenance

**Date:** 2026-06-28  
**Status:** Approved  
**Supersedes:** nothing (new feature)

---

## 1. Problem

`screenCreateSessionStart` currently allows uploading a single file, and the selection is irreversible: once a file is picked, re-picking replaces it silently, but there is no affordance to clear the selection or add more files. Users who select the wrong file must exit the session, delete it, and start over. Users who want to study a topic from multiple sources must create separate sessions.

---

## 2. Goals

- G1: Allow uploading 1–5 files per session before DPP starts.
- G2: Allow removing any file from the staging list before DPP starts (pre-confirmation only).
- G3: Propagate a `sourceFile` metadata tag from each file's chunks through to blocks, Recall questions, and Cloze items — zero LLM cost, purely mechanical.
- G4: Post-DPP removal is explicitly out of scope. The session must be deleted and recreated.

---

## 3. Non-Goals

- No per-file deletion after DPP has started.
- No per-concept source attribution in `conceptInventory` or `conceptGraph`.
- No UI that surfaces source provenance to the user in this spec (data only; UI is future work).
- No increase to the 5-file cap without a new spec.

---

## 4. User-facing flow

### 4.1 Staging area (replaces single file input)

`screenCreateSessionStart` gets a **file staging list** instead of the current single-file display.

**States:**

```
[ Empty ]
  ┌─────────────────────────────────────────────┐
  │  + Add file   (PDF, HTML, TXT, MD)          │
  └─────────────────────────────────────────────┘

[ One or more files staged ]
  ┌─────────────────────────────────────────────┐
  │  📄 apuntes-mate.pdf          12 KB   [✕]  │
  │  📄 ejercicios.pdf            45 KB   [✕]  │
  │  + Add another file  (max 5)               │
  └─────────────────────────────────────────────┘
  [ Continue → ]
```

- Each row shows: file icon, file name, file size, remove button [✕].
- "Add another file" link is hidden when 5 files are staged.
- "Continue →" button is enabled only when ≥ 1 file is staged and a session name is provided.
- Clicking [✕] removes the file from the list. No confirmation dialog.
- The existing session name field remains; it defaults to the first file's name (stripped of extension) and updates only if the user has not manually edited it.

### 4.2 Confirmation and DPP start

Clicking "Continue →" triggers normalization + DPP exactly as today. After this point, removal is not possible. The UI transitions to the existing DPP progress screen immediately.

### 4.3 Slow mode with multiple files

Slow mode operates on a single text scope. When > 1 file, a file selector appears in `screenSlowScope` above the section picker, defaulting to the first file. The user picks which file's text to read; the scope picker updates to that file's sections. The other files' content is still reflected in the shared concept inventory and graph.

---

## 5. Data model changes

### 5.1 `uploadMeta` extension

```js
// session.shared.uploadMeta (extended)
{
  fileName: string,           // LEGACY: first file name, kept for back-compat
  originalFormat: string,     // LEGACY: first file format
  uploadedAt: number,
  bookMeta?: BookMeta,
  // NEW:
  files: SourceFileMeta[]     // one entry per uploaded file, in upload order
}

// SourceFileMeta
{
  fileId: string,             // short uid, e.g. "f1", "f2" — stable within session
  fileName: string,
  originalFormat: string,     // "pdf" | "html" | "txt" | "md"
  sizeBytes: number,
  addedAt: number             // ms epoch
}
```

Single-file sessions written by this spec always have `files` with one entry. Sessions written before this spec have `files: undefined`; all read paths must treat that as a single anonymous source.

### 5.2 Chunk source tag

During normalization, each chunk (the atomic text unit produced by `normalization/index.js`) gains a `sourceFileId` field matching its `SourceFileMeta.fileId`.

```js
// Chunk shape (internal to normalization pipeline)
{
  text: string,
  type: string,       // existing field
  heading?: string,   // existing field
  sourceFileId: string   // NEW — propagated from the wrapping file context
}
```

### 5.3 Block source provenance

Each block in `modes.rsvp.blocks[]` (and `modes.questions.blocks[]`) gains an optional `sourceFileIds: string[]` field. It is populated mechanically during block packing:

- If all chunks in a block share the same `sourceFileId`, `sourceFileIds = [that id]`.
- If chunks come from multiple files (possible at block boundaries), `sourceFileIds` lists all distinct ids present.
- If `sourceFileId` is absent on any chunk (legacy data), `sourceFileIds` is omitted from the block.

Block packing must respect file boundaries: a chunk from file A and a chunk from file B must not be packed into the same block unless one is a heading that introduces the other. In practice, concatenation (see §6) places a hard section break between files, which the existing packing logic already treats as a block boundary.

### 5.4 Recall question source provenance

Each question in `modes.recall.questions[]` gains an optional `sourceFileId: string` field, set to the `sourceFileId` of the chunk the question was generated from. Generation prompt already receives chunk context; `sourceFileId` is extracted from that context at parse time, not via LLM.

### 5.5 Cloze item source provenance

Each item in `modes.cloze.items[]` gains an optional `sourceFileId: string`. Same rule: derived from the chunk context, not LLM output.

---

## 6. Normalization changes (`input-normalization.js`, `normalization/index.js`)

### R1 — Multi-file entry point

```js
// New export in input-normalization.js
async function normalizeMultipleFiles(files: File[]): Promise<{
  markdown: string,
  sourceMap: SourceMap
}>
```

Where `SourceMap` is:
```js
{
  [chunkIndex: number]: string   // chunkIndex → fileId
}
```

Internally, `normalizeMultipleFiles`:
1. Iterates files in order, calls existing `normalizeStudyMaterial` for each.
2. Tags each chunk with its `fileId` before concatenation.
3. Inserts a hard section break between files:
   ```
   \n\n---\n\n<!-- source: {fileId} -->\n\n
   ```
   This sentinel is recognized by the packing logic (§5.3) and stripped from display text.
4. Returns the concatenated markdown and a `SourceMap`.

### R2 — Chunk boundary rule

Block packing (`session.js` `packConceptsToBlocks` or equivalent) must not cross the `<!-- source: {fileId} -->` sentinel. The sentinel is treated identically to an `<h1>` boundary.

### R3 — Legacy single-file path untouched

Existing `normalizeStudyMaterial` is not modified. `normalizeMultipleFiles` with a single file is equivalent to calling `normalizeStudyMaterial` once and tagging all chunks with `fileId: "f1"`.

---

## 7. DPP changes (`document-preparation.js`)

The DPP receives the already-concatenated markdown (as today). No DPP phase changes are needed. The `SourceMap` is stored in `shared.uploadMeta` alongside `files[]` for future reference but is not used by any current DPP phase.

---

## 8. UI changes

### R4 — `screenCreateSessionStart`

- Replace the current single `<input type="file">` with a staging list component.
- File input accepts same formats as today (`application/pdf`, `text/html`, `text/plain`, `text/markdown`).
- Each add action appends to the list; list order is preserved.
- The existing session name auto-fill logic uses the first file's name.
- "Continue →" maps to the existing confirm handler; it now receives `File[]` instead of `File`.

### R5 — `screenSlowScope` file selector

- Visible only when `shared.uploadMeta.files.length > 1`.
- A `<select>` or pill row listing file names; default = first file.
- Changing selection reloads the section picker with that file's sections.
- File sections are identified via the `<!-- source: {fileId} -->` sentinels in the concatenated markdown.

### R6 — No other screens change

RSVP, Questions, Cloze, Recall, Review — none of these screens surface `sourceFileIds` to the user in this spec.

---

## 9. Back-compat

- All read paths that access `shared.uploadMeta.fileName` continue to work unchanged.
- `shared.uploadMeta.files` is `undefined` on legacy sessions; callers must guard with `files ?? []`.
- `block.sourceFileIds` is `undefined` on legacy blocks; callers must guard with `sourceFileIds ?? []`.

---

## 10. Implementation sequence (risk order)

1. **UI staging list** — purely presentational, zero risk. Implement file list component in `screenCreateSessionStart`. No backend changes.
2. **`normalizeMultipleFiles`** — new function, does not touch existing path. Unit-testable in isolation.
3. **Sentinel + chunk tagging** — add `sourceFileId` to chunk shape; verify sentinel survives through `emitMarkdown`.
4. **Block packing boundary** — add sentinel recognition to packing logic. Regression-test single-file sessions.
5. **`sourceFileIds` on blocks** — mechanical propagation during packing. Verify legacy blocks unaffected.
6. **`sourceFileId` on Recall / Cloze items** — propagate from chunk context in parsers.
7. **`screenSlowScope` file selector** — only visible for multi-file sessions; default path unchanged.
8. **`uploadMeta.files[]` persistence** — write on session create, read in all `uploadMeta` consumers.

---

## 11. Testing checklist

- [ ] Single-file upload behaves identically to before (regression).
- [ ] Staging list shows correct file names and sizes.
- [ ] [✕] removes file; list updates immediately.
- [ ] "Add another file" disappears at 5 files.
- [ ] Session name auto-fills from first file; manual edits are not overwritten.
- [ ] DPP runs correctly on concatenated markdown from 2 files.
- [ ] Blocks do not span the file sentinel boundary.
- [ ] `block.sourceFileIds` correctly reflects single vs multi-file origin.
- [ ] Slow scope selector appears only for multi-file sessions.
- [ ] Slow scope selector correctly filters sections by file.
- [ ] Legacy single-file sessions load without errors (`files` guard).

---

## 12. Open questions for Cursor before implementing

1. Where exactly in `session.js` does block packing read chunk boundaries? Confirm the entry point so the sentinel can be inserted at the right level.
2. Does `normalization/index.js` return a structured chunk array, or a flat markdown string? If flat string, the `SourceMap` approach (by char offset, not chunk index) may need adjustment.
3. Does `screenCreateSessionStart` use a dedicated JS module or is it wired directly in `study.js`? Identify the confirm handler to know where `File[]` is passed in.
4. For `screenSlowScope`, how are sections currently extracted from the markdown? Confirm whether the `<!-- source -->` sentinel will survive the section extraction pipeline unmodified.
