# Quickstart: Vault Embedding Quality Layer

## Prerequisites

1. Gemini API key in Settings (`gemini_api_key` in localStorage).
2. Signed in to Supabase (embeddings tables require `user_id`).
3. Apply migration: `supabase/migrations/20260629_vault_embedding.sql` via Supabase SQL editor or CLI.

## Verify R0 — Embedding cache

1. Upload a document with concepts.
2. Re-upload same material — check network: second run should hit `concept_embeddings` cache (no duplicate embed API for same text hash).

## Verify R1 — Novelty

1. Upload to empty project → confirmation shows ~100% new material.
2. Upload related doc to same project → lower average novelty badge.

## Verify R2/R4 — Dedup proposals

1. Open Settings → Knowledge Vault overlay.
2. After DPP with similar concepts, pending merge proposals appear.
3. Reject a proposal → same pair must not reappear.

## Verify R3 — Merge

1. Approve proposal with dry-run preview.
2. Confirm source concept shows `merged_into` in registry; SM-2 items relinked.

## Verify R5 — Doc similarity

1. Upload two related PDFs in same project.
2. Doc library shows "related" badge; high similarity shows duplicate warning on create confirm.

## Graceful degradation

1. Clear Gemini key → upload completes; DPP phases T1.8/T1.9 show `skipped` in preparation state.

## Tests

```bash
node cursor-tests/20260621_embedding-cache.mjs
node cursor-tests/20260621_novelty-empty-vault.mjs
node cursor-tests/20260621_dedup-gate-chain.mjs
node cursor-tests/20260621_graceful-degradation.mjs
# ... see spec §13
```
