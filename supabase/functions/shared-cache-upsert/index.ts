import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsForbidden, corsHeaders, isUserAllowlisted } from "../_shared/proxy-guards.ts";

const MAX_ARTIFACTS_BYTES = 4_000_000;
const MAX_BOOK_ROW_BYTES = 512_000;

function json(body: unknown, status: number, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function byteLength(obj: unknown): number {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
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

  let payload: { table?: string; row?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400, headers });
  }

  const table = String(payload.table || "");
  const row = payload.row;
  if (!row || typeof row !== "object") {
    return new Response("Bad Request: missing row", { status: 400, headers });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (table === "document_preparation_cache") {
    const cacheKey = String(row.cache_key || "").trim();
    const docId = String(row.doc_id || "").trim();
    const pipelineVersion = String(row.pipeline_version || "").trim();
    const artifacts = row.artifacts;
    if (!cacheKey || !docId || !pipelineVersion || !artifacts) {
      return new Response("Bad Request: invalid dpp row", { status: 400, headers });
    }
    if (byteLength(artifacts) > MAX_ARTIFACTS_BYTES) {
      return new Response("Payload Too Large", { status: 413, headers });
    }
    const { error } = await admin.from("document_preparation_cache").upsert(
      {
        cache_key: cacheKey,
        doc_id: docId,
        pipeline_version: pipelineVersion,
        artifacts,
        updated_at: row.updated_at ?? new Date().toISOString(),
      },
      { onConflict: "cache_key" },
    );
    if (error) {
      console.error("[shared-cache-upsert] dpp upsert failed:", error.message);
      return json({ error: "upsert_failed" }, 500, req);
    }
    return json({ ok: true }, 200, req);
  }

  if (table === "pith_book_cache") {
    const cacheKey = String(row.cache_key || "").trim();
    if (!cacheKey) {
      return new Response("Bad Request: invalid book cache row", { status: 400, headers });
    }
    if (byteLength(row) > MAX_BOOK_ROW_BYTES) {
      return new Response("Payload Too Large", { status: 413, headers });
    }
    const { error } = await admin.from("pith_book_cache").upsert(row, {
      onConflict: "cache_key",
    });
    if (error) {
      console.error("[shared-cache-upsert] book upsert failed:", error.message);
      return json({ error: "upsert_failed" }, 500, req);
    }
    return json({ ok: true }, 200, req);
  }

  return new Response("Bad Request: unknown table", { status: 400, headers });
});
