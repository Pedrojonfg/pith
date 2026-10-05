/**
 * Geocode proxy: cache-first Nominatim with ≤1 req/s throttle.
 * Clients must not call Nominatim directly.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsForbidden, corsHeaders, isUserAllowlisted } from "../_shared/proxy-guards.ts";

const NOMINATIM_UA = "Pith/1.0 (vault-geocode; https://github.com/Pedrojonfg/pith)";
const MIN_INTERVAL_MS = 1100;

let lastNominatimAt = 0;
let chain: Promise<unknown> = Promise.resolve();

function jsonResponse(body: unknown, status: number, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
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

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401, headers });
  }

  if (!isUserAllowlisted(user.id)) {
    return new Response("Forbidden", { status: 403, headers });
  }

  let payload: { placeName?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON" }, 400, req);
  }

  const placeName = String(payload?.placeName || "").trim();
  const placeNameNormalized = normalizePlaceName(placeName);
  if (!placeNameNormalized) {
    return jsonResponse({ error: "placeName required" }, 400, req);
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
    }, 200, req);
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
      return jsonResponse({ error: "no results" }, 404, req);
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
    }, 200, req);
  } catch (err) {
    console.error("[geocode-proxy]", err);
    return jsonResponse({ error: "geocode failed" }, 502, req);
  }
});
