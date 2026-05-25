# Quickstart: Multi-LLM Provider Selector

## Prerequisites

- DeepSeek API key (required for default flow).
- Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) (only for Gemini path).
- Online mode (not offline pack).

## Setup both keys

1. Open `index.html` → API setup.
2. Save **DeepSeek** key (existing field).
3. Save **Gemini** key (new field) — optional until you test Gemini.

## Happy path — DeepSeek (regression)

1. Create session → leave model dropdown on **DeepSeek (default)**.
2. Upload PDF/TXT, generate blocks, confirm, study one block.
3. DevTools → Network: requests go to `api.deepseek.com`, model `deepseek-chat`.

## Happy path — Gemini fallback

1. Ensure Gemini key saved.
2. Create **new** session → select **Gemini 2.5 Flash**.
3. Generate blocks (same material as before is fine).
4. Network: `generativelanguage.googleapis.com/.../openai/chat/completions`, model `gemini-2.5-flash`.
5. Complete confirm + optional assessment + start studying.

## Simulate DeepSeek busy

1. Session A with DeepSeek → if API returns “Service is too busy”, note error message.
2. Create **new** session B → choose Gemini → generate blocks → should succeed without re-uploading keys beyond Gemini field.

## Guide chat & review (session model A)

1. Session generated with **Gemini** active.
2. Open guide chat, ask a question → request uses Gemini endpoint.
3. Finish session → **Review session** → generated questions use Gemini.

## Resume session

1. Save mid-session, reload page → **Resume session**.
2. New API calls (e.g. regenerate block, socratic) use stored `_meta.llm_model`, not dropdown.

## Inspect state (DevTools)

```js
localStorage.getItem('ds_api_key') ? 'deepseek key ok' : 'missing'
localStorage.getItem('gemini_api_key') ? 'gemini key ok' : 'missing'
JSON.parse(localStorage.getItem('active_session'))?._meta?.llm_model
```

## Validation checklist

| # | Check |
|---|--------|
| 1 | Missing Gemini key + Gemini dropdown → blocked before network |
| 2 | Legacy session without `llm_model` → behaves as DeepSeek |
| 3 | Offline pack → no model dropdown, no Gemini/DeepSeek calls |
| 4 | JSON split + block gen work on Gemini (no parse error loop) |
| 5 | Export .md still downloads after session on either model |

## Failure notes

- Gemini occasional markdown wrappers → retry generate; check `parseModelJsonValue` output in console.
- SW cache: if Gemini fails only when served via `file://` or custom host, verify `sw.js` allows `generativelanguage.googleapis.com`.
