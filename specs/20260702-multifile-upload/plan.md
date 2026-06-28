# Implementation Plan: Multi-File Upload

**Branch**: `20260702-multifile-upload` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)

## Summary

Add 1–5 file staging on create-session, concatenate normalized markdown with source sentinels, propagate mechanical `sourceFileIds` / `sourceFileId` through packing and item parsers, and add Slow scope file selector for multi-file sessions.

## Technical Context

**Language**: JavaScript (ES modules), PWA  
**Storage**: localStorage session-store  
**Testing**: cursor-tests/*.mjs  
**Target**: Browser offline-first study app

## Constitution Check

- UI: full-bleed screens, no new LLM on mnemonic paths (N/A)
- English internal strings
- SW_VERSION bump required for src/js + index.html changes

## Project Structure

```text
src/js/source-provenance.js          # NEW
src/js/input-normalization.js        # normalizeMultipleFiles
src/js/chunk-alignment.js            # boundary snap
src/js/session.js                    # block annotation
src/js/recall-api.js                 # recall sourceFileId
src/js/cloze/pipeline.js             # cloze sourceFileId
src/js/session-store.js              # uploadMeta.files
src/js/session-types.js              # validation
src/js/study.js                      # staging UI + flow
src/js/ui.js                         # DOM refs
index.html                           # staging markup
src/css/main.css                     # staging styles
```

## Implementation waves

1. **T01** `source-provenance.js` pure module  
2. **T02** Staging UI (index.html, css, ui.js, study.js state)  
3. **T03** `normalizeMultipleFiles` + read path  
4. **T04** Create-session Continue wires multi-file + `uploadMeta.files`  
5. **T05** Packing boundaries + `sourceFileIds` on blocks  
6. **T06** Recall + Cloze `sourceFileId`  
7. **T07** Slow scope file selector  
8. **T08** Tests + SW bump
