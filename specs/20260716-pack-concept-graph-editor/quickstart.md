# Quickstart: Pack Concept Graph Editor

## Automated

```bash
node cursor-tests/20260716_pack-concept-graph-editor.mjs
```

Expect green for: session isolation, rename sync, delete edge cleanup, add node/edge, remove edge, dangling-edge assert.

## Manual smoke

1. Sign in; open Project library with a session that has concept inventory.
2. Click **Create pack** on a doc row → editor shows graph (or empty + Add concept).
3. Rename a node → label updates; wait ~1s (debounce) → refresh draft from DB / reopen → name persists.
4. Delete a connected node → no orphan edges in UI.
5. Add concept + relationship (pick type) → both visible.
6. Toggle include source → **Publish** → success leaves draft; original session titles/graph unchanged (compare library open of same doc).
7. Force finalize failure (optional: offline) → editor keeps edits.

## QA checklist

- [x] Original DocumentSession unchanged after edits + publish (automated)
- [x] `screenSlowGraph` still read-only (no edit chrome on that screen)
- [x] SW_VERSION bumped with `index.html` `?v=` for `sw-update.js` and `main.js` (`20260716_05`)
- [x] DESIGN: editor is full-bleed primary screen (not a centered card)
