/**
 * Supabase read/write for shared DPP cache.
 * @see specs/20260704-shared-dpp-cache/contracts/shared-dpp-cache-store.md
 */

import { supabase } from "./supabase-client.js";
import { isOfflineMode } from "./offline.js";
import {
  DPP_PIPELINE_VERSION,
  buildSharedDppCacheKey,
  extractShareableTier1Artifacts,
} from "./shared-dpp-cache.js";

/**
 * @param {string} docId
 * @returns {Promise<object | null>}
 */
export async function fetchSharedDppCache(docId) {
  const id = String(docId || "").trim();
  if (!id || isOfflineMode()) return null;
  const cacheKey = buildSharedDppCacheKey(id, DPP_PIPELINE_VERSION);
  try {
    const { data, error } = await supabase
      .from("document_preparation_cache")
      .select("artifacts")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error) {
      console.warn("[shared-dpp-cache] fetch failed:", error.message);
      return null;
    }
    const artifacts = data?.artifacts;
    return artifacts && typeof artifacts === "object" ? artifacts : null;
  } catch (err) {
    console.warn("[shared-dpp-cache] fetch error:", err?.message || err);
    return null;
  }
}

/**
 * @param {string} docId
 * @param {object} session
 * @returns {Promise<void>}
 */
export async function upsertSharedDppCache(docId, session) {
  const id = String(docId || "").trim();
  if (!id || isOfflineMode()) return;
  const artifacts = extractShareableTier1Artifacts(session);
  if (!artifacts) return;
  const cacheKey = buildSharedDppCacheKey(id, DPP_PIPELINE_VERSION);
  try {
    const { error } = await supabase.from("document_preparation_cache").upsert(
      {
        cache_key: cacheKey,
        doc_id: id,
        pipeline_version: DPP_PIPELINE_VERSION,
        artifacts,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" },
    );
    if (error) console.warn("[shared-dpp-cache] upsert failed:", error.message);
    else console.info("[shared-dpp-cache] upsert ok:", { docId: id, cacheKey });
  } catch (err) {
    console.warn("[shared-dpp-cache] upsert error:", err?.message || err);
  }
}
