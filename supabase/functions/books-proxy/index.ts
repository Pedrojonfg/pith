import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }
  const token = authHeader.replace("Bearer ", "");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }

  const booksKey = Deno.env.get("GOOGLE_BOOKS_API_KEY") ?? "";
  if (!booksKey) {
    return new Response("Server misconfiguration: missing GOOGLE_BOOKS_API_KEY", {
      status: 500,
      headers: CORS_HEADERS,
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
      headers: CORS_HEADERS,
    });
  }

  return new Response(JSON.stringify(upstreamBody), {
    status: upstream.status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
