/**
 * Supabase read/write for shared DPP cache.
 * @see specs/20260704-shared-dpp-cache/contracts/shared-dpp-cache-store.md
 */

import { supabase } from "./supabase-client.js";
import { isOfflineMode } from "./offline.js";
import { getSupabaseAuthToken } from "./llm.js";
import { SUPABASE_URL } from "./config/supabase.js";
import {
  DPP_PIPELINE_VERSION,
  buildSharedDppCacheKey,
  extractShareableTier1Artifacts,
} from "./shared-dpp-cache.js";

const SHARED_CACHE_UPSERT_URL = `${SUPABASE_URL}/functions/v1/shared-cache-upsert`;

/**
 * @param {string} docId
 * @returns {Promise<object | null>}
 */
export async function fetchSharedDppCache(docId) {
  const id = String(docId || "").trim();
  if (!id || isOfflineMode()) return null;
  const cacheKey = buildSharedDppCacheKey(id, DPP_PIPELINE_VERSION);
  try {
    const { data, error } = await supabase.rpc("get_document_preparation_cache", {
      p_cache_key: cacheKey,
    });
    if (error) {
      console.warn("[shared-dpp-cache] fetch failed:", error.message);
      return null;
    }
    const artifacts = data;
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
    const token = await getSupabaseAuthToken();
    if (!token) return;
    const res = await fetch(SHARED_CACHE_UPSERT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        table: "document_preparation_cache",
        row: {
          cache_key: cacheKey,
          doc_id: id,
          pipeline_version: DPP_PIPELINE_VERSION,
          artifacts,
          updated_at: new Date().toISOString(),
        },
      }),
    });
    if (!res.ok) {
      console.warn("[shared-dpp-cache] upsert failed:", res.status, await res.text().catch(() => ""));
    } else {
      console.info("[shared-dpp-cache] upsert ok:", { docId: id, cacheKey });
    }
  } catch (err) {
    console.warn("[shared-dpp-cache] upsert error:", err?.message || err);
  }
}
