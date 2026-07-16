# Research: Pack Export Backend

**Feature**: `specs/20260716-pack-export-backend`  
**Date**: 2026-07-16

## 1. conceptGraph shape

**Decision**: Snapshot clones `shared.conceptGraph` as `{ nodes: object[], edges: object[] }` (passthrough; no reshape).

**Rationale**: Session code consistently treats graph as `{ nodes, edges }` (`session-store.js`, cloze pipeline, document-images/vision.js, probe-graph).

**Alternatives considered**: Flattening to editor-specific schema — deferred to graph-editor spec.

## 2. recall `source_chunks`

**Decision**: Treat as `string[]`. Rewrite replaces each string in place; empty array after filter is a failure for that question path only if questions exist with chunks.

**Rationale**: `recall-slice.js:88-98` maps entries through `String(...).trim()` and stores `source_chunks: sourceChunks`.

**Alternatives considered**: Object `{ text, ... }` — not present in normalized recall slice.

## 3. Vault fields in session snapshot

**Decision**: Vault rewrite kinds are **no-ops**. Pack export never reads `user_vault` / vault tables. `rewritePackExcerpt` still accepts `vault_definition` | `vault_notes` for forward compatibility but `finalizePack` does not call them.

**Rationale**: Vault is global (`user_vault` jsonb blob). `extractVaultCandidates` output is curation UI state, not a DocumentSession `shared` subtree. Spec FR-008 + Assumptions.

**Alternatives considered**: Scanning snapshot for definition/notes keys — YAGNI; no stable session path found.

## 4. Deep clone

**Decision**: Reuse the same pattern as `deepCloneSession` in `dpp-persistence.js` (`structuredClone` with JSON fallback) on the built snapshot object. Do not share references with `doc.shared`.

**Rationale**: Production-proven for session JSON; snapshot is JSON-serializable.

**Alternatives considered**: Importing `deepCloneSession` for whole session then picking keys — works but clones more than needed; local `deepCloneJson` helper in `pack-export.js` is enough (ponytail: ~8 lines, avoid new shared util unless reused).

## 5. Supabase table + RLS + code lookup

**Decision**:
- Table `public.shared_packs` per spec columns.
- RLS: owners `FOR ALL` where `auth.uid() = owner_user_id`.
- No broad SELECT on published rows for non-owners.
- RPC `lookup_shared_pack_by_code(p_code text)` `SECURITY DEFINER` returns published row for authenticated callers when `code` matches and `status = 'published'`.
- Unique index on `code` (NULLs allowed for drafts).

**Rationale**: Matches `auth.uid()` patterns in `20260705_cross_device_persistence.sql`; RPC avoids enumerable published SELECT.

**Alternatives considered**: Policy `status = 'published'` readable by all authenticated — rejected (enumeration).

## 6. Module layout

**Decision**: Single module `src/js/pack-export.js` (mirrors `recall-api.js`): pure snapshot/strip helpers + `rewritePackExcerpt` + `createPackDraft` / `finalizePack` + thin Supabase helpers. Export `jaccardOverlap` from `fidelity-validation.js` for the quality gate and tests.

**Rationale**: One consumer surface for graph-editor/import specs; avoids bloating `api.js`.

**Alternatives considered**: Split `pack-persist-supabase.js` — premature until import feature needs shared persist helpers.

## 7. LLM provider (Mistral vs platform)

**Decision**: Use platform chat via `llmChatCompletions` (DeepSeek / `deepseek-chat`). Temperature `0.3`. Dynamic `max_tokens` from input length. Do **not** add a Mistral service to `llm-proxy` in this feature.

**Rationale**: `llm.js` comments and `normalizeLlmModel` force DeepSeek for all chat; proxy only knows `deepseek` | `gemini-chat` | `gemini-embed`. Source note preferred Mistral Medium/Large for one-shot quality, but that provider is not on the platform path. DeepSeek is the available quality chat model; prompt + Jaccard gate enforce anti-verbatim.

**Alternatives considered**: Extending llm-proxy for Mistral — out of scope / external credentials blocker for plan-feature-auto.

## 8. Jaccard gate

**Decision**: After rewrite, require `jaccardOverlap(original, rewritten) < 0.3` for every rewritten chunk; failure → reject finalize, leave draft.

**Rationale**: Spec SC-002 / Assumptions; inverse use of fidelity helper.

**Alternatives considered**: Soft warn — rejected (FR-006 fail-closed).
