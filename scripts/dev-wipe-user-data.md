# Dev wipe — localStorage + Supabase

Wipes **all document sessions and app caches** for the currently signed-in user. Intended for local development after incomplete DPP runs or zombie sessions.

**Does not:**
- Sign you out
- Remove Supabase auth tokens (`sb-*` keys)
- Delete other users' data

**Does:**
- `document_sessions` rows for your `user_id`
- `markdown_files` storage under `{userId}/`
- Optional aux tables: `concept_embeddings`, `document_similarity`, `vault_belief_state`, `probe_graph_warnings`
- All matching `localStorage` keys (`pith_*`, `mylearning_*`, legacy session keys, hierarchy cache, vault, registry, etc.)

## Run (localhost, signed in)

Open DevTools → Console on the app tab:

```javascript
const { wipeUserDevData } = await import("./src/js/dev/wipe-user-data.js");
await wipeUserDevData({ confirm: true });
```

Shortcut if the module already loaded:

```javascript
await __pithDevWipe({ confirm: true });
```

## Options

```javascript
await wipeUserDevData({
  confirm: true,              // required
  keepPreferences: true,      // keep study_lang, RSVP prefs, mnemonic UI, etc.
  includeSupabaseAux: false,  // only document_sessions + markdown (skip embeddings/similarity)
  forceOnNonLocalhost: true,  // allow on deployed preview (use with care)
  reload: false,              // skip automatic page reload
});
```

## Safety

Blocked unless hostname is `localhost`, `127.0.0.1`, or `*.local`, unless `forceOnNonLocalhost: true`.
