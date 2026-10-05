import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsForbidden, corsHeaders, isUserAllowlisted } from "../_shared/proxy-guards.ts";

serve(async (req) => {
  const corsBlock = corsForbidden(req);
  if (corsBlock) return corsBlock;

  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  if (req.method !== "GET") {
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

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response("Unauthorized", { status: 401, headers });
  }

  if (!isUserAllowlisted(user.id)) {
    return new Response("Forbidden", { status: 403, headers });
  }

  const booksKey = Deno.env.get("GOOGLE_BOOKS_API_KEY") ?? "";
  if (!booksKey) {
    return new Response("Server misconfiguration: missing GOOGLE_BOOKS_API_KEY", {
      status: 500,
      headers,
    });
  }

  const incomingUrl = new URL(req.url);
  const params = new URLSearchParams(incomingUrl.searchParams);
  params.set("key", booksKey);

  const booksUrl = `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
  const upstream = await fetch(booksUrl);

  let upstreamBody: unknown = null;
  try {
    upstreamBody = await upstream.json();
  } catch {
    const text = await upstream.text().catch(() => "");
    return new Response(text || "Upstream error", {
      status: upstream.status,
      headers,
    });
  }

  return new Response(JSON.stringify(upstreamBody), {
    status: upstream.status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
});
