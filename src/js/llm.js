import {
  DS_CHAT_COMPLETIONS_URL,
  LS_GEMINI_KEY,
  LS_KEY,
} from "./config.js?v=20260622_6";

export const LLM_MODEL_DEEPSEEK = "deepseek";
export const DEFAULT_LLM_MODEL = LLM_MODEL_DEEPSEEK;

/** Chat always uses DeepSeek. Gemini key is for embeddings only (vault/embeddings.js). */
export function normalizeLlmModel(_value) {
  return LLM_MODEL_DEEPSEEK;
}

export function getLlmDisplayName(_llmModel) {
  return "DeepSeek";
}

export function getLlmCallingLabel(_llmModel) {
  return "Calling DeepSeek…";
}

/** Gemini API key — used only by vault/embeddings.js, not chat. */
export function getStoredGeminiKey() {
  try {
    const v = localStorage.getItem(LS_GEMINI_KEY);
    if (!v) return null;
    const trimmed = v.trim();
    return trimmed.length ? trimmed : null;
  } catch {
    return null;
  }
}

export function saveGeminiKey(key) {
  localStorage.setItem(LS_GEMINI_KEY, String(key || "").trim());
}

export function getApiKeyForLlmModel(_llmModel) {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (!v) return null;
    const trimmed = v.trim();
    return trimmed.length ? trimmed : null;
  } catch {
    return null;
  }
}

export function assertLlmKeyPresent(_llmModel) {
  const key = getApiKeyForLlmModel();
  if (key) return key;
  throw new Error("Missing DeepSeek API key. Open Settings to add it.");
}

export function getDefaultLlmModel() {
  return DEFAULT_LLM_MODEL;
}

/** @deprecated Model selection removed — chat always uses DeepSeek. */
export function saveDefaultLlmModel(_model) {
  // no-op
}

export function getActiveSessionLlmModel() {
  return DEFAULT_LLM_MODEL;
}

export function getSessionLlmModel(_session) {
  return DEFAULT_LLM_MODEL;
}

export function resolveLlmContext({ llmModel } = {}) {
  const id = normalizeLlmModel(llmModel);
  const apiKey = getApiKeyForLlmModel();
  if (!apiKey) {
    throw new Error("Missing DeepSeek API key. Open API setup to add it.");
  }
  return {
    llmModel: id,
    apiKey,
    chatCompletionsUrl: DS_CHAT_COMPLETIONS_URL,
    apiModel: "deepseek-chat",
    displayName: "DeepSeek",
  };
}

/**
 * OpenAI-compatible chat completions via DeepSeek.
 */
export async function llmChatCompletions({
  llmModel,
  messages,
  temperature = 0.2,
  max_tokens,
  response_format,
  signal,
} = {}) {
  const ctx = resolveLlmContext({ llmModel });
  const body = {
    model: ctx.apiModel,
    messages,
    temperature,
  };
  if (max_tokens != null) body.max_tokens = max_tokens;
  if (response_format) body.response_format = response_format;

  const res = await fetch(ctx.chatCompletionsUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // handled below
  }

  if (!res.ok) {
    const apiMsg =
      data?.error?.message || data?.message || `Request failed with status ${res.status}.`;
    const err = new Error(apiMsg);
    err.status = res.status;
    throw err;
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Unexpected API response (missing message content).");
  }
  return content.trim();
}

/**
 * Multimodal chat completions (text + image_url parts) via DeepSeek.
 * @param {object} opts
 */
export async function llmChatCompletionsMultimodal({
  llmModel,
  messages,
  temperature = 0.2,
  max_tokens,
  response_format,
  signal,
} = {}) {
  const ctx = resolveLlmContext({ llmModel });
  const body = {
    model: ctx.apiModel,
    messages,
    temperature,
  };
  if (max_tokens != null) body.max_tokens = max_tokens;
  if (response_format) body.response_format = response_format;

  const res = await fetch(ctx.chatCompletionsUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // handled below
  }

  if (!res.ok) {
    const apiMsg =
      data?.error?.message || data?.message || `Request failed with status ${res.status}.`;
    const err = new Error(apiMsg);
    err.status = res.status;
    throw err;
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Unexpected API response (missing message content).");
  }
  return content.trim();
}
