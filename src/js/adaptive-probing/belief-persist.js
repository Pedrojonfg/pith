/**
 * Supabase persistence for probe warnings and project belief state.
 * @see specs/20260630-adaptive-knowledge-probing/
 */

import { supabase } from "../supabase-client.js";
import { getAuthUserId } from "../session-persist-supabase.js";

/**
 * @param {object[]} warnings
 * @param {{ projectId: string, docId: string }} ctx
 */
export async function persistProbeGraphWarnings(warnings, ctx) {
  const userId = await getAuthUserId();
  if (!userId || !Array.isArray(warnings) || !warnings.length) return;
  const projectId = String(ctx?.projectId || "").trim();
  const docId = String(ctx?.docId || "").trim();
  if (!docId || !projectId) return;

  const rows = warnings.map((w) => ({
    user_id: userId,
    project_id: projectId,
    doc_id: docId,
    from_concept_id: String(w.from_concept_id || "").trim(),
    to_concept_id: String(w.to_concept_id || "").trim(),
    edge_weight: Number(w.edge_weight) || 1,
    cycle_path: Array.isArray(w.cycle_path) ? w.cycle_path : [],
  }));

  const { error } = await supabase.from("probe_graph_warnings").insert(rows);
  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) return;
    console.warn("[adaptive-probing] persistProbeGraphWarnings", error.message || error);
  }
}

/**
 * @param {string} projectId
 */
export async function loadProjectBeliefs(projectId) {
  const userId = await getAuthUserId();
  const pid = String(projectId || "").trim();
  if (!userId || !pid) return {};

  const { data, error } = await supabase
    .from("vault_belief_state")
    .select("concept_id, belief, source, updated_at")
    .eq("user_id", userId)
    .eq("project_id", pid);

  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) return {};
    console.warn("[adaptive-probing] loadProjectBeliefs", error.message || error);
    return {};
  }

  /** @type {Record<string, object>} */
  const out = {};
  for (const row of data || []) {
    const id = String(row?.concept_id || "").trim();
    if (!id) continue;
    const belief = Number(row.belief);
    out[id] = {
      belief: Number.isFinite(belief) ? belief : 0.5,
      source: String(row.source || "prior"),
      lastUpdated: row.updated_at || new Date().toISOString(),
    };
  }
  return out;
}

/**
 * @param {string} projectId
 * @param {Record<string, object>} sessionState
 */
export async function mergeSessionBeliefs(projectId, sessionState) {
  const userId = await getAuthUserId();
  const pid = String(projectId || "").trim();
  if (!userId || !pid || !sessionState || typeof sessionState !== "object") return;

  const existing = await loadProjectBeliefs(pid);
  /** @type {object[]} */
  const rows = [];

  for (const [conceptId, entry] of Object.entries(sessionState)) {
    const id = String(conceptId || "").trim();
    if (!id || !entry) continue;
    const incoming = Number(entry.belief);
    if (!Number.isFinite(incoming)) continue;
    const prev = Number(existing[id]?.belief);
    const belief = Number.isFinite(prev) ? Math.max(prev, incoming) : incoming;
    rows.push({
      user_id: userId,
      project_id: pid,
      concept_id: id,
      belief,
      source: String(entry.source || "probe"),
      updated_at: new Date().toISOString(),
    });
  }

  if (!rows.length) return;

  const { error } = await supabase.from("vault_belief_state").upsert(rows, {
    onConflict: "user_id,project_id,concept_id",
  });
  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) return;
    console.warn("[adaptive-probing] mergeSessionBeliefs", error.message || error);
  }
}
