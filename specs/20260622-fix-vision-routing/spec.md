# Feature Specification: Fix Vision Analysis Routing

**Feature ID**: `20260622-fix-vision-routing`  
**Status**: Approved  
**Priority**: A — HTTP 400 errors on PDFs with images; vision enrichment silently lost  
**Created**: 2026-06-22

## Problem

`document-images/vision.js` routes multimodal image analysis through `llmChatCompletionsMultimodal`, which always targets DeepSeek. DeepSeek is text-only and rejects `image_url` content blocks with HTTP 400. DPP continues (fire-and-forget) but console errors accumulate and vision descriptions plus `EXEMPLIFIES` graph edges are lost.

The document-image-ingestion spec intended Gemini for vision and DeepSeek for text. Implementation wired vision to the session LLM (DeepSeek).

## User Scenarios & Testing

### User Story 1 — PDF with embedded images (P1)

A student uploads a PDF containing diagrams. DPP vision analysis succeeds without DeepSeek 400 errors; descriptions and concept links populate.

**Acceptance**:

1. Zero `api.deepseek.com` requests with `image_url` content during vision phase.
2. Vision requests go to `generativelanguage.googleapis.com`.
3. Successful analysis sets `visionStatus: ready` and may add `EXEMPLIFIES` edges.

### User Story 2 — Missing Gemini key (P1)

User has DeepSeek key but no Gemini key. DPP completes; vision skipped gracefully.

**Acceptance**:

1. Single `[vision] Gemini API key not configured` warning per upload session.
2. No thrown errors; `visionStatus` remains `failed` or `skipped` for pending images.
3. DPP does not halt.

### User Story 3 — Text-only PDF (P2)

No images → no vision network calls.

## Requirements

### Functional Requirements

- **FR-001**: Vision LLM calls MUST use hardcoded Gemini OpenAI-compatible endpoint and `gemini-2.0-flash` model — never session `llmModel` / DeepSeek.
- **FR-002**: Vision MUST NOT use `llm.js` generic `callLLM` / `llmChatCompletionsMultimodal` wrappers (direct `fetch` in vision module).
- **FR-003**: Read Gemini API key via `getStoredGeminiKey()` (`LS_GEMINI_KEY` / `gemini_api_key`). If absent, skip all vision for the upload with one warning per session.
- **FR-004**: `max_tokens: 512`, `temperature: 0` on vision requests.
- **FR-005**: Non-200 Gemini responses per image: log warning, return null for that image; do not block other images or DPP.
- **FR-006**: No fallback path that sends image content to DeepSeek.
- **FR-007**: Preserve image IDs, extraction, markdown injection, and concept-graph linking logic (JSON vision response with description + concept matches).

### Non-Goals

- Settings toggle for vision model
- Changes to PDF/HTML image extraction
- Retry logic for failed Gemini calls
- Vision for non-PDF formats in this fix

## Assumptions

- Vision module path is `src/js/document-images/vision.js` (not `src/js/vision.js`).
- Signed Supabase image URLs remain valid for Gemini `image_url` input (no base64 refactor required).
- JSON response format for concept matching is retained to preserve `EXEMPLIFIES` edges (plain-text-only prompt from draft spec adapted to include JSON return contract).

## Success Criteria

- PDF with images: no DeepSeek 400 errors related to vision during DPP.
- PDF with images + Gemini key: network shows Gemini vision requests; at least one image reaches `visionStatus: ready` when Gemini succeeds.
- Missing Gemini key: one warning, DPP completes.
- Text-only upload: zero Gemini vision requests.
