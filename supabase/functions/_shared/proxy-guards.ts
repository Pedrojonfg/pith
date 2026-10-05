/** Shared Edge Function guards (CORS + platform proxy allowlist). */

export function corsHeaders(req: Request): Record<string, string> {
  const raw = (Deno.env.get("PITH_CORS_ORIGINS") ?? "").trim();
  const allowed = raw
    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const origin = req.headers.get("Origin") ?? "";
  let allowOrigin = allowed[0] ?? "";
  if (origin && allowed.includes(origin)) {
    allowOrigin = origin;
  } else if (!raw) {
    // ponytail: fail closed when unset (public repo + live demo)
    allowOrigin = "";
  }
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
  if (allowOrigin) {
    base["Access-Control-Allow-Origin"] = allowOrigin;
    base["Vary"] = "Origin";
  }
  return base;
}

export function corsForbidden(req: Request): Response | null {
  const raw = (Deno.env.get("PITH_CORS_ORIGINS") ?? "").trim();
  if (!raw) {
    return new Response("Forbidden", { status: 403, headers: corsHeaders(req) });
  }
  const origin = req.headers.get("Origin") ?? "";
  if (origin) {
    const allowed = new Set(
      raw.split(",").map((s) => s.trim()).filter(Boolean),
    );
    if (!allowed.has(origin)) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders(req) });
    }
  }
  return null;
}

/** Empty env → deny all (fail closed). Comma-separated auth.users ids. */
export function isUserAllowlisted(userId: string): boolean {
  const raw = (Deno.env.get("LLM_PROXY_ALLOWED_USER_IDS") ?? "").trim();
  if (!raw) return false;
  const allowed = new Set(
    raw.split(",").map((s) => s.trim()).filter(Boolean),
  );
  return allowed.has(userId);
}
