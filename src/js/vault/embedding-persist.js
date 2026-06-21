/**
 * Supabase persistence for concept embeddings and dedup/similarity tables.
 */

import { supabase } from "../supabase-client.js";
import { getAuthUserId } from "../session-persist-supabase.js";
import { cosineSimilarity, canonicalConceptPair } from "./embedding-math.js";

/**
 * @param {string} hash
 * @param {string} modelVersion
 */
export async function fetchCachedEmbedding(hash, modelVersion) {
  const userId = await getAuthUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from("concept_embeddings")
    .select("embedding")
    .eq("user_id", userId)
    .eq("source_text_hash", hash)
    .eq("model_version", modelVersion)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) return null;
    throw error;
  }
  const emb = data?.embedding;
  if (!emb) return null;
  if (typeof emb === "string") {
    try {
      return JSON.parse(emb);
    } catch {
      return null;
    }
  }
  return Array.isArray(emb) ? emb : null;
}

/**
 * @param {object} row
 */
export async function upsertConceptEmbedding(row) {
  const userId = await getAuthUserId();
  if (!userId) return null;
  const payload = {
    user_id: userId,
    concept_id: row.concept_id || null,
    scope_type: row.scope_type || "concept",
    project_id: row.project_id || null,
    source_text: row.source_text,
    source_text_hash: row.source_text_hash,
    embedding: row.embedding,
    model_version: row.model_version,
  };
  const { error } = await supabase.from("concept_embeddings").upsert(payload, {
    onConflict: "user_id,source_text_hash,model_version",
    ignoreDuplicates: true,
  });
  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) return null;
    throw error;
  }
  return payload;
}

/**
 * @param {number[]} embedding
 * @param {{ matchCount?: number, projectIds?: string[], excludeConceptId?: string }} [options]
 */
export async function findNearestConcepts(embedding, options = {}) {
  const matchCount = options.matchCount ?? 10;
  const projectIds = options.projectIds ?? null;
  const excludeConceptId = options.excludeConceptId ?? null;

  const userId = await getAuthUserId();
  if (!userId) return [];

  const { data, error } = await supabase.rpc("find_nearest_concept_embeddings", {
    query_embedding: embedding,
    match_count: matchCount,
    filter_project_ids: projectIds,
    exclude_concept_id: excludeConceptId,
  });

  if (!error && Array.isArray(data)) {
    return data.map((row) => ({
      conceptId: row.concept_id,
      projectId: row.project_id,
      sourceText: row.source_text,
      similarity: Number(row.similarity) || 0,
    }));
  }

  // Fallback: client-side scan when RPC/table missing
  let query = supabase
    .from("concept_embeddings")
    .select("concept_id, project_id, source_text, embedding")
    .eq("user_id", userId)
    .eq("scope_type", "concept")
    .limit(500);

  const { data: rows, error: fetchErr } = await query;
  if (fetchErr || !Array.isArray(rows)) return [];

  const filtered = rows.filter((r) => {
    if (excludeConceptId && r.concept_id === excludeConceptId) return false;
    if (projectIds?.length && r.project_id && !projectIds.includes(r.project_id)) return false;
    return true;
  });

  return filtered
    .map((r) => {
      let vec = r.embedding;
      if (typeof vec === "string") {
        try {
          vec = JSON.parse(vec);
        } catch {
          vec = null;
        }
      }
      const similarity = Array.isArray(vec) ? cosineSimilarity(embedding, vec) : 0;
      return {
        conceptId: r.concept_id,
        projectId: r.project_id,
        sourceText: r.source_text,
        similarity,
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);
}

/**
 * @param {object} logRow
 */
export async function insertDedupGateLog(logRow) {
  const userId = await getAuthUserId();
  if (!userId) return;
  try {
    await supabase.from("dedup_gate_log").insert({
      user_id: userId,
      concept_id_a: logRow.concept_id_a,
      concept_id_b: logRow.concept_id_b,
      gate_results: logRow.gate_results,
      outcome: logRow.outcome,
    });
  } catch (err) {
    console.warn("[embedding-persist] dedup_gate_log insert failed", err?.message || err);
  }
}

/**
 * @param {string} conceptIdA
 * @param {string} conceptIdB
 */
export async function hasMergeRejection(conceptIdA, conceptIdB) {
  const userId = await getAuthUserId();
  if (!userId) return false;
  const [ca, cb] = canonicalConceptPair(conceptIdA, conceptIdB);
  const { data } = await supabase
    .from("merge_rejections")
    .select("id")
    .eq("user_id", userId)
    .eq("concept_id_a", ca)
    .eq("concept_id_b", cb)
    .maybeSingle();
  return Boolean(data?.id);
}

/**
 * @param {string} conceptIdA
 * @param {string} conceptIdB
 */
export async function recordMergeRejection(conceptIdA, conceptIdB) {
  const userId = await getAuthUserId();
  if (!userId) return;
  const [ca, cb] = canonicalConceptPair(conceptIdA, conceptIdB);
  try {
    await supabase.from("merge_rejections").upsert(
      {
        user_id: userId,
        concept_id_a: ca,
        concept_id_b: cb,
        rejected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,concept_id_a,concept_id_b" },
    );
  } catch (err) {
    console.warn("[embedding-persist] merge_rejection failed", err?.message || err);
  }
}

/**
 * @param {object} logRow
 */
export async function insertVaultMergeLog(logRow) {
  const userId = await getAuthUserId();
  if (!userId) return;
  try {
    await supabase.from("vault_merge_log").insert({
      user_id: userId,
      source_concept_id: logRow.source_concept_id,
      target_concept_id: logRow.target_concept_id,
      gate_results: logRow.gate_results,
      approved_by: logRow.approved_by,
      reasoning: logRow.reasoning,
      reference_relink_count: logRow.reference_relink_count,
      reference_relink_detail: logRow.reference_relink_detail,
    });
  } catch (err) {
    console.warn("[embedding-persist] vault_merge_log failed", err?.message || err);
  }
}

/**
 * @param {string} docIdA
 * @param {string} docIdB
 * @param {number} score
 * @param {object} fieldScores
 */
export async function upsertDocumentSimilarity(docIdA, docIdB, score, fieldScores) {
  const userId = await getAuthUserId();
  if (!userId) return;
  const a = String(docIdA || "").trim();
  const b = String(docIdB || "").trim();
  if (!a || !b || a === b) return;
  const [doc_id_a, doc_id_b] = a < b ? [a, b] : [b, a];
  try {
    await supabase.from("document_similarity").upsert(
      {
        user_id: userId,
        doc_id_a,
        doc_id_b,
        score,
        field_scores: fieldScores,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,doc_id_a,doc_id_b" },
    );
  } catch (err) {
    console.warn("[embedding-persist] document_similarity failed", err?.message || err);
  }
}

/**
 * @param {string} docId
 */
export async function fetchDocumentSimilaritiesForDoc(docId) {
  const userId = await getAuthUserId();
  if (!userId) return [];
  const id = String(docId || "").trim();
  const { data } = await supabase
    .from("document_similarity")
    .select("*")
    .eq("user_id", userId)
    .or(`doc_id_a.eq.${id},doc_id_b.eq.${id}`);
  return Array.isArray(data) ? data : [];
}
