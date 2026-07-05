import { supabase } from "./supabase-client.js";

const BLOCKS_BUCKET = "blocks_files";
const RESPONSES_BUCKET = "responses_files";

/**
 * @param {string} userId
 * @param {string} docId
 */
export function blocksStoragePath(userId, docId) {
  return `${userId}/${String(docId || "").trim()}.json`;
}

/**
 * @param {string} userId
 * @param {string} docId
 */
export function responsesStoragePath(userId, docId) {
  return `${userId}/${String(docId || "").trim()}.json`;
}

/**
 * @param {string} table
 * @param {string} userId
 */
async function fetchUserBlob(table, userId) {
  const { data, error } = await supabase
    .from(table)
    .select("data, schema_version")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { data: data.data, schemaVersion: data.schema_version };
}

/**
 * @param {string} table
 * @param {string} userId
 * @param {object} payload
 * @param {number} schemaVersion
 */
async function upsertUserBlob(table, userId, payload, schemaVersion) {
  const { error } = await supabase.from(table).upsert(
    {
      user_id: userId,
      schema_version: schemaVersion,
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function fetchUserProjects(userId) {
  return fetchUserBlob("user_projects", userId);
}

export async function upsertUserProjects(userId, data, schemaVersion = 1) {
  await upsertUserBlob("user_projects", userId, data, schemaVersion);
}

export async function fetchUserVault(userId) {
  return fetchUserBlob("user_vault", userId);
}

export async function upsertUserVault(userId, data, schemaVersion = 3) {
  await upsertUserBlob("user_vault", userId, data, schemaVersion);
}

export async function fetchUserConceptRegistry(userId) {
  return fetchUserBlob("user_concept_registry", userId);
}

export async function upsertUserConceptRegistry(userId, data, schemaVersion = 2) {
  await upsertUserBlob("user_concept_registry", userId, data, schemaVersion);
}

/**
 * @param {string} userId
 */
export async function fetchUserPrefs(userId) {
  const { data, error } = await supabase
    .from("user_prefs")
    .select("active_doc_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * @param {string} userId
 * @param {string|null} activeDocId
 */
export async function upsertUserPrefs(userId, activeDocId) {
  const { error } = await supabase.from("user_prefs").upsert(
    {
      user_id: userId,
      active_doc_id: activeDocId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

/**
 * @param {string} bucket
 * @param {string} path
 * @param {string} json
 */
async function uploadJson(bucket, path, json) {
  const blob = new Blob([json], { type: "application/json" });
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    upsert: true,
    contentType: "application/json",
  });
  if (error) throw error;
  return path;
}

/**
 * @param {string} bucket
 * @param {string} path
 */
async function downloadJson(bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw error;
  return data.text();
}

export async function uploadBlocksJson(userId, docId, json) {
  return uploadJson(BLOCKS_BUCKET, blocksStoragePath(userId, docId), json);
}

export async function downloadBlocksJson(userId, docId) {
  return downloadJson(BLOCKS_BUCKET, blocksStoragePath(userId, docId));
}

export async function uploadResponsesJson(userId, docId, json) {
  return uploadJson(RESPONSES_BUCKET, responsesStoragePath(userId, docId), json);
}

export async function downloadResponsesJson(userId, docId) {
  return downloadJson(RESPONSES_BUCKET, responsesStoragePath(userId, docId));
}

export { BLOCKS_BUCKET, RESPONSES_BUCKET };
