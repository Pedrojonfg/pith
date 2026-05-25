# Contract: LLM Chat Adapter

**Module**: `src/js/api.js` (or `src/js/llm.js` re-exported)

## `resolveLlmContext(options?)`

| Param | Type | Default |
|-------|------|---------|
| `llmModel` | `"deepseek" \| "gemini-2.5-flash"` | From `active_session._meta.llm_model`, else `"deepseek"` |

**Returns**: `{ llmModel, apiKey, chatCompletionsUrl, apiModel }`

**Throws**: `Error` with user-facing message if API key missing for resolved model.

### Provider table (v1)

| `llmModel` | `chatCompletionsUrl` | `apiModel` | localStorage key |
|------------|----------------------|------------|------------------|
| `deepseek` | `DS_CHAT_COMPLETIONS_URL` | `deepseek-chat` | `LS_KEY` |
| `gemini-2.5-flash` | `GEMINI_OPENAI_CHAT_URL` | `gemini-2.5-flash` | `LS_GEMINI_KEY` |

`GEMINI_OPENAI_CHAT_URL` constant in `config.js`:
`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`

---

## `llmChatCompletions({ llmModel?, messages, temperature?, max_tokens?, response_format? })`

**Behavior**:

1. `const ctx = resolveLlmContext({ llmModel })`
2. `POST ctx.chatCompletionsUrl` with body:

```json
{
  "model": "<ctx.apiModel>",
  "messages": [],
  "temperature": 0.2,
  "max_tokens": 800,
  "response_format": { "type": "json_object" }
}
```

(`response_format` omitted when not passed.)

3. Headers: `Authorization: Bearer ${ctx.apiKey}`, `Content-Type: application/json`
4. On `!res.ok`: throw `Error(apiMsg)` with `err.status = res.status` (preserve today)
5. Return `choices[0].message.content` trimmed string

**Consumers** (must migrate to this contract):

- Block split, block JSON, assessment, gap synthesis, socratic tutor, summary, audit, post-merge, review batch, review socratic
- `guide-chat.js` (2 call sites)
- `review.js` (via api exports)

---

## Session binding

Callers that run **inside an active study session** MUST NOT pass `llmModel` override unless testing — use session `_meta.llm_model`.

Callers before session exists (none today) use explicit param or default `deepseek`.

---

## Error messages (normative)

| Condition | Message pattern |
|-----------|-----------------|
| Missing DeepSeek key | `Missing DeepSeek API key. Open API setup to add it.` |
| Missing Gemini key | `Missing Gemini API key. Open API setup to add it.` |
| HTTP error | Provider `error.message` or status text (unchanged) |

---

## Non-goals (v1)

- Automatic retry on DeepSeek 503 with Gemini
- Per-request model override in UI mid-session
- Streaming responses
