# Deep Dive: Vault Personal Notes, Connections & Resumable Upload

**Feature branch:** `20260625-vault-notes-connections`  
**Spec:** `specs/20260625-vault-notes-connections/spec.md`  
**Date:** 2026-06-14

---

## 1. Qué construimos

Extendimos el Knowledge Vault para que cada entrada pueda llevar **notas personales en markdown**, **áreas**, **tags** y **conexiones `related[]` bidireccionales**, además del mastery y review items que ya existían. El flujo **Upload to Vault** ahora sugiere esos campos (vía LLM), los deja editar en pantalla y los confirma a través de una **cola persistida** (`pith_vault_upload_queue`) que procesa concepto a concepto (dedup → commit → backlinks) y puede **reanudarse** tras cerrar la pestaña. Resuelve el vacío entre “vault algorítmico” y “vault personal tipo Obsidian” sin romper imports CSV/JSON ni el campo legacy `topic`.

---

## 2. Decisiones de diseño

### Vault container `schemaVersion` 3 (no solo campos por entry)

**Elegido:** bump de `SCHEMA_VERSION` 2 → 3 en `vault-store.js` con migración lazy `migrateEntryNotesConnections` encadenada tras `migrateEntryV2`.

**Alternativas:** schema solo a nivel entry; archivo `vault-migration.js` separado (mencionado en `spec-notes.md`).

**Descartadas porque:** el proyecto ya usa versión de contenedor en `loadVault()`; un módulo aparte añadiría otro punto de entrada sin beneficio claro en una PWA sin build.

**Trade-off:** cualquier test o export que asuma `schemaVersion === 2` hay que actualizarlo (pasó en `20260618_knowledge-vault-a-plus.mjs`).

### Cola secuencial vs commit síncrono anterior

**Elegido:** `createUploadQueue` + `processUploadQueue` en `vault-upload-queue.js`; la UI encola y procesa en background dentro del mismo tab.

**Alternativas:** mantener `commitVaultCuration` síncrono (más simple); Service Worker / Background Sync.

**Descartadas:** sync bloquea la UI con N llamadas LLM; background fuera de tab está explícitamente out of scope.

**Trade-off:** dedup LLM se ejecuta **dos veces** por concepto (una en carga de candidatos para UI, otra en procesamiento de cola) — aceptable por aislamiento de fallos pero costoso en tokens/latencia.

### `related[]` con IDs de vault + resolución de siblings por `conceptId`

**Elegido:** checkboxes pueden marcar IDs de vault o `conceptId` de hermanos en el batch; `resolveRelatedAcceptedIds` resuelve hermanos vía `sources[]` tras commits previos en la cola.

**Alternativas:** guardar solo vault IDs en UI; resolver wikilinks en `notes`.

**Descartadas:** siblings no tienen vault ID hasta commit; wikilinks fuera de scope.

**Trade-off:** orden de la cola importa para backlinks entre hermanos del mismo batch (secuencial lo garantiza).

### Backlinks solo en `related[]`, vecinos sin tocar `status`

**Elegido:** `applyRelatedBacklinks` muta únicamente arrays `related` en ambos extremos.

**Alternativas:** flip `status` en vecinos; deduplicar `related` vs `prerequisites`.

**Descartadas:** spec §7 decisión 4 — vecinos pueden seguir `pending`.

**Trade-off:** un entry puede estar en `prerequisites` y `related` a la vez; la UI debe deduplicar visualmente (no lo hace el modelo).

### Settings en `pith_vault_settings` (localStorage suelto)

**Elegido:** `vault-settings.js` con `autoDraftNotes` default `true`.

**Alternativas:** flag en vault debug panel; campo en session meta.

**Descartadas:** no hay settings globales unificados; debug panel no es lugar de UX de curation.

**Trade-off:** otra clave de storage más; sin sync entre dispositivos.

### Notas en re-curación: append con `## Update YYYY-MM-DD`

**Elegido:** `mergeNotesForEntry` nunca sobrescribe; blank incoming es no-op.

**Alternativas:** overwrite; diff/merge manual.

**Descartadas:** spec decisión 2 — overwrite pierde voz del usuario.

**Trade-off:** notas pueden crecer sin límite; no hay compactación.

---

## 3. Conceptos aplicados

| Concepto | Qué es | Dónde en nuestro código |
|----------|--------|-------------------------|
| **Lazy schema migration** | Migrar datos al leer, no en batch offline | `migrateEntryNotesConnections` en `loadVault()` → `vault-store.js` |
| **Idempotent persistence** | Flush tras cada unidad de trabajo completada | `processUploadQueue`: `saveVault` + `saveUploadQueue` por item |
| **State machine (item queue)** | `pending → processing → done \| error` | `vault-upload-queue.js`; stale `processing` → `pending` en boot |
| **Singleton async lock** | Una sola ejecución de processor | `processingPromise` en `processUploadQueue` |
| **Bidirectional graph edge write** | Arista simétrica en dos nodos | `applyRelatedBacklinks(vault, entryId, relatedIds)` |
| **Reference resolution** | Traducir ID lógico → ID canónico | `resolveRelatedAcceptedIds` (conceptId → vault entry via `sources`) |
| **Batch context DTO** | Payload compartido para LLM/UI | `buildBatchContext` → `docId`, `concepts[]`, `existingVaultAreas[]` |
| **Prompt bounding / top-K** | Limitar candidatos en dedup | `buildDedupExistingEntries` en queue; slice(0, 40) en carga UI |
| **Dual field compatibility** | `topic` legacy + `area[]` nuevo | `applyPersonalFieldsToEntry` setea `topic = area[0]` |
| **Separation of concerns** | UI vs commit vs queue | `study.js` (render/enqueue) / `vault-curation.js` (commit) / `vault-upload-queue.js` (orchestration) |
| **Contract testing (static)** | Verificar exports/wiring sin browser | `cursor-tests/20260625_vault-notes-connections.mjs` lee `study.js`, `main.js` |
| **Feature flags / prefs** | Toggle de comportamiento LLM | `isAutoDraftNotesEnabled()` → `extractVaultCandidates` |

---

## 4. Deuda técnica y mejoras

**Bien hecho**

- Migración lazy encadenada reutiliza el patrón existente (`migrateEntryV2`, curation fields).
- Cola con reset de `processing` stale es robusta ante kill de tab.
- Backlinks acotados a `related[]` respetan el contrato de vecinos.
- Tests de regresión vault ampliados; contrato schema v3 corregido en suite A+.

**Chapuzas / frágil**

- **Doble LLM dedup** (load + queue): derroche y posible inconsistencia merge target entre pantalla y commit.
- **`commitVaultCuration` refactorizado** sigue existiendo para tests pero la UI usa solo cola; dos caminos de commit divergen.
- **Resolución de siblings**: si el hermano va *después* en la cola, el backlink del primero puede no resolver hasta que el segundo termine — no hay pass de reconciliación final.
- **`loadDedupSuggestionsForConcept`** usa `vault.entries.slice(0, 40)` sin scoring en UI load (el queue sí scorea) — prompts inconsistentes.
- **`processUploadQueue` con session stub** si no hay doc cargado: puede fallar commits que necesitan inventory completo.
- Sin tests E2E de `processUploadQueue` con LLM mockeado end-to-end.

**No escalaría**

- localStorage + cola secuencial + N× dedup LLM por upload grande (50+ conceptos).
- `related[]` plano sin índice inverso: buscar “quién apunta a mí” es O(n) sobre entries.
- Notas append-only sin TTL/compaction en entries muy re-curados.

---

## 5. Preguntas de consolidación

1. **¿Por qué la cola vuelve a llamar `normalizeConceptsToVault` en procesamiento si la UI ya lo hizo al cargar candidatos, y qué pasa si el vault cambia entre esos dos momentos?**

2. **¿Cómo se resuelve un `relatedAccepted` que es `conceptId` de un sibling cuando ese sibling aún no tiene entry en vault (item pendiente más adelante en la cola)?**

3. **¿Qué campos muta exactamente un vecino que solo recibe backlink, y qué invariantes de `status` / `topic` / import CSV deben seguir cumpliéndose después?**

---

## 6. Actualización sugerida para .cursorrules

1. **Vault schema bumps:** Any change adding entry-level fields MUST bump `SCHEMA_VERSION` in `vault-store.js`, extend `migrateEntry*`, and update vault-related `cursor-tests` that assert export schema version.

2. **Upload to Vault queue:** New upload commit paths MUST enqueue via `vault-upload-queue.js` (sequential per item, `saveVault` after each item); do not add synchronous multi-concept LLM+write loops in `study.js`.

3. **Neighbor writes on commit:** Backlink / neighbor updates MUST only touch `related[]` unless a spec explicitly widens scope; never flip neighbor `status` on backlink-only updates.
