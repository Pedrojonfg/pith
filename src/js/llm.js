import {
  DS_CHAT_COMPLETIONS_URL,
  GEMINI_OPENAI_CHAT_URL,
  LS_ACTIVE_SESSION_KEY,
  LS_DEFAULT_LLM_MODEL_KEY,
  LS_GEMINI_KEY,
  LS_KEY,
} from "./config.js?v=20260525_1";

export const LLM_MODEL_DEEPSEEK = "deepseek";
export const LLM_MODEL_GEMINI = "gemini-2.5-flash";
export const DEFAULT_LLM_MODEL = LLM_MODEL_DEEPSEEK;

const PROVIDERS = {
  [LLM_MODEL_DEEPSEEK]: {
    displayName: "DeepSeek",
    chatCompletionsUrl: DS_CHAT_COMPLETIONS_URL,
    apiModel: "deepseek-chat",
    storageKey: LS_KEY,
  },
  [LLM_MODEL_GEMINI]: {
    displayName: "Gemini 2.5 Flash",
    chatCompletionsUrl: GEMINI_OPENAI_CHAT_URL,
    apiModel: "gemini-2.5-flash",
    storageKey: LS_GEMINI_KEY,
  },
};

export function normalizeLlmModel(value) {
  const v = String(value || "").trim();
  if (v === LLM_MODEL_GEMINI) return LLM_MODEL_GEMINI;
  return LLM_MODEL_DEEPSEEK;
}

export function getLlmDisplayName(llmModel) {
  const id = normalizeLlmModel(llmModel);
  return PROVIDERS[id]?.displayName || "DeepSeek";
}

export function getLlmCallingLabel(llmModel) {
  return `Calling ${getLlmDisplayName(llmModel)}…`;
}

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

export function getApiKeyForLlmModel(llmModel) {
  const id = normalizeLlmModel(llmModel);
  const storageKey = PROVIDERS[id]?.storageKey || LS_KEY;
  try {
    const v = localStorage.getItem(storageKey);
    if (!v) return null;
    const trimmed = v.trim();
    return trimmed.length ? trimmed : null;
  } catch {
    return null;
  }
}

export function assertLlmKeyPresent(llmModel) {
  const id = normalizeLlmModel(llmModel);
  const key = getApiKeyForLlmModel(id);
  if (key) return key;
  if (id === LLM_MODEL_GEMINI) {
    throw new Error("Missing Gemini API key. Open Settings to add it.");
  }
  throw new Error("Missing DeepSeek API key. Open Settings to add it.");
}

export function getDefaultLlmModel() {
  try {
    const v = localStorage.getItem(LS_DEFAULT_LLM_MODEL_KEY);
    if (v) return normalizeLlmModel(v);
  } catch {
    // ignore
  }
  return DEFAULT_LLM_MODEL;
}

export function saveDefaultLlmModel(model) {
  localStorage.setItem(LS_DEFAULT_LLM_MODEL_KEY, normalizeLlmModel(model));
}

export function getActiveSessionLlmModel() {
  try {
    const raw = localStorage.getItem(LS_ACTIVE_SESSION_KEY);
    if (!raw) return DEFAULT_LLM_MODEL;
    const session = JSON.parse(raw);
    return normalizeLlmModel(session?._meta?.llm_model);
  } catch {
    return DEFAULT_LLM_MODEL;
  }
}

export function getSessionLlmModel(session) {
  if (!session || typeof session !== "object") return DEFAULT_LLM_MODEL;
  return normalizeLlmModel(session?._meta?.llm_model);
}

export function resolveLlmContext({ llmModel } = {}) {
  const id = normalizeLlmModel(llmModel ?? getActiveSessionLlmModel());
  const provider = PROVIDERS[id];
  const apiKey = getApiKeyForLlmModel(id);
  if (!apiKey) {
    if (id === LLM_MODEL_GEMINI) {
      throw new Error("Missing Gemini API key. Open API setup to add it.");
    }
    throw new Error("Missing DeepSeek API key. Open API setup to add it.");
  }
  return {
    llmModel: id,
    apiKey,
    chatCompletionsUrl: provider.chatCompletionsUrl,
    apiModel: provider.apiModel,
    displayName: provider.displayName,
  };
}

/**
 * OpenAI-compatible chat completions for DeepSeek or Gemini.
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
