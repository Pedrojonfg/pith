# Contract: Session LLM UI & Persistence

## API setup screen (`#screenApiSetup`)

| Element | ID (proposed) | Behavior |
|---------|---------------|----------|
| DeepSeek key | `apiKeyInput` (keep) | Saves to `LS_KEY` on submit |
| Gemini key | `geminiApiKeyInput` (new) | Saves to `LS_GEMINI_KEY`; not required for submit |
| Heading/copy | — | Mention both providers; DeepSeek required to enter app |

**Gate**: Existing flow — require DeepSeek key to leave setup (unchanged). Gemini optional until user selects Gemini for a session.

---

## Create session form (`#generateBlocksForm`)

| Element | ID (proposed) | Behavior |
|---------|---------------|----------|
| Model dropdown | `llmModelSelect` | Options: `deepseek` (default), `gemini-2.5-flash` |
| Validation | — | On submit: if value is `gemini-2.5-flash` and no Gemini key → show `#generateBlocksError`, abort |

**Persistence timing**: When session object is first created for this run, set `_meta.llm_model` from dropdown value before `deepSeekSplitIntoBlocks` / `llmSplitIntoBlocks`.

---

## Resume session

- No dropdown.
- All API calls use `active_session._meta.llm_model`.

---

## Guide chat (`guide-chat.js`)

- Before fetch: `resolveLlmContext()` (session-aware).
- Error strings reference active provider name.

---

## Review session (`review.js`)

- Same as guide chat: session `llm_model` drives review batch + socratic tutor calls.

---

## Offline mode

- Hide or disable `#llmModelSelect` when offline pack loaded (same as blocking generate API).

---

## Status copy

Replace hard-coded “Calling DeepSeek…” with `Calling ${displayName}…` where `displayName` ∈ { `DeepSeek`, `Gemini` } derived from `llm_model`.
