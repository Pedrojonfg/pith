# Implementation Plan: Fix Vision Analysis Routing

**Date**: 2026-06-22 | **Spec**: [spec.md](./spec.md)

## Summary

Replace DeepSeek multimodal routing in `document-images/vision.js` with a direct Gemini OpenAI-compatible `fetch`, hardcoded endpoint/model, missing-key guard, and per-image silent failure handling. Preserve JSON concept-matching response and downstream graph injection.

## Technical Context

| Item | Value |
|------|-------|
| Primary file | `src/js/document-images/vision.js` |
| Key helper | `getStoredGeminiKey()` from `llm.js` |
| Config | `LS_GEMINI_KEY` = `gemini_api_key` in `config.js` |
| Endpoint | `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` |
| Model | `gemini-2.0-flash` |
| Consumer | `document-preparation.js` → `runPhaseT17` |

## Constitution Check

- `max_tokens` constant with sizing comment (512, ~4 sentences JSON)
- No new LLM on mnemonic paths
- English prompts internal

## Phases

### Phase 1 — Gemini vision fetch primitive

Add module constants and `geminiVisionChat(messages, { max_tokens, temperature })`:
- Bearer auth with `getStoredGeminiKey()`
- Returns trimmed content string or `null` on missing key / non-200
- Module flag `_visionKeyWarningShown` for one warning per session

### Phase 2 — Rewire `analyzeDocumentImage`

- Remove `llmChatCompletionsMultimodal` import/usage
- Call `geminiVisionChat` with existing JSON prompt (concept inventory context)
- Log usage with `gemini-2.0-flash` model id
- Parse failures → throw or return null per existing caller expectations

### Phase 3 — Entry guard in `runImageVisionAnalysis`

- Early return `{ analyzed: 0, failed: N }` when no Gemini key (mark pending as failed or skip per spec: skip analysis, leave status — use failed count)
- Reset warning flag at start of each `runImageVisionAnalysis` call (per upload session)

### Phase 4 — Tests & SW bump

- `cursor-tests/20260622_fix-vision-routing.mjs` — endpoint constants, no DeepSeek import, key guard, fetch URL assembly
- Bump `SW_VERSION` if `src/js/**` changes

## Gates

- [x] No DeepSeek path with `image_url` remains in vision module
- [x] Existing concept graph linking unchanged
