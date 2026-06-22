# Spec: Fix Vision Analysis Routing

**ID:** `20260622-fix-vision-routing`  
**Status:** Approved  
**Priority:** A — Urgent & Important (causes HTTP 400 errors that interrupt DPP on any PDF with images)  
**Supersedes:** none  
**Dependencies:** none (standalone fix)

---

## Problem Statement

`vision.js` calls the image vision analysis endpoint using the session's configured LLM model, which is DeepSeek. DeepSeek does **not** support multimodal input — it is a text-only model. When it receives a message containing `{"type": "image_url", ...}` content blocks, it returns HTTP 400 with:

```
Failed to deserialize the JSON body into the target type:
messages[0]: unknown variant `image_url`, expected `text`
```

This error fires once per image in the document. For a PDF with 2 embedded images, 2 errors appear. The DPP does not halt (vision is fire-and-forget), but the errors pollute the console and all image-derived data (vision descriptions, `EXEMPLIFIES` edges into the concept graph) is lost silently.

The spec `20260620-document-image-ingestion` correctly designed vision to use **Gemini** for image analysis and DeepSeek for everything else. The implementation wired it incorrectly.

---

## Architecture Clarification (for Cursor)

The correct data flow for image analysis is:

```
PDF upload
  → normalization/pdf-loader.js: extract image blobs
  → vision.js: runImageVisionAnalysis(imageBlob)
      → [THIS CALL MUST GO TO GEMINI, NOT DEEPSEEK]
      → returns: plain-text description of the image
  → description injected into rawMarkdown as a text annotation
  → DeepSeek processes the enriched markdown (text only) normally
```

Gemini's OpenAI-compatible endpoint accepts `image_url` content blocks with base64 `data:` URIs. This is exactly the format `vision.js` already constructs. The only change needed is the **endpoint URL and auth header** — not the message format.

---

## Rules

### R1 — Vision calls always route to Gemini, never to DeepSeek

In `vision.js`, the function that makes the LLM call for image analysis must use a **hardcoded** Gemini endpoint, ignoring the session's `llm_model` setting. This is not a user-configurable option — it is a technical requirement because DeepSeek has no vision capability.

### R2 — Endpoint and auth

```javascript
const GEMINI_VISION_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const GEMINI_VISION_MODEL = 'gemini-2.0-flash';
```

Auth header: `Authorization: Bearer ${geminiApiKey}` — same pattern used by existing Gemini calls in `llm.js`.

Do NOT use `llm.js`'s generic `callLLM` or equivalent wrapper for this call. Make the `fetch` directly in `vision.js` with the hardcoded endpoint and model. This prevents any future change to the session LLM model from accidentally re-breaking vision routing.

### R3 — Read Gemini API key from config, fail gracefully if absent

```javascript
// At the top of runImageVisionAnalysis (or its caller):
const geminiApiKey = localStorage.getItem('gemini_api_key'); // verify exact key name against config.js
if (!geminiApiKey) {
  console.warn('[vision] Gemini API key not configured — skipping image analysis for this upload.');
  return null; // caller must handle null gracefully
}
```

This warning must fire **once per upload session**, not once per image. Use a module-level flag (e.g. `let _visionKeyWarningShown = false`) to suppress duplicate warnings.

If the key is absent: vision is skipped for all images in this upload. DPP continues normally. No error is thrown. No user-facing message is required at this stage.

### R4 — Vision model is hardcoded to `gemini-2.0-flash`

`gemini-2.0-flash` is the cheapest Gemini model with vision capability. It is appropriate for the task: generating a 2–4 sentence plain-text description of a diagram or figure. Do not use `gemini-2.5-pro` or any preview model.

This is **not** configurable via the Settings `#llmModelSelect` — that selector controls the session's primary LLM (DeepSeek variants) and must not be coupled to vision routing.

### R5 — System prompt for vision call

```javascript
const VISION_SYSTEM_PROMPT =
  'You analyze images found in academic study documents. ' +
  'Describe the image concisely for a learner who cannot see it. ' +
  'State: (1) what type of content this is (diagram, chart, equation, photograph, table, etc.), ' +
  '(2) what concept or information it conveys, and ' +
  '(3) any key labels, values, or relationships visible. ' +
  'Plain text only. No markdown. Maximum 4 sentences.';
```

### R6 — Request parameters

```javascript
{
  model: GEMINI_VISION_MODEL,          // 'gemini-2.0-flash'
  max_tokens: 512,                      // sufficient for 4 sentences; keep cost minimal
  temperature: 0,                       // deterministic description
  messages: [
    { role: 'system', content: VISION_SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64Data}` }
        },
        {
          type: 'text',
          text: 'Describe this image for a student studying this document.'
        }
      ]
    }
  ]
}
```

`mimeType` and `base64Data` are already produced by the existing image extraction pipeline — do not change how images are extracted, only how they are analyzed.

### R7 — Non-200 responses from Gemini are silent failures

If Gemini returns any non-200 status for a specific image:
```javascript
console.warn(`[vision] ${imageId} Gemini vision failed with status ${response.status} — skipping.`);
return null;
```

Vision failure for one image must never block DPP progress for the rest of the document. Each image is analyzed independently; a failure on `img_0002` does not affect `img_0003`.

### R8 — Preserve existing image IDs and injection logic

The functions that assign image IDs (`img_0001`, `img_0002`, …), extract image blobs from PDFs, and inject vision descriptions back into the markdown — leave all of that unchanged. This spec only modifies the LLM call inside `runImageVisionAnalysis` (or equivalent function name — Cursor should verify the exact function name in `vision.js`).

### R9 — Remove or guard the old DeepSeek vision call path

After adding the Gemini path, verify there is no remaining code path in `vision.js` that can reach `api.deepseek.com` with image content. If a fallback to DeepSeek exists anywhere, remove it. A failed vision call (R7) must return `null`, not fall back to a text-only DeepSeek call with the image stripped out.

---

## Non-Goals

- Do NOT add a Settings toggle for vision model selection.
- Do NOT change how images are extracted from PDFs or HTML.
- Do NOT change how vision descriptions are injected into the markdown (the downstream side of the pipeline).
- Do NOT implement vision for non-PDF formats in this spec.
- Do NOT add retry logic for the Gemini vision call — one attempt per image is sufficient given the low stakes of vision enrichment.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/js/vision.js` | Replace DeepSeek endpoint with Gemini endpoint and model; add missing-key guard; hardcode system prompt and `max_tokens` |

**Cursor:** Confirm the exact function name in `vision.js` that makes the LLM call (logs show `runImageVisionAnalysis`). Also confirm which config key stores the Gemini API key — cross-reference `config.js` and `llm.js` where Gemini is already used for embeddings. Use the same key name.

---

## Cost Impact

Gemini 2.0 Flash pricing (approximate, verify current rates):
- Input: ~$0.075 per million tokens
- Image: ~$0.001–0.002 per image

For a 27-page PDF with 5 images: < $0.01 total for vision analysis. This is negligible.

---

## Implementation Sequence

1. Locate the exact LLM call in `vision.js`. Identify the current endpoint and model being used.
2. Identify the Gemini API key storage key from `config.js` or `llm.js`.
3. Add the `GEMINI_VISION_ENDPOINT` and `GEMINI_VISION_MODEL` constants.
4. Add the missing-key guard (R3).
5. Replace the LLM call body with the Gemini-targeted fetch (R2, R5, R6).
6. Add non-200 handling (R7).
7. Verify no remaining path reaches DeepSeek with image content (R9).

---

## Testing Checklist

- [ ] Upload a PDF that contains at least one embedded image or diagram. Verify **zero** `api.deepseek.com` 400 errors in the console related to vision.
- [ ] Verify that requests to `generativelanguage.googleapis.com` appear in DevTools Network during DPP for that upload.
- [ ] Verify that `[vision] img_0001` log entry shows success (not the 400 error from DeepSeek).
- [ ] Remove the Gemini API key from Settings temporarily. Upload a PDF with images. Verify: (a) single `[vision] Gemini API key not configured` warning appears, (b) DPP completes normally without throwing, (c) no 400 errors.
- [ ] Upload a text-only PDF (no images). Verify that no vision calls are made at all (no network requests to Gemini during DPP).
- [ ] Verify the concept graph still receives `EXEMPLIFIES` edges after a successful vision call (the downstream injection logic was not broken by this change).
