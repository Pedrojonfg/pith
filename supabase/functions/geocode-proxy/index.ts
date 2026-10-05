/**
 * Geocode proxy: cache-first Nominatim with ≤1 req/s throttle.
 * Clients must not call Nominatim directly.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOMINATIM_UA = "Pith/1.0 (vault-geocode; https://github.com/Pedrojonfg/pith)";
const MIN_INTERVAL_MS = 1100;

let lastNominatimAt = 0;
let chain: Promise<unknown> = Promise.resolve();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Optional comma-separated auth.users ids. Empty = all authenticated users. */
function isUserAllowlisted(userId: string): boolean {
  const raw = (Deno.env.get("LLM_PROXY_ALLOWED_USER_IDS") ?? "").trim();
  if (!raw) return true;
  const allowed = new Set(
    raw.split(",").map((s) => s.trim()).filter(Boolean),
  );
  return allowed.has(userId);
}

function normalizePlaceName(raw: string): string {
  return String(raw || "").trim().toLowerCase();
}

async function throttleNominatim<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastNominatimAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastNominatimAt = Date.now();
    return fn();
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }
  const token = authHeader.replace("Bearer ", "");

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }

  if (!isUserAllowlisted(user.id)) {
    return new Response("Forbidden", { status: 403, headers: CORS_HEADERS });
  }

  let payload: { placeName?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON" }, 400);
  }

  const placeName = String(payload?.placeName || "").trim();
  const placeNameNormalized = normalizePlaceName(placeName);
  if (!placeNameNormalized) {
    return jsonResponse({ error: "placeName required" }, 400);
  }

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: cached } = await service
    .from("geocode_cache")
    .select("lat,lng")
    .eq("place_name_normalized", placeNameNormalized)
    .maybeSingle();

  if (
    cached &&
    typeof cached.lat === "number" &&
    typeof cached.lng === "number" &&
    Number.isFinite(cached.lat) &&
    Number.isFinite(cached.lng)
  ) {
    return jsonResponse({
      placeNameNormalized,
      lat: cached.lat,
      lng: cached.lng,
      cached: true,
    });
  }

  try {
    const result = await throttleNominatim(async () => {
      const url =
        `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q: placeName,
          format: "json",
          limit: "1",
        }).toString();
      const res = await fetch(url, {
        headers: {
          "User-Agent": NOMINATIM_UA,
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        throw new Error(`Nominatim HTTP ${res.status}`);
      }
      return res.json();
    });

    const first = Array.isArray(result) ? result[0] : null;
    const lat = first ? Number(first.lat) : NaN;
    const lng = first ? Number(first.lon ?? first.lng) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return jsonResponse({ error: "no results" }, 404);
    }

    await service.from("geocode_cache").upsert({
      place_name_normalized: placeNameNormalized,
      lat,
      lng,
      resolved_at: new Date().toISOString(),
      raw_response: first,
    });

    return jsonResponse({
      placeNameNormalized,
      lat,
      lng,
      cached: false,
    });
  } catch (err) {
    console.error("[geocode-proxy]", err);
    return jsonResponse({ error: "geocode failed" }, 502);
  }
});
