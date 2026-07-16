# Contract: Pack Export API

## `buildPackSnapshot(session) → PackSnapshot`

Pure. Deep-clones allowed subtrees from a DocumentSession. Does not touch storage.

## `stripSourceBearingFields(snapshot) → PackSnapshot`

Pure. Returns a new snapshot (or mutates a clone) removing:

- `rawMarkdown`, `slowSlice`, `images`, `modes.cloze`
- every `conceptInventory[]` `source_phrase` / `anchorRange`

Does not rewrite recall chunks.

## `rewritePackExcerpt(text, context) → Promise<string>`

```js
context = {
  conceptLabel?: string,
  kind: 'recall_excerpt' | 'vault_definition' | 'vault_notes'
}
```

- Calls `llmChatCompletions` (DeepSeek platform chat), `temperature: 0.3`
- Named dynamic `max_tokens` from input length
- Throws on empty/failure (no silent passthrough)

## `createPackDraft(docId, ownerUserId) → Promise<SharedPackRow>`

1. `getSession(docId)` — throw if missing
2. `buildPackSnapshot(session)`
3. INSERT `shared_packs` status=`draft`, code=NULL, title from docMeta.titleInferred
4. Return inserted row

## `finalizePack(packDraftId, includeSourceDocument) → Promise<SharedPackRow>`

1. Load draft by id (owner RLS)
2. If `includeSourceDocument === true`: publish snapshot as-is
3. Else: `stripSourceBearingFields` then rewrite each recall `source_chunks[]` string; Jaccard gate `< 0.3`
4. On any failure: throw; row stays draft
5. UPDATE status=`published`, published_at=now(), include_source_document=flag, snapshot=final
6. Does **not** set `code`

## RPC `lookup_shared_pack_by_code(p_code text)`

Returns one published pack row for authenticated users, or empty. SECURITY DEFINER; checks `status='published'` and `code = p_code`.

## Errors

| Condition | Behavior |
|-----------|----------|
| Session not found | throw |
| Draft not found / not owner | throw / RLS |
| Already published | throw |
| Rewrite fail / empty / Jaccard ≥ 0.3 | throw; status remains draft |
