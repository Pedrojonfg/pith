# Deep Dive: Global Knowledge Vault (Phase A+)

## 1. Qué construimos

A persistent **cross-document knowledge store** in the browser that remembers which concepts the user has practiced across uploads. On session exit, the app collects assessment signals and block responses, optionally deduplicates concepts via one LLM call, and writes normalized entries to `localStorage`. That history then **calibrates** pre-packing assessment (presumed-known markers), concept packing prompts, and per-block generation hints—without replacing per-document assessment. A **Knowledge Vault** debug panel in Settings exposes the store for inspection, export, and clear.

## 2. Decisiones de diseño

### Session-close batch vs real-time vault writes

- **Elegido**: Update vault only when leaving study (`enterModeSelectScreen` → `updateVaultFromSession`), not after every answer.
- **Alternativas**: Real-time writes after each MCQ; nightly background sync.
- **Trade-off**: Lower write/LLM churn and simpler mental model; mastery in vault lags until exit (acceptable for A+).

### Exponential decay EMA for mastery

- **Elegido**: Persist `masteryBase` + `masteryLastUpdated`; on read apply `masteryBase * exp(-λ·days)`; on write decay then `decayed + α·signal`, clamped [0,1] (`ALPHA=0.3`, `LAMBDA=0.05`).
- **Alternativas**: BKT (deferred); plain running average (no forgetting).
- **Trade-off**: Deterministic and testable without LLM; not a full cognitive model.

### LLM normalization once per close

- **Elegido**: `normalizeConceptsToVault()` when new concepts exist and vault has topic-matched entries; empty vault → all `new` without LLM.
- **Alternativas**: Embeddings dedup; exact string match only.
- **Trade-off**: Handles aliases (“chain rule” vs localized titles); bounded cost, can fail → fallback all-new.

### Topic tags piggyback on hierarchy LLM

- **Elegido**: `topics: string[]` in existing `buildDocumentHierarchy` JSON → `shared.docTopics`.
- **Alternativas**: Separate topic call; user-entered tags.
- **Trade-off**: Zero extra round-trip; tags quality depends on hierarchy pass.

### localStorage split at ~300KB

- **Elegido**: Primary key metadata + `mylearning_knowledge_vault_data` for entries overflow (same pattern as large sessions).
- **Alternativas**: IndexedDB; LRU eviction.
- **Trade-off**: Reuses existing patterns; 5MB ceiling still applies.

### `isSliceResumable` aligned with mode-continuity contract

- **Elegido**: RSVP/Questions resumable when `n_blocks > 0` **and** `blocks.length > 0`, OR any block has generated content.
- **Alternativas**: Only `hasGeneratedBlockContent` (broke resume after pack-before-generate).
- **Trade-off**: User can resume block index without generated explanations; matches `mode-bootstrap-api.md`.

### Debug UI as sole user-facing vault surface (A+)

- **Elegido**: Settings → Knowledge Vault table; no manual edit, no graph nav.
- **Trade-off**: Trust/QA visibility without scope creep.

## 3. Conceptos aplicados

| Concepto | Qué es | Dónde en nuestro código |
|----------|--------|-------------------------|
| **Exponential decay** | Forgetting curve on idle time | `getCurrentMastery()` in `mastery-model.js` |
| **Exponential moving average (EMA)** | Blend new signal with decayed state | `updateMastery()` in `mastery-model.js` |
| **Observer / event batching** | Defer side effects to boundary | `triggerVaultUpdateOnSessionExit()` in `study.js` |
| **Pipeline / staged ETL** | Ordered transforms on close | `session-close.js`: filter → normalize → merge → observe → elevate → save |
| **Entity normalization / dedup** | Map external IDs to canonical store | `mergeNormalizationResult()`, `normalizeConceptsToVault()` |
| **Bidirectional graph index** | Prereq + inverse dependents | `addPrerequisiteRelation()` in `prerequisites.js` |
| **Prompt injection** | Append context blocks to LLM prompts | `buildVaultContextBlock()`, `buildBlockVaultHint()` |
| **Sharding / overflow storage** | Split payload when JSON > threshold | `saveVault()` / `loadVault()` in `vault-store.js` |
| **Pure functions + contracts** | Testable logic without DOM | `mastery-model.js`, `normalization.js`, `mode-bootstrap.js` |
| **Dynamic import** | Avoid circular deps / heavy load on boot | `import("./vault/session-close.js")` in `study.js` |
| **Fire-and-forget async** | Non-blocking navigation | `.catch()` on vault close promise |

## 4. Deuda técnica y mejoras

**Bien hecho**

- Clear module split under `src/js/vault/` with contracts in `specs/`.
- Graceful degradation: corrupt JSON, LLM failure, empty vault.
- 61 cursor-tests + mutation check at 100% on core mutants.
- PWA versioning bumped with SW regression test.

**Chapuzas / límites**

- `session-close.js` dynamically imports `api.js` for normalization → coupling and harder tree-shaking; better: inject `normalizeFn` or shared thin API facade.
- `doc.shared._vaultPendingObservations` is an ad-hoc queue for assessment contradictions; should be a named type in `session-types.js` and cleared in one place.
- `mergeNormalizationResult` mutates vault in memory while `addSource`/`upsertEntry` reload from disk—callers must use one pattern consistently.
- Topic match is loose substring (intentional per spec) → false positives possible.
- No cycle detection on prerequisites (deferred); prompts ignore cycles only heuristically.
- Debug UI wired via corner link + setup screen; no deep link from mode select.

**No escalaría sin cambios**

- 1000+ concepts in one browser profile (localStorage size, normalization prompt size).
- Multi-device sync (needs backend).
- LLM normalization quality across languages without richer ontology.
- Relying on `concept_id` alignment between RSVP inventory and vault `sources` when inventories diverge across modes.

**Regresión conocida (no vault)**

- `flow-recommendation-hierarchy-meta`: Spanish first-person fixture fails `lecture_notes` heuristic—`analyzeText` English-biased.

## 5. Preguntas de consolidación

1. Walk through `updateVaultFromSession`: in what order do normalization, observations, and prerequisite elevation run, and what happens if the LLM returns invalid JSON after two documents on the same topic?

2. Why is `mastery` never written to `localStorage`, and how would displayed mastery differ from `masteryBase` in the exported JSON after 8 days without study?

3. When pre-packing assessment shows “✓ Presumed known”, what observation types are recorded on submit if the user confirms vs contradicts, and when do those reach the vault?

## 6. Actualización sugerida para .cursorrules

```text
## Knowledge Vault
- New vault logic lives under src/js/vault/; session-close is the only write path during study exit.
- Never persist runtime `mastery` to localStorage; only masteryBase + masteryLastUpdated.
- LLM normalization: one call per session-close max; empty vault must not call LLM.
- RSVP resume: n_blocks > 0 and blocks.length > 0 is resumable (mode-continuity contract), not only hasGeneratedBlockContent.
```
