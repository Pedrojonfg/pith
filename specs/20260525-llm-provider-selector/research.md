# Research: Multi-LLM Provider Selector

## R1 — Gemini API integration shape

**Decision**: Use Google’s **OpenAI-compatible** Chat Completions endpoint for `gemini-2.5-flash`.

**Rationale**: Same request/response shape as DeepSeek (`messages`, `model`, `temperature`, `max_tokens`, `response_format: { type: "json_object" }`). Minimizes adapter code and keeps Flutter-portable session metadata (`llm_model` enum only).

**Details**:

| Field | DeepSeek | Gemini 2.5 Flash |
|-------|----------|------------------|
| Base URL | `https://api.deepseek.com/v1/chat/completions` | `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` |
| Model id | `deepseek-chat` | `gemini-2.5-flash` |
| Auth | `Bearer ${deepseekApiKey}` | `Bearer ${geminiApiKey}` |

**Alternatives considered**:

- Native `generateContent` REST — rejected (second parser path, more refactor).
- OpenRouter — rejected (out of spec v1).
- Gemini Flash-Lite — rejected (user chose 2.5 Flash).

**Reference**: [Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai)

---

## R2 — Central chat adapter vs. per-call fork

**Decision**: Add **`llmChatCompletions()`** in `api.js` (or `src/js/llm.js` if `api.js` grows too large) as the single HTTP entry for all generation/tutor calls. Existing `deepSeek*` exports become thin wrappers or are renamed internally to `llm*` while keeping export aliases during migration.

**Rationale**: ~15 `fetch(DS_CHAT_COMPLETIONS_URL)` call sites today; duplicating URL/key resolution in each violates surgical maintenance. One resolver function matches “reuse existing functions” from `.cursorrules`.

**Alternatives considered**:

- Copy-paste URL switch per function — rejected (error-prone).
- Dynamic import per provider — rejected (unnecessary).

---

## R3 — Credential storage & migration

**Decision**:

- Keep `LS_KEY` (`ds_api_key`) for DeepSeek; no rename required for existing users.
- Add `LS_GEMINI_KEY` = `gemini_api_key`.
- API setup screen: two password fields, both save independently.

**Rationale**: FR-002 and SC-004 (transparent migration).

**Alternatives considered**:

- Single JSON blob in localStorage — rejected (harder to edit one key in DevTools).

---

## R4 — Session model selection persistence

**Decision**: On new session start (submit `generateBlocksForm`), write `active_session._meta.llm_model` = `"deepseek"` | `"gemini-2.5-flash"` before first API call. Resume uses stored value; dropdown not shown on resume path.

**Rationale**: Matches clarify Q1; locks provider for assessment, gap synthesis, block gen, socratic, review in that session.

---

## R5 — Guide chat & review routing

**Decision**: `guide-chat.js` and `review.js` resolve LLM via **`resolveLlmContext()`**: active session’s `_meta.llm_model` if `active_session` exists, else `"deepseek"`.

**Rationale**: Clarify Q2 answer A.

---

## R6 — Service worker / CORS

**Decision**: Extend `sw.js` fetch allowlist with host `generativelanguage.googleapis.com` (same pattern as `api.deepseek.com`).

**Rationale**: App may be served with SW; blocked Gemini calls would break fallback silently in production-like setups.

---

## R7 — JSON mode on Gemini

**Decision**: Pass `response_format: { type: "json_object" }` unchanged for split, block JSON, assessment, gap synthesis. Validate in quickstart; on parse failure show existing retry UX (no auto provider switch).

**Rationale**: Google documents JSON object mode on OpenAI-compat layer; if a specific call fails, treat as provider error message, not silent fallback.

**Risk**: Occasional markdown fences from Gemini — existing `parseModelJsonValue` already tolerates some noise; document in quickstart.

---

## R8 — UI copy & validation

**Decision**:

- Dropdown on **Create a study session** (`#generateBlocksForm`), label “Model”, options “DeepSeek (default)” / “Gemini 2.5 Flash”.
- If Gemini selected and no `gemini_api_key`, block submit with inline error (mirror DeepSeek missing-key pattern).
- Status strings: generic “Calling model…” or include provider name for debugging.

**Alternatives considered**:

- Model selector on API setup — rejected (user asked before session start).
