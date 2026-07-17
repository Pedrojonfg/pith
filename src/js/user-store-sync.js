import {
  LS_ACTIVE_DOC_ID_KEY,
  LS_DOC_BLOCKS_PREFIX,
  LS_DOC_RESPONSES_PREFIX,
  LS_PROJECTS_KEY,
} from "./config.js";
import { getAuthUserId } from "./session-persist-supabase.js";
import {
  fetchUserConceptRegistry,
  fetchUserPrefs,
  fetchUserProjects,
  fetchUserVault,
  uploadBlocksJson,
  uploadResponsesJson,
  upsertUserConceptRegistry,
  upsertUserPrefs,
  upsertUserProjects,
  upsertUserVault,
} from "./user-data-persist-supabase.js";
import { isOfflineMode } from "./offline.js";
import { withKeyedRetry } from "./net/retry.js";

const REGISTRY_STORAGE_KEY = "mylearning_concept_registry";
const VAULT_STORAGE_KEY = "pith_knowledge_vault";
const VAULT_DATA_KEY = "pith_knowledge_vault_data";

/** @type {Promise<void>} */
let syncQueue = Promise.resolve();

/**
 * @param {() => Promise<void>} fn
 */
export function scheduleUserDataSync(fn) {
  syncQueue = syncQueue
    .then(fn)
    .catch((err) => console.warn("[user-store-sync]", err));
}

async function tryGetUserId() {
  try {
    return await getAuthUserId();
  } catch {
    return null;
  }
}

/**
 * @param {string} userId
 */
export async function hydrateUserStoresFromSupabase(userId) {
  const uid = userId || (await tryGetUserId());
  if (!uid) {
    // [debug-enrich]
    console.warn('[user-store-sync.hydrateUserStoresFromSupabase] No userId — skip');
    return;
  }
  // [debug-enrich]
  console.info('[user-store-sync.hydrateUserStoresFromSupabase] Hydrating stores:', {
    userId: uid,
  });

  const projects = await fetchUserProjects(uid);
  if (projects?.data) {
    localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(projects.data));
    // [debug-enrich]
    console.debug('[user-store-sync.hydrateUserStoresFromSupabase] Projects hydrated');
  } else {
    // [debug-enrich]
    console.debug('[user-store-sync.hydrateUserStoresFromSupabase] No projects payload');
  }

  const vault = await fetchUserVault(uid);
  if (vault?.data) {
    hydrateVaultLocal(vault.data);
    // [debug-enrich]
    console.debug('[user-store-sync.hydrateUserStoresFromSupabase] Vault hydrated', {
      entryCount: Array.isArray(vault.data.entries) ? vault.data.entries.length : null,
    });
  } else {
    // [debug-enrich]
    console.debug('[user-store-sync.hydrateUserStoresFromSupabase] No vault payload');
  }

  const registry = await fetchUserConceptRegistry(uid);
  if (registry?.data) {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry.data));
    // [debug-enrich]
    console.debug('[user-store-sync.hydrateUserStoresFromSupabase] Registry hydrated');
  } else {
    // [debug-enrich]
    console.debug('[user-store-sync.hydrateUserStoresFromSupabase] No registry payload');
  }

  const prefs = await fetchUserPrefs(uid);
  if (prefs?.active_doc_id) {
    localStorage.setItem(LS_ACTIVE_DOC_ID_KEY, prefs.active_doc_id);
    // [debug-enrich]
    console.debug('[user-store-sync.hydrateUserStoresFromSupabase] Active doc restored:', {
      activeDocId: prefs.active_doc_id,
    });
  }
  // [debug-enrich]
  console.info('[user-store-sync.hydrateUserStoresFromSupabase] Hydrate complete:', {
    userId: uid,
    hadProjects: Boolean(projects?.data),
    hadVault: Boolean(vault?.data),
    hadRegistry: Boolean(registry?.data),
    hadActiveDoc: Boolean(prefs?.active_doc_id),
  });
}

/**
 * Restore vault meta + optional externalized entries into localStorage.
 * @param {object} data merged vault from loadVault-shaped payload
 */
export function hydrateVaultLocal(data) {
  if (!data || typeof data !== "object") return;
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const meta = { ...data };
  delete meta.entries;

  const inline = JSON.stringify({ ...meta, entries });
  const threshold = 300 * 1024;
  if (inline.length > threshold) {
    localStorage.setItem(VAULT_DATA_KEY, JSON.stringify(entries));
    localStorage.setItem(
      VAULT_STORAGE_KEY,
      JSON.stringify({
        ...meta,
        entriesRef: { storageKey: VAULT_DATA_KEY, entryCount: entries.length },
      }),
    );
  } else {
    try {
      localStorage.removeItem(VAULT_DATA_KEY);
    } catch {
      // ignore
    }
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify({ ...meta, entries }));
  }
}

export function scheduleProjectsSync(store) {
  if (isOfflineMode()) return;
  scheduleUserDataSync(async () => {
    const userId = await tryGetUserId();
    if (!userId || !store) return;
    await withKeyedRetry(`projects:${userId}`, () =>
      upsertUserProjects(userId, store, store.schemaVersion || 1),
    );
  });
}

export function scheduleVaultSync(vaultData) {
  if (isOfflineMode()) {
    // [debug-enrich]
    console.debug("[user-store-sync.scheduleVaultSync] Skip — offline");
    return;
  }
  // [debug-enrich]
  console.info("[user-store-sync.scheduleVaultSync] Scheduled:", {
    entryCount: Array.isArray(vaultData?.entries) ? vaultData.entries.length : null,
    schemaVersion: vaultData?.schemaVersion ?? null,
    hasData: Boolean(vaultData),
  });
  scheduleUserDataSync(async () => {
    const userId = await tryGetUserId();
    if (!userId || !vaultData) {
      // [debug-enrich]
      console.warn("[user-store-sync.scheduleVaultSync] Abort — missing userId or data:", {
        hasUserId: Boolean(userId),
        hasData: Boolean(vaultData),
      });
      return;
    }
    try {
      await withKeyedRetry(`vault:${userId}`, () =>
        upsertUserVault(userId, vaultData, vaultData.schemaVersion || 3),
      );
      // [debug-enrich]
      console.info("[user-store-sync.scheduleVaultSync] Upsert ok:", { userId });
    } catch (err) {
      // [debug-enrich]
      console.error("[user-store-sync.scheduleVaultSync] Upsert failed:", err?.message || err);
      throw err;
    }
  });
}

export function scheduleRegistrySync(registryData) {
  if (isOfflineMode()) return;
  scheduleUserDataSync(async () => {
    const userId = await tryGetUserId();
    if (!userId || !registryData) return;
    await withKeyedRetry(`registry:${userId}`, () =>
      upsertUserConceptRegistry(userId, registryData, registryData.schemaVersion || 2),
    );
  });
}

export function scheduleActiveDocSync(docId) {
  if (isOfflineMode()) return;
  scheduleUserDataSync(async () => {
    const userId = await tryGetUserId();
    if (!userId) return;
    await upsertUserPrefs(userId, docId || null);
  });
}

export function scheduleBlocksUpload(docId, blocksJson) {
  if (isOfflineMode()) {
    // [debug-enrich]
    console.debug('[user-store-sync.scheduleBlocksUpload] Offline — skip', { docId });
    return;
  }
  // [debug-enrich]
  console.info('[user-store-sync.scheduleBlocksUpload] Scheduling:', {
    docId,
    jsonLen: typeof blocksJson === "string" ? blocksJson.length : null,
  });
  scheduleUserDataSync(async () => {
    const userId = await tryGetUserId();
    if (!userId || !docId || !blocksJson) {
      // [debug-enrich]
      console.warn('[user-store-sync.scheduleBlocksUpload] Skipped upload — missing args', {
        hasUserId: Boolean(userId),
        docId: docId || null,
        hasJson: Boolean(blocksJson),
      });
      return;
    }
    try {
      await uploadBlocksJson(userId, docId, blocksJson);
      // [debug-enrich]
      console.info('[user-store-sync.scheduleBlocksUpload] Upload ok:', { docId });
    } catch (err) {
      // [debug-enrich]
      console.error('[user-store-sync.scheduleBlocksUpload] Upload failed:', {
        docId,
        message: err?.message ?? String(err),
      });
      throw err;
    }
  });
}

export function scheduleResponsesUpload(docId, respJson) {
  if (isOfflineMode()) {
    // [debug-enrich]
    console.debug('[user-store-sync.scheduleResponsesUpload] Offline — skip', { docId });
    return;
  }
  // [debug-enrich]
  console.info('[user-store-sync.scheduleResponsesUpload] Scheduling:', {
    docId,
    jsonLen: typeof respJson === "string" ? respJson.length : null,
  });
  scheduleUserDataSync(async () => {
    const userId = await tryGetUserId();
    if (!userId || !docId || !respJson) {
      // [debug-enrich]
      console.warn('[user-store-sync.scheduleResponsesUpload] Skipped upload — missing args', {
        hasUserId: Boolean(userId),
        docId: docId || null,
        hasJson: Boolean(respJson),
      });
      return;
    }
    try {
      await uploadResponsesJson(userId, docId, respJson);
      // [debug-enrich]
      console.info('[user-store-sync.scheduleResponsesUpload] Upload ok:', { docId });
    } catch (err) {
      // [debug-enrich]
      console.error('[user-store-sync.scheduleResponsesUpload] Upload failed:', {
        docId,
        message: err?.message ?? String(err),
      });
      throw err;
    }
  });
}

/**
 * Idempotent local→remote for users who migrated sessions before this feature.
 */
export async function migrateUserStoresToSupabase() {
  const userId = await tryGetUserId();
  if (!userId) return;

  const localProjects = localStorage.getItem(LS_PROJECTS_KEY);
  if (localProjects?.trim()) {
    const remote = await fetchUserProjects(userId);
    if (!remote?.data) {
      try {
        await upsertUserProjects(userId, JSON.parse(localProjects), 1);
      } catch (err) {
        console.warn("[user-store-sync] projects migration failed", err);
      }
    }
  }

  const localVault = localStorage.getItem(VAULT_STORAGE_KEY);
  if (localVault?.trim()) {
    const remote = await fetchUserVault(userId);
    if (!remote?.data) {
      try {
        const meta = JSON.parse(localVault);
        let entries = Array.isArray(meta.entries) ? meta.entries : [];
        if (meta.entriesRef?.storageKey) {
          const ext = localStorage.getItem(meta.entriesRef.storageKey);
          if (ext) entries = JSON.parse(ext);
        }
        await upsertUserVault(userId, { ...meta, entries }, meta.schemaVersion || 3);
      } catch (err) {
        console.warn("[user-store-sync] vault migration failed", err);
      }
    }
  }

  const localRegistry = localStorage.getItem(REGISTRY_STORAGE_KEY);
  if (localRegistry?.trim()) {
    const remote = await fetchUserConceptRegistry(userId);
    if (!remote?.data) {
      try {
        await upsertUserConceptRegistry(userId, JSON.parse(localRegistry), 2);
      } catch (err) {
        console.warn("[user-store-sync] registry migration failed", err);
      }
    }
  }

  const activeDoc = localStorage.getItem(LS_ACTIVE_DOC_ID_KEY);
  if (activeDoc?.trim()) {
    const remote = await fetchUserPrefs(userId);
    if (!remote?.active_doc_id) {
      try {
        await upsertUserPrefs(userId, activeDoc);
      } catch (err) {
        console.warn("[user-store-sync] prefs migration failed", err);
      }
    }
  }

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith(LS_DOC_BLOCKS_PREFIX)) {
      const docId = key.slice(LS_DOC_BLOCKS_PREFIX.length);
      const json = localStorage.getItem(key);
      if (docId && json) {
        try {
          await uploadBlocksJson(userId, docId, json);
        } catch (err) {
          console.warn(`[user-store-sync] blocks migration ${docId} failed`, err);
        }
      }
    }
    if (key.startsWith(LS_DOC_RESPONSES_PREFIX)) {
      const docId = key.slice(LS_DOC_RESPONSES_PREFIX.length);
      const json = localStorage.getItem(key);
      if (docId && json) {
        try {
          await uploadResponsesJson(userId, docId, json);
        } catch (err) {
          console.warn(`[user-store-sync] responses migration ${docId} failed`, err);
        }
      }
    }
  }
}
