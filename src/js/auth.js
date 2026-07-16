import { LS_ACTIVE_DOC_ID_KEY, LS_DOC_SESSIONS_KEY, LS_DOC_TEXT_PREFIX } from "./config.js";
import { getOAuthRedirectUrl } from "./config/supabase.js";
import { supabase } from "./supabase-client.js";
import { upsertSessionRow, uploadMarkdown, getAuthUserId } from "./session-persist-supabase.js";
import {
  hydrateUserStoresFromSupabase,
  migrateUserStoresToSupabase,
} from "./user-store-sync.js";
import { validateDocumentSession } from "./session-types.js";

const MIGRATION_FLAG = "pith_supabase_migrated";

/**
 * @returns {Promise<import('@supabase/supabase-js').Session|null>}
 */
export async function getSupabaseAuthSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn("[auth] getSession failed", error);
    return null;
  }
  return data.session ?? null;
}

export async function signInWithGoogle() {
  const redirectTo = getOAuthRedirectUrl();
  // [debug-enrich]
  console.info('[auth.signInWithGoogle] Starting OAuth:', {
    hasRedirectTo: Boolean(redirectTo),
    redirectHost: redirectTo
      ? (() => {
          try {
            return new URL(redirectTo).host;
          } catch {
            return "(invalid-url)";
          }
        })()
      : null,
  });
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: redirectTo ? { redirectTo } : {},
  });
  if (error) {
    // [debug-enrich]
    console.error('[auth.signInWithGoogle] OAuth start failed:', {
      message: error.message ?? String(error),
      status: error.status ?? null,
      name: error.name ?? null,
    });
    throw error;
  }
  // [debug-enrich]
  console.debug('[auth.signInWithGoogle] OAuth redirect initiated (no error)');
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  try {
    localStorage.removeItem(LS_ACTIVE_DOC_ID_KEY);
  } catch {
    // ignore
  }
}

function docTextKey(docId) {
  return `${LS_DOC_TEXT_PREFIX}${docId}`;
}

async function migrateLegacySessions(userId) {
  const raw = localStorage.getItem(LS_DOC_SESSIONS_KEY);
  if (!raw?.trim()) return;

  let sessions = [];
  try {
    sessions = JSON.parse(raw);
    if (!Array.isArray(sessions)) sessions = [];
  } catch (err) {
    console.warn("[auth] corrupt local sessions during migration", err);
    return;
  }

  for (const session of sessions) {
    if (!session?.docId) continue;
    const docId = session.docId;
    const mdKey = docTextKey(docId);
    const external = localStorage.getItem(mdKey);
    if (external != null && session.shared) {
      session.shared.rawMarkdown = external;
    }
    const markdown =
      typeof session.shared?.rawMarkdown === "string" ? session.shared.rawMarkdown : "";
    const clone = JSON.parse(JSON.stringify(session));
    if (clone.shared && typeof clone.shared.rawMarkdown === "string") {
      const path = await uploadMarkdown(userId, docId, clone.shared.rawMarkdown);
      delete clone.shared.rawMarkdown;
      clone.shared.rawMarkdownRef = { storageKey: path, charCount: markdown.length };
      const v = validateDocumentSession({ ...clone, shared: { ...clone.shared, rawMarkdown: markdown } });
      if (!v.ok) {
        console.warn(`[auth] skip migrate ${docId}:`, v.errors.join("; "));
        continue;
      }
      await upsertSessionRow(userId, docId, clone, path);
    } else {
      await upsertSessionRow(userId, docId, clone, null);
    }
  }
}

/**
 * One-time localStorage → Supabase migration after first authenticated boot.
 * Store migrations run idempotently on every boot (handles users who migrated sessions earlier).
 */
export async function migrateLocalStorageToSupabase() {
  let userId;
  try {
    userId = await getAuthUserId();
  } catch {
    return;
  }

  if (localStorage.getItem(MIGRATION_FLAG) !== "true") {
    await migrateLegacySessions(userId);
    localStorage.setItem(MIGRATION_FLAG, "true");
  }

  await migrateUserStoresToSupabase();
  await hydrateUserStoresFromSupabase(userId);
}
