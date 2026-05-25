# Data Model: Multi-LLM Provider Selector

## localStorage (browser)

| Key | Constant | Type | Description |
|-----|----------|------|-------------|
| `ds_api_key` | `LS_KEY` (existing) | string | DeepSeek API key |
| `gemini_api_key` | `LS_GEMINI_KEY` (new) | string | Google AI Studio / Gemini API key |

**Migration**: Existing users retain `ds_api_key` only; no automatic copy.

## Session metadata

### `_meta.llm_model` (persisted on new session)

| Value | Provider | API model id |
|-------|----------|--------------|
| `deepseek` | DeepSeek | `deepseek-chat` |
| `gemini-2.5-flash` | Google Gemini | `gemini-2.5-flash` |

**Set when**: First successful path into new session creation (on `generateBlocksForm` submit, before split API call). Copied into `active_session` JSON in localStorage.

**Default**: `deepseek` if field absent (legacy sessions).

**Immutable for session**: Changing dropdown does not alter an in-flight saved session until user starts a **new** session.

## Ephemeral UI state

| Symbol | Purpose |
|--------|---------|
| `#llmModelSelect` (proposed) | Dropdown on create-session form; default `deepseek` |
| `window` / module state | Optional mirror before `_meta` written |

## Resolved runtime context (not persisted)

```typescript
// Conceptual — implementation in JS
type LlmModelId = "deepseek" | "gemini-2.5-flash";

interface LlmRequestContext {
  llmModel: LlmModelId;
  apiKey: string;
  chatCompletionsUrl: string;
  apiModel: string; // deepseek-chat | gemini-2.5-flash
}
```

Produced by `resolveLlmContext({ llmModel? })`:

1. If `llmModel` omitted → read `active_session._meta.llm_model` → else `"deepseek"`.
2. Map to URL + `apiModel` + read correct localStorage key.
3. Throw typed error if key missing (message names provider).

## Validation rules

- `llm_model` must be one of the two enum values when present.
- Gemini path: `gemini_api_key` non-empty before any API call for that session.
- DeepSeek path: `ds_api_key` non-empty (unchanged).
- Offline pack / offline mode: no `llm_model` selector; no API calls.

## State transitions

```text
[API setup]
  → save ds_api_key (optional gemini_api_key)

[Create session form]
  → user selects llm in dropdown (default deepseek)
  → submit → validate keys for selection
  → init session skeleton with _meta.llm_model
  → all API calls use resolveLlmContext(session)

[Resume session]
  → use stored _meta.llm_model (no dropdown)

[Guide chat / Review]
  → resolveLlmContext() from active_session
  → if no session: deepseek + ds_api_key
```

## Relationships

```text
ProviderCredentials ──► resolveLlmContext()
Session._meta.llm_model ──► resolveLlmContext()
resolveLlmContext() ──► llmChatCompletions() ──► all api.js generators
resolveLlmContext() ──► guide-chat.js, review.js
```

## Export / offline pack

- Optional: include `llm_model` in exported session header for debugging (non-blocking for v1).
- Offline packs: unchanged; no provider metadata required.
