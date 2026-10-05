import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsForbidden, corsHeaders, isUserAllowlisted } from "../_shared/proxy-guards.ts";

type LlmService = "deepseek" | "gemini-chat" | "gemini-embed";

/** Default: enough for a heavy DPP run; override via LLM_PROXY_MAX_PER_HOUR. */
const DEFAULT_MAX_PER_HOUR = 180;
const MAX_REQUEST_BODY_BYTES = 512_000;
const MAX_MAX_TOKENS = 32_768;

const DEFAULT_ALLOWED_MODELS = new Set([
  "deepseek-chat",
  "deepseek-reasoner",
  "gemini-3.5-flash",
  "gemini-embedding-001",
]);

function jsonResponse(body: unknown, status: number, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function parseMaxPerHour(): number {
  const raw = Deno.env.get("LLM_PROXY_MAX_PER_HOUR");
  const n = raw ? Number(raw) : DEFAULT_MAX_PER_HOUR;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_PER_HOUR;
}

function allowedModels(): Set<string> {
  const raw = (Deno.env.get("LLM_PROXY_ALLOWED_MODELS") ?? "").trim();
  if (!raw) return DEFAULT_ALLOWED_MODELS;
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

function isModelAllowed(model: string, service: LlmService): boolean {
  const m = String(model || "").trim();
  if (!m) return service === "gemini-embed";
  return allowedModels().has(m);
}

function buildTargetUrl(service: LlmService, endpoint: string, authKey: string): string {
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (path.includes("://") || path.includes("..")) {
    throw new Error("invalid endpoint");
  }
  if (service === "deepseek") {
    return `https://api.deepseek.com${path}`;
  }
  const base = `https://generativelanguage.googleapis.com${path}`;
  if (service === "gemini-embed") {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}key=${encodeURIComponent(authKey)}`;
  }
  return base;
}

function isAllowedEndpoint(service: LlmService, endpoint: string): boolean {
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (service === "deepseek") {
    return path === "/chat/completions" || path === "/v1/chat/completions";
  }
  if (service === "gemini-chat") {
    return path === "/v1beta/openai/chat/completions";
  }
  if (service === "gemini-embed") {
    const ok = /^\/v1beta\/models\/[a-zA-Z0-9._-]+:embedContent$/.test(path);
    if (!ok) return false;
    const model = path.match(/^\/v1beta\/models\/([a-zA-Z0-9._-]+):embedContent$/)?.[1] ?? "";
    return isModelAllowed(model.replace(/^models\//, ""), service);
  }
  return false;
}

function buildUpstreamHeaders(service: LlmService, authKey: string): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (service !== "gemini-embed") {
    headers.Authorization = `Bearer ${authKey}`;
  }
  return headers;
}

function validateLlmBody(service: LlmService, llmBody: unknown): string | null {
  if (typeof llmBody !== "object" || llmBody === null) {
    return "Bad Request: body must be an object";
  }
  const body = llmBody as Record<string, unknown>;
  const model = body.model != null ? String(body.model) : "";
  if (service !== "gemini-embed" && !isModelAllowed(model, service)) {
    return "Bad Request: model not allowed";
  }
  if (body.max_tokens != null) {
    const n = Number(body.max_tokens);
    if (!Number.isFinite(n) || n < 1 || n > MAX_MAX_TOKENS) {
      return `Bad Request: max_tokens must be 1..${MAX_MAX_TOKENS}`;
    }
  }
  return null;
}

serve(async (req) => {
  const corsBlock = corsForbidden(req);
  if (corsBlock) return corsBlock;

  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers });
  }

  const contentLength = Number(req.headers.get("Content-Length") || 0);
  if (contentLength > MAX_REQUEST_BODY_BYTES) {
    return new Response("Payload Too Large", { status: 413, headers });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401, headers });
  }
  const token = authHeader.replace("Bearer ", "");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401, headers });
  }

  if (!isUserAllowlisted(user.id)) {
    return new Response("Forbidden", { status: 403, headers });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const maxPerHour = parseMaxPerHour();
  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: rateErr } = await supabaseAdmin
    .from("llm_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("key_ownership", "platform")
    .gte("created_at", sinceIso);

  if (rateErr) {
    console.error("[llm-proxy.serve] Rate-limit check failed:", rateErr.message);
    return jsonResponse({ error: "rate_limit_unavailable" }, 503, req);
  }
  if ((recentCount ?? 0) >= maxPerHour) {
    return jsonResponse(
      { error: "rate_limited", maxPerHour, windowSeconds: 3600 },
      429,
      req,
    );
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BODY_BYTES) {
    return new Response("Payload Too Large", { status: 413, headers });
  }

  let payload: { service?: string; endpoint?: string; body?: unknown };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400, headers });
  }

  const service = payload.service as LlmService;
  const endpoint = String(payload.endpoint || "");
  const llmBody = payload.body;

  if (!service || !endpoint || llmBody == null) {
    return new Response("Bad Request: missing service, endpoint, or body", {
      status: 400,
      headers,
    });
  }

  if (!isAllowedEndpoint(service, endpoint)) {
    return new Response("Bad Request: endpoint not allowed", {
      status: 400,
      headers,
    });
  }

  const bodyErr = validateLlmBody(service, llmBody);
  if (bodyErr) {
    return new Response(bodyErr, { status: 400, headers });
  }

  let authKey: string;
  if (service === "deepseek") {
    authKey = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
  } else if (service === "gemini-chat" || service === "gemini-embed") {
    authKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  } else {
    return new Response("Bad Request: unknown service", { status: 400, headers });
  }

  if (!authKey) {
    return new Response("Server misconfiguration: missing API key secret", {
      status: 500,
      headers,
    });
  }

  let targetUrl: string;
  try {
    targetUrl = buildTargetUrl(service, endpoint, authKey);
  } catch {
    return new Response("Bad Request: invalid endpoint", { status: 400, headers });
  }

  const upstream = await fetch(targetUrl, {
    method: "POST",
    headers: buildUpstreamHeaders(service, authKey),
    body: JSON.stringify(llmBody),
  });

  const rawText = await upstream.text();
  let upstreamBody: Record<string, unknown> | null = null;
  try {
    upstreamBody = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    console.error("[llm-proxy.serve] Non-JSON upstream body:", {
      status: upstream.status,
      bodyPreview: rawText.slice(0, 500),
    });
  }

  const model =
    typeof llmBody === "object" && llmBody !== null && "model" in llmBody
      ? String((llmBody as { model?: unknown }).model ?? "")
      : null;
  const usage = upstreamBody?.usage as Record<string, unknown> | undefined;
  const inputTokens =
    (usage?.prompt_tokens as number | undefined) ??
    (usage?.input_tokens as number | undefined) ??
    null;
  const outputTokens =
    (usage?.completion_tokens as number | undefined) ??
    (usage?.output_tokens as number | undefined) ??
    null;

  const { error: logErr } = await supabaseAdmin.from("llm_usage_logs").insert({
    user_id: user.id,
    service: service === "deepseek" ? "deepseek" : "gemini",
    phase: "proxy",
    model,
    input_tokens: Number.isFinite(inputTokens) ? inputTokens : null,
    output_tokens: Number.isFinite(outputTokens) ? outputTokens : null,
    key_ownership: "platform",
  });
  if (logErr) {
    console.warn("[llm-proxy.serve] Usage log insert failed:", logErr.message);
  }

  if (upstreamBody == null) {
    return new Response(rawText || "Upstream error", {
      status: upstream.status,
      headers,
    });
  }

  return jsonResponse(upstreamBody, upstream.status, req);
});
