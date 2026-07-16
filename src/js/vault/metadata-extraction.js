/**
 * Async vault metadata extraction + geocode enqueue (post-promotion).
 * Never blocks the promotion call path.
 */

import { isVaultMetadataExtractionEnabled } from "../config/flags.js";
import {
  detectVaultInfluenceEdges,
  extractVaultTemporalSpatial,
} from "../api.js";
import { loadVault, saveVault } from "./vault-store.js";
import { normalizePlaceNameForCache } from "./project-membership.js";
import { SUPABASE_URL } from "../config/supabase.js";
import { getSupabaseAuthToken } from "../llm.js";

/**
 * @param {string[]} entryIds
 * @param {{
 *   extractTemporalSpatial?: typeof extractVaultTemporalSpatial,
 *   detectInfluence?: typeof detectVaultInfluenceEdges,
 *   loadVaultFn?: typeof loadVault,
 *   saveVaultFn?: typeof saveVault,
 *   enqueueGeocode?: (entryId: string, placeName: string) => void,
 * }} [deps]
 */
export function enqueueVaultMetadataExtraction(entryIds, deps = {}) {
  const enabled =
    typeof deps.isEnabled === "function"
      ? deps.isEnabled()
      : isVaultMetadataExtractionEnabled();
  if (!enabled) return;
  const ids = [...new Set((Array.isArray(entryIds) ? entryIds : []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!ids.length) return;
  // Fire-and-forget — promotion must not await.
  void runVaultMetadataExtraction(ids, deps).catch((err) => {
    console.warn("[vault-metadata] extraction batch failed", err?.message || err);
  });
}

/**
 * @param {string[]} entryIds
 * @param {object} [deps]
 */
export async function runVaultMetadataExtraction(entryIds, deps = {}) {
  const enabled =
    typeof deps.isEnabled === "function"
      ? deps.isEnabled()
      : isVaultMetadataExtractionEnabled();
  if (!enabled) return;
  const extractFn = deps.extractTemporalSpatial || extractVaultTemporalSpatial;
  const influenceFn = deps.detectInfluence || detectVaultInfluenceEdges;
  const loadFn = deps.loadVaultFn || loadVault;
  const saveFn = deps.saveVaultFn || saveVault;
  const geocodeFn = deps.enqueueGeocode || enqueueVaultGeocode;

  for (const entryId of entryIds) {
    try {
      await extractOneVaultEntry(entryId, {
        extractFn,
        influenceFn,
        loadFn,
        saveFn,
        geocodeFn,
      });
    } catch (err) {
      console.warn("[vault-metadata] entry failed", entryId, err?.message || err);
    }
  }
}

/**
 * @param {string} entryId
 * @param {object} helpers
 */
async function extractOneVaultEntry(entryId, helpers) {
  const vault = helpers.loadFn();
  const entry = (vault?.entries || []).find((e) => String(e?.id) === entryId);
  if (!entry) return;
  if (entry.metadataExtractedAt != null) return;

  const neighbors = collectNeighborEntries(vault, entry);
  let temporalRange = null;
  let geoPlace = null;
  let edges = [];

  try {
    const ts = await helpers.extractFn({
      title: entry.canonicalTitle || entryId,
      topic: entry.topic,
      definition: Array.isArray(entry.definitions) ? entry.definitions[0]?.text : "",
    });
    temporalRange = ts?.temporalRange ?? null;
    geoPlace = ts?.geoLocation?.placeName ? String(ts.geoLocation.placeName).trim() : "";
  } catch (err) {
    console.warn("[vault-metadata] temporal/spatial failed", entryId, err?.code || err?.message || err);
  }

  try {
    edges = await helpers.influenceFn({
      concept: { id: entryId, title: entry.canonicalTitle || entryId },
      neighbors: neighbors.map((n) => ({
        id: String(n.id),
        title: String(n.canonicalTitle || n.id),
      })),
    });
  } catch (err) {
    console.warn("[vault-metadata] influence failed", entryId, err?.code || err?.message || err);
  }

  // Reload before write to avoid clobbering concurrent mastery updates.
  const vault2 = helpers.loadFn();
  const entry2 = (vault2?.entries || []).find((e) => String(e?.id) === entryId);
  if (!entry2) return;
  if (entry2.metadataExtractedAt != null) return;

  entry2.temporalRange = temporalRange;
  if (geoPlace) {
    entry2.geoLocation = {
      placeName: geoPlace,
      lat: null,
      lng: null,
      geocodeStatus: "pending",
    };
  } else {
    entry2.geoLocation = null;
  }

  if (!Array.isArray(entry2.influences)) entry2.influences = [];
  for (const edge of edges || []) {
    const from = String(edge.from || "").trim();
    const to = String(edge.to || "").trim();
    if (!from || !to) continue;
    const source = (vault2.entries || []).find((e) => String(e.id) === from);
    if (!source) continue;
    if (!Array.isArray(source.influences)) source.influences = [];
    if (!source.influences.includes(to)) source.influences.push(to);
  }

  entry2.metadataExtractedAt = Date.now();
  vault2.lastUpdated = Date.now();
  helpers.saveFn(vault2);

  if (geoPlace) helpers.geocodeFn(entryId, geoPlace);
}

/**
 * Immediate neighbors: prerequisite / dependent / co-prerequisite ids in vault.
 * @param {object} vault
 * @param {object} entry
 */
export function collectNeighborEntries(vault, entry) {
  const byId = new Map((vault?.entries || []).map((e) => [String(e.id), e]));
  const ids = new Set();
  for (const pid of entry?.prerequisites || []) ids.add(String(pid));
  for (const cid of entry?.coPrerequisites || []) ids.add(String(cid));
  for (const e of vault?.entries || []) {
    if ((e.prerequisites || []).map(String).includes(String(entry.id))) ids.add(String(e.id));
    if ((e.coPrerequisites || []).map(String).includes(String(entry.id))) ids.add(String(e.id));
  }
  ids.delete(String(entry.id));
  return [...ids].map((id) => byId.get(id)).filter(Boolean);
}

/**
 * @param {string} entryId
 * @param {string} placeName
 */
export function enqueueVaultGeocode(entryId, placeName) {
  void geocodeVaultEntryPlace(entryId, placeName).catch((err) => {
    console.warn("[vault-metadata] geocode failed", entryId, err?.message || err);
  });
}

/**
 * @param {string} entryId
 * @param {string} placeName
 * @param {{ fetchFn?: typeof fetch, loadVaultFn?: typeof loadVault, saveVaultFn?: typeof saveVault, getToken?: typeof getSupabaseAuthToken }} [deps]
 */
export async function geocodeVaultEntryPlace(entryId, placeName, deps = {}) {
  const loadFn = deps.loadVaultFn || loadVault;
  const saveFn = deps.saveVaultFn || saveVault;
  const fetchFn = deps.fetchFn || fetch;
  const getToken = deps.getToken || getSupabaseAuthToken;
  const normalized = normalizePlaceNameForCache(placeName);
  if (!normalized) return;

  let lat = null;
  let lng = null;
  let ok = false;
  try {
    const token = await getToken();
    if (!token) throw new Error("Not authenticated");
    const res = await fetchFn(`${SUPABASE_URL}/functions/v1/geocode-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ placeName }),
    });
    if (!res.ok) throw new Error(`geocode-proxy ${res.status}`);
    const body = await res.json();
    lat = Number(body?.lat);
    lng = Number(body?.lng);
    ok = Number.isFinite(lat) && Number.isFinite(lng);
  } catch (err) {
    console.warn("[vault-metadata] geocode request", err?.message || err);
    ok = false;
  }

  const vault = loadFn();
  const target = (vault?.entries || []).find((e) => String(e.id) === entryId);
  if (!target?.geoLocation) return;
  if (ok) {
    target.geoLocation.lat = lat;
    target.geoLocation.lng = lng;
    target.geoLocation.geocodeStatus = "resolved";
  } else {
    target.geoLocation.geocodeStatus = "failed";
  }
  vault.lastUpdated = Date.now();
  saveFn(vault);
}
