import { LS_ACTIVE_DOC_ID_KEY, LS_DOC_SESSIONS_KEY, LS_DOC_TEXT_PREFIX } from "./config.js";
import { getOAuthRedirectUrl } from "./config/supabase.js";
import { supabase } from "./supabase-client.js";
import { upsertSessionRow, uploadMarkdown, getAuthUserId } from "./session-persist-supabase.js";
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
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: redirectTo ? { redirectTo } : {},
  });
  if (error) throw error;
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

/**
 * One-time localStorage → Supabase migration after first authenticated boot.
 */
export async function migrateLocalStorageToSupabase() {
  if (localStorage.getItem(MIGRATION_FLAG) === "true") return;

  const raw = localStorage.getItem(LS_DOC_SESSIONS_KEY);
  if (!raw?.trim()) {
    localStorage.setItem(MIGRATION_FLAG, "true");
    return;
  }

  let sessions = [];
  try {
    sessions = JSON.parse(raw);
    if (!Array.isArray(sessions)) sessions = [];
  } catch (err) {
    console.warn("[auth] corrupt local sessions during migration", err);
    localStorage.setItem(MIGRATION_FLAG, "true");
    return;
  }

  const userId = await getAuthUserId();

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

  localStorage.setItem(MIGRATION_FLAG, "true");
}
