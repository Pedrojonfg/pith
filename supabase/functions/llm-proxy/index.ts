import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LlmService = "deepseek" | "gemini-chat" | "gemini-embed";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function buildTargetUrl(service: LlmService, endpoint: string, authKey: string): string {
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
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

function buildUpstreamHeaders(service: LlmService, authKey: string): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (service !== "gemini-embed") {
    headers.Authorization = `Bearer ${authKey}`;
  }
  return headers;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    // [debug-enrich]
    console.warn("[llm-proxy.serve] Method not allowed:", req.method);
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    // [debug-enrich]
    console.warn("[llm-proxy.serve] Unauthorized: missing Bearer token");
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }
  const token = authHeader.replace("Bearer ", "");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    // [debug-enrich]
    console.warn("[llm-proxy.serve] Unauthorized: getUser failed:", authError?.message ?? "no user");
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }

  let payload: { service?: string; endpoint?: string; body?: unknown };
  try {
    payload = await req.json();
  } catch {
    // [debug-enrich]
    console.warn("[llm-proxy.serve] Bad Request: invalid JSON");
    return new Response("Bad Request: invalid JSON", { status: 400, headers: CORS_HEADERS });
  }

  const service = payload.service as LlmService;
  const endpoint = String(payload.endpoint || "");
  const llmBody = payload.body;

  if (!service || !endpoint || llmBody == null) {
    // [debug-enrich]
    console.warn("[llm-proxy.serve] Bad Request: missing fields:", {
      hasService: Boolean(service),
      hasEndpoint: Boolean(endpoint),
      hasBody: llmBody != null,
    });
    return new Response("Bad Request: missing service, endpoint, or body", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  let authKey: string;
  if (service === "deepseek") {
    authKey = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
  } else if (service === "gemini-chat" || service === "gemini-embed") {
    authKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  } else {
    // [debug-enrich]
    console.warn("[llm-proxy.serve] Bad Request: unknown service:", service);
    return new Response("Bad Request: unknown service", { status: 400, headers: CORS_HEADERS });
  }

  if (!authKey) {
    // [debug-enrich]
    console.error("[llm-proxy.serve] Missing API key secret for service:", service);
    return new Response("Server misconfiguration: missing API key secret", {
      status: 500,
      headers: CORS_HEADERS,
    });
  }

  // [debug-enrich]
  console.info("[llm-proxy.serve] Proxy request:", {
    userId: user.id,
    service,
    endpoint,
  });

  const targetUrl = buildTargetUrl(service, endpoint, authKey);

  const upstream = await fetch(targetUrl, {
    method: "POST",
    headers: buildUpstreamHeaders(service, authKey),
    body: JSON.stringify(llmBody),
  });

  // ponytail: read body once — Response streams are single-use
  const rawText = await upstream.text();
  let upstreamBody: Record<string, unknown> | null = null;
  try {
    upstreamBody = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    // [debug-enrich]
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

  // [debug-enrich]
  console.info("[llm-proxy.serve] Upstream response:", {
    status: upstream.status,
    service,
    model,
    inputTokens,
    outputTokens,
    hasJsonBody: upstreamBody != null,
  });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  void supabaseAdmin
    .from("llm_usage_logs")
    .insert({
      user_id: user.id,
      service: service === "deepseek" ? "deepseek" : "gemini",
      phase: "proxy",
      model,
      input_tokens: Number.isFinite(inputTokens) ? inputTokens : null,
      output_tokens: Number.isFinite(outputTokens) ? outputTokens : null,
      key_ownership: "platform",
    })
    .then(() => undefined)
    .catch((err) => {
      // [debug-enrich]
      console.warn("[llm-proxy.serve] Usage log insert failed:", err?.message ?? err);
    });

  if (upstreamBody == null) {
    return new Response(rawText || "Upstream error", {
      status: upstream.status,
      headers: CORS_HEADERS,
    });
  }

  return jsonResponse(upstreamBody, upstream.status);
});
