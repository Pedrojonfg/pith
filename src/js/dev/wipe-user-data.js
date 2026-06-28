/**
 * Dev-only wipe: local session cache + Supabase rows for the logged-in user.
 *
 * Usage (browser console on localhost while signed in):
 *   const { wipeUserDevData } = await import("./src/js/dev/wipe-user-data.js");
 *   await wipeUserDevData({ confirm: true });
 *
 * Does NOT sign you out. Does NOT touch Supabase auth tokens (sb-* keys).
 */

import { supabase } from "../supabase-client.js";
import { fetchSessionRows } from "../session-persist-supabase.js";

const MIGRATION_FLAG = "pith_supabase_migrated";

/** @type {readonly string[]} */
const LOCAL_PREFIXES = [
  "pith_",
  "mylearning_",
  "pith_doc_text_",
  "pith_doc_blocks_",
  "pith_doc_responses_",
  "review_session_config_",
  "review_flashcards_",
  "guide_chat_",
  "review_session_",
  "session_concepts",
  "session_default_q_config",
  "active_session",
  "sessions_by_mode",
  "pending_comment",
  "block_index",
  "rsvp_",
  "default_llm_model",
  "source_fidelity_strict",
  "study_notes",
  "last_export_state",
];

/** @type {readonly string[]} */
const PREFERENCE_KEYS = [
  "study_lang",
  "pith_assessment_before_packing",
  "rsvp_default_wpm",
  "rsvp_default_wpf",
  "rsvp_comprehension_pause",
  "rsvp_comprehension_every",
  "rsvp_reading_mode",
  "rsvp_container_size",
  "default_llm_model",
  "source_fidelity_strict",
  "pith_mnemonic_btn_pos",
  "pith_mnemonic_btn_visible",
  "pith_vault_settings",
  "pith_splash_seen",
];

/** @type {readonly string[]} */
const SUPABASE_USER_TABLES = [
  "document_sessions",
  "concept_embeddings",
  "document_similarity",
  "vault_belief_state",
  "probe_graph_warnings",
];

function assertDevWipeAllowed(options = {}) {
  if (options.confirm !== true) {
    throw new Error("[dev-wipe] Refusing to run without { confirm: true }.");
  }
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    throw new Error("[dev-wipe] Run in the browser while the app is open (not Node).");
  }
  const host = String(window.location?.hostname || "");
  const local =
    host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".local");
  if (!local && options.forceOnNonLocalhost !== true) {
    throw new Error(
      "[dev-wipe] Blocked outside localhost. Pass { forceOnNonLocalhost: true } to override.",
    );
  }
}

function shouldRemoveLocalKey(key, options = {}) {
  const k = String(key || "");
  if (!k) return false;
  if (k.startsWith("sb-")) return false;
  if (options.keepPreferences === true && PREFERENCE_KEYS.includes(k)) return false;
  if (LOCAL_PREFIXES.some((p) => k === p || k.startsWith(p))) return true;
  return false;
}

function collectLocalStorageKeys(options = {}) {
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && shouldRemoveLocalKey(key, options)) keys.push(key);
  }
  return [...new Set(keys)].sort();
}

function wipeLocalStorage(options = {}) {
  const keys = collectLocalStorageKeys(options);
  for (const key of keys) {
    localStorage.removeItem(key);
  }
  localStorage.removeItem(MIGRATION_FLAG);
  return { removedKeys: keys };
}

async function listMarkdownPaths(userId) {
  const prefix = String(userId || "").trim();
  if (!prefix) return [];
  const paths = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const { data, error } = await supabase.storage.from("markdown_files").list(prefix, {
      limit,
      offset,
    });
    if (error) {
      console.warn("[dev-wipe] storage list failed", error.message || error);
      break;
    }
    const batch = data || [];
    for (const item of batch) {
      if (item?.name) paths.push(`${prefix}/${item.name}`);
    }
    if (batch.length < limit) break;
    offset += limit;
  }
  return paths;
}

async function wipeSupabaseMarkdown(userId) {
  const paths = await listMarkdownPaths(userId);
  if (!paths.length) return { removedPaths: [] };
  const chunkSize = 50;
  const removedPaths = [];
  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const { error } = await supabase.storage.from("markdown_files").remove(chunk);
    if (error) {
      console.warn("[dev-wipe] storage remove failed", error.message || error, chunk);
    } else {
      removedPaths.push(...chunk);
    }
  }
  return { removedPaths };
}

async function wipeSupabaseTable(userId, table) {
  const { error, count } = await supabase.from(table).delete({ count: "exact" }).eq("user_id", userId);
  if (error) {
    if (error.code === "42P01" || String(error.message || "").includes("does not exist")) {
      return { table, deleted: 0, skipped: true };
    }
    throw new Error(`[dev-wipe] ${table} delete failed: ${error.message || error}`);
  }
  return { table, deleted: count ?? 0, skipped: false };
}

/**
 * @param {{
 *   confirm?: boolean,
 *   keepPreferences?: boolean,
 *   includeSupabaseAux?: boolean,
 *   forceOnNonLocalhost?: boolean,
 *   reload?: boolean,
 * }} [options]
 */
export async function wipeUserDevData(options = {}) {
  assertDevWipeAllowed(options);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id) {
    throw new Error("[dev-wipe] Sign in first — no authenticated user.");
  }
  const userId = user.id;

  console.warn("[dev-wipe] Starting wipe for user", userId);

  const sessionRows = await fetchSessionRows(userId);
  const docIds = sessionRows.map((r) => r.id).filter(Boolean);

  const tables = ["document_sessions"];
  if (options.includeSupabaseAux !== false) {
    tables.push(...SUPABASE_USER_TABLES.filter((t) => t !== "document_sessions"));
  }

  /** @type {Record<string, { deleted: number, skipped?: boolean }>} */
  const supabaseTables = {};
  for (const table of tables) {
    supabaseTables[table] = await wipeSupabaseTable(userId, table);
  }

  const storage = await wipeSupabaseMarkdown(userId);
  const local = wipeLocalStorage(options);

  const summary = {
    userId,
    docIds,
    supabaseTables,
    markdownFilesRemoved: storage.removedPaths.length,
    localStorageKeysRemoved: local.removedKeys.length,
    localStorageKeys: local.removedKeys,
  };

  console.info("[dev-wipe] Done", summary);

  if (options.reload !== false) {
    console.info("[dev-wipe] Reloading page…");
    window.location.reload();
  }

  return summary;
}

if (typeof window !== "undefined") {
  window.__pithDevWipe = wipeUserDevData;
}
