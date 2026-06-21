# Contract: embeddings.js

## Module: `src/js/vault/embeddings.js`

### `embedText(text, options?)`

- **Input**: `text` string; `options.taskType` default `SEMANTIC_SIMILARITY`
- **Output**: `Promise<number[]>` length 768
- **Cache**: Check `concept_embeddings` by `sha256(source_text)` + model version before API
- **API**: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent`
- **Errors**: Throws if key missing when called directly; callers in DPP check `isVaultEmbeddingsEnabled()` first

### `embedBatch(texts)`

- Batch embed with per-text cache lookup; only uncached texts hit API

### `buildConceptEmbedText(entry)`

- Returns `label + " " + definition` trimmed; label-only fallback

### `hashSourceText(text)`

- Returns sha256 hex (Web Crypto)

### `isVaultEmbeddingsEnabled()`

- Master switch: flag + Gemini key present

## Module: `src/js/vault/embedding-persist.js`

### `findNearestConcepts(embedding, { matchCount, projectIds, excludeConceptId })`

- Supabase RPC `find_nearest_concept_embeddings`
- Fallback: fetch scoped rows + client cosine if RPC unavailable

### `upsertConceptEmbedding(row)`

- Insert on conflict do nothing for cache key
