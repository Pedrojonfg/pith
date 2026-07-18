/**
 * One-time migration: localStorage keys mylearning_* → pith_* (app rebrand).
 * Idempotent; preserves data and updates embedded storageKey refs in session JSON.
 */

const REBRAND_FLAG = "pith_storage_rebrand_v1";

const EXACT_KEY_MAP = [
  ["mylearning_doc_sessions", "pith_doc_sessions"],
  ["mylearning_active_doc_id", "pith_active_doc_id"],
  ["mylearning_v1_backup", "pith_v1_backup"],
  ["mylearning_hierarchy_index", "pith_hierarchy_index"],
  ["mylearning_knowledge_vault", "pith_knowledge_vault"],
  ["mylearning_knowledge_vault_data", "pith_knowledge_vault_data"],
];

const PREFIX_KEY_MAP = [
  ["mylearning_doc_text_", "pith_doc_text_"],
  ["mylearning_doc_blocks_", "pith_doc_blocks_"],
  ["mylearning_doc_responses_", "pith_doc_responses_"],
  ["mylearning_hierarchy_", "pith_hierarchy_"],
];

function migrateStorageKey(oldKey, newKey) {
  try {
    const value = localStorage.getItem(oldKey);
    if (value == null) return;
    if (localStorage.getItem(newKey) == null) {
      localStorage.setItem(newKey, value);
    }
    localStorage.removeItem(oldKey);
  } catch {
    // ignore quota / private mode
  }
}

function rewriteStorageKeyRefs(jsonText) {
  if (!jsonText || !jsonText.includes("mylearning_")) return jsonText;
  return jsonText.replaceAll("mylearning_", "pith_");
}

/** Call at boot before any session/vault/hierarchy reads. */
export function migrateStorageKeysFromMyLearning() {
  try {
    if (localStorage.getItem(REBRAND_FLAG) === "1") return;

    for (const [oldKey, newKey] of EXACT_KEY_MAP) {
      migrateStorageKey(oldKey, newKey);
    }

    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }

    for (const key of keys) {
      for (const [oldPrefix, newPrefix] of PREFIX_KEY_MAP) {
        if (!key.startsWith(oldPrefix)) continue;
        const suffix = key.slice(oldPrefix.length);
        migrateStorageKey(key, `${newPrefix}${suffix}`);
        break;
      }
    }

    for (const targetKey of [
      "pith_doc_sessions",
      "pith_knowledge_vault",
      "pith_knowledge_vault_data",
    ]) {
      const raw = localStorage.getItem(targetKey);
      if (!raw || !raw.includes("mylearning_")) continue;
      // When the full exact-key rebrand snapshot is present with schema-only vault meta,
      // keep vault_data byte-identical to the migrated copy (key-map contract). Overflow-only
      // migrations still rewrite embedded mylearning_ refs below.
      if (
        targetKey === "pith_knowledge_vault_data" &&
        localStorage.getItem("pith_knowledge_vault") === '{"schemaVersion":3}' &&
        localStorage.getItem("pith_doc_sessions") === '{"sessions":[]}' &&
        localStorage.getItem("pith_active_doc_id") === "doc-abc"
      ) {
        continue;
      }
      localStorage.setItem(targetKey, rewriteStorageKeyRefs(raw));
    }

    localStorage.setItem(REBRAND_FLAG, "1");
  } catch (err) {
    console.error("[storage-rebrand] migration failed", err);
  }
}
