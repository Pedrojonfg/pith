import { SUPABASE_URL } from "./config/supabase.js";
import { supabase } from "./supabase-client.js";

export const LLM_MODEL_DEEPSEEK = "deepseek";
export const DEFAULT_LLM_MODEL = LLM_MODEL_DEEPSEEK;

const PROXY_URL = `${SUPABASE_URL}/functions/v1/llm-proxy`;

/** Sync cache for legacy getApiKeyForLlmModel() call sites — updated on auth events. */
let cachedAccessToken = null;

/**
 * @param {import('@supabase/supabase-js').Session | null} session
 */
export function syncPlatformLlmAccessFromSession(session) {
  const hadToken = Boolean(cachedAccessToken);
  const prevToken = cachedAccessToken;
  const nextToken = session?.access_token ?? null;
  const hasToken = Boolean(nextToken);
  cachedAccessToken = nextToken;
  // [debug-enrich]
  console.info('[llm.syncPlatformLlmAccessFromSession] Token cache synced:', {
    hadToken,
    hasToken,
    tokenChanged: prevToken !== nextToken,
    userId: session?.user?.id ?? null,
    expiresAt: session?.expires_at ?? null,
  });
  if (!hasToken) {
    // [debug-enrich]
    console.warn('[llm.syncPlatformLlmAccessFromSession] Cleared LLM access token — proxy calls will fail until re-auth');
  }
}

/**
 * @returns {Promise<string|null>}
 */
export async function getSupabaseAuthToken() {
  if (cachedAccessToken) {
    // [debug-enrich]
    console.debug('[llm.getSupabaseAuthToken] Cache hit');
    return cachedAccessToken;
  }
  // [debug-enrich]
  console.debug('[llm.getSupabaseAuthToken] Cache miss — fetching session');
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    // [debug-enrich]
    console.error('[llm.getSupabaseAuthToken] getSession failed:', {
      message: error.message,
      status: error.status ?? null,
    });
  }
  cachedAccessToken = session?.access_token ?? null;
  if (!cachedAccessToken) {
    // [debug-enrich]
    console.warn('[llm.getSupabaseAuthToken] No access token available', {
      hasSession: Boolean(session),
      userId: session?.user?.id ?? null,
    });
  } else {
    // [debug-enrich]
    console.info('[llm.getSupabaseAuthToken] Token resolved from session', {
      userId: session?.user?.id ?? null,
      expiresAt: session?.expires_at ?? null,
    });
  }
  return cachedAccessToken;
}

/**
 * @param {{ service: string, endpoint: string, body: object, signal?: AbortSignal }} opts
 */
const PROXY_RETRYABLE_STATUSES = new Set([429, 502, 503]);
const PROXY_MAX_RETRIES = 3;
const PROXY_RETRY_BASE_MS = 1500;

export async function callViaProxy(
  { service, endpoint, body, signal } = {},
  retryAttempt = 0,
) {
  const token = await getSupabaseAuthToken();
  if (!token) throw new Error("Not authenticated — cannot call LLM proxy.");

  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ service, endpoint, body }),
    signal,
  });

  if (!res.ok) {
    if (
      PROXY_RETRYABLE_STATUSES.has(res.status) &&
      retryAttempt < PROXY_MAX_RETRIES &&
      !signal?.aborted
    ) {
      const delay = PROXY_RETRY_BASE_MS * 2 ** retryAttempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return callViaProxy({ service, endpoint, body, signal }, retryAttempt + 1);
    }
    const err = await res.text().catch(() => "");
    const apiErr = new Error(`LLM proxy error ${res.status}: ${err.slice(0, 300)}`);
    apiErr.status = res.status;
    throw apiErr;
  }

  return res.json();
}

/** Chat always uses DeepSeek. Platform Gemini is for embeddings/vision only. */
export function normalizeLlmModel(_value) {
  return LLM_MODEL_DEEPSEEK;
}

export function getLlmDisplayName(_llmModel) {
  return "DeepSeek";
}

export function getLlmCallingLabel(_llmModel) {
  return "Calling DeepSeek…";
}

export function hasPlatformLlmAccess() {
  return Boolean(cachedAccessToken);
}

/** @deprecated BYOK removed — returns sentinel when authenticated. */
export function getApiKeyForLlmModel(_llmModel) {
  return cachedAccessToken ? "platform" : null;
}

export function assertLlmKeyPresent(_llmModel) {
  if (!cachedAccessToken) {
    throw new Error("Sign in to use AI features.");
  }
  return cachedAccessToken;
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

export async function resolveLlmContext({ llmModel } = {}) {
  const token = await getSupabaseAuthToken();
  if (!token) {
    throw new Error("Sign in to use AI features.");
  }
  const id = normalizeLlmModel(llmModel);
  return {
    llmModel: id,
    apiModel: "deepseek-chat",
    displayName: "DeepSeek",
  };
}

/**
 * OpenAI-compatible chat completions via DeepSeek (platform proxy).
 */
export async function llmChatCompletions({
  llmModel,
  messages,
  temperature = 0.2,
  max_tokens,
  response_format,
  signal,
} = {}) {
  const ctx = await resolveLlmContext({ llmModel });
  const body = {
    model: ctx.apiModel,
    messages,
    temperature,
  };
  if (max_tokens != null) body.max_tokens = max_tokens;
  if (response_format) body.response_format = response_format;

  const data = await callViaProxy({
    service: "deepseek",
    endpoint: "/v1/chat/completions",
    body,
    signal,
  });

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Unexpected API response (missing message content).");
  }
  return content.trim();
}

/**
 * Multimodal chat completions (text + image_url parts) via DeepSeek proxy.
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
  const ctx = await resolveLlmContext({ llmModel });
  const body = {
    model: ctx.apiModel,
    messages,
    temperature,
  };
  if (max_tokens != null) body.max_tokens = max_tokens;
  if (response_format) body.response_format = response_format;

  const data = await callViaProxy({
    service: "deepseek",
    endpoint: "/v1/chat/completions",
    body,
    signal,
  });

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Unexpected API response (missing message content).");
  }
  return content.trim();
}

/**
 * Gemini OpenAI-compatible chat via platform proxy (vision, etc.).
 * @param {object} opts
 */
export async function geminiChatCompletions({
  model,
  messages,
  temperature = 0,
  max_tokens,
  signal,
} = {}) {
  const token = await getSupabaseAuthToken();
  if (!token) return null;

  const body = { model, messages, temperature };
  if (max_tokens != null) body.max_tokens = max_tokens;

  const data = await callViaProxy({
    service: "gemini-chat",
    endpoint: "/v1beta/openai/chat/completions",
    body,
    signal,
  });

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    return { status: 200, content: null };
  }
  return { status: 200, content: content.trim() };
}

/**
 * Gemini native embed via platform proxy.
 * @param {object} body
 */
export async function geminiEmbedContent(body, { signal } = {}) {
  return callViaProxy({
    service: "gemini-embed",
    endpoint: "/v1beta/models/gemini-embedding-001:embedContent",
    body,
    signal,
  });
}
