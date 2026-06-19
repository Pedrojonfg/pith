import { supabase } from "./supabase-client.js";

/**
 * @returns {Promise<string>}
 */
export async function getAuthUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.id) throw new Error("not authenticated");
  return user.id;
}

/**
 * @param {string} userId
 * @param {string} docId
 */
export function markdownStoragePath(userId, docId) {
  return `${userId}/${docId}.md`;
}

/**
 * @param {string} userId
 * @param {string} docId
 * @param {string} markdown
 * @returns {Promise<string>} storage path
 */
export async function uploadMarkdown(userId, docId, markdown) {
  const path = markdownStoragePath(userId, docId);
  const blob = new Blob([markdown], { type: "text/markdown" });
  const { error } = await supabase.storage.from("markdown_files").upload(path, blob, {
    upsert: true,
    contentType: "text/markdown",
  });
  if (error) throw error;
  return path;
}

/**
 * @param {string} path
 * @returns {Promise<string>}
 */
export async function downloadMarkdown(path) {
  const { data, error } = await supabase.storage.from("markdown_files").download(path);
  if (error) throw error;
  return data.text();
}

/**
 * @param {string} userId
 * @returns {Promise<Array<{ id: string, session_data: object, markdown_ref: string|null }>>}
 */
export async function fetchSessionRows(userId) {
  const { data, error } = await supabase
    .from("document_sessions")
    .select("id, session_data, markdown_ref")
    .eq("user_id", userId);
  if (error) throw error;
  return data || [];
}

/**
 * @param {string} userId
 * @param {string} docId
 * @param {object} sessionData
 * @param {string|null} markdownRef
 */
export async function upsertSessionRow(userId, docId, sessionData, markdownRef) {
  const { error } = await supabase.from("document_sessions").upsert(
    {
      id: docId,
      user_id: userId,
      session_data: sessionData,
      markdown_ref: markdownRef,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id,user_id" },
  );
  if (error) throw error;
}

/**
 * @param {string} userId
 * @param {string} docId
 */
export async function deleteSessionRow(userId, docId) {
  const { error } = await supabase
    .from("document_sessions")
    .delete()
    .eq("id", docId)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * @param {string} userId
 * @param {string} path
 */
export async function deleteMarkdown(userId, path) {
  if (!path || !path.startsWith(`${userId}/`)) return;
  const { error } = await supabase.storage.from("markdown_files").remove([path]);
  if (error) console.warn("[session-persist] markdown delete failed", error);
}
