# Research: Unified Cross-Mode Session

**Feature**: `20260609-unified-session` | **Date**: 2026-06-09

## R1 — Identificador de documento (`docId`)

**Decision**: SHA-1 del `rawMarkdown` normalizado (trim, LF), truncado a 12 caracteres hex vía `crypto.subtle.digest` (async). Fallback sync djb2 de 12 chars si `crypto.subtle` no disponible (tests Node).

**Rationale**: Mismo documento re-subido recupera sesión existente; 12 hex ≈ 48 bits — suficiente para uso local.

**Alternatives considered**:
- UUID por upload — no deduplica re-subidas del mismo texto
- Nombre de archivo — inestable entre uploads

## R2 — Claves localStorage V1 reales

**Decision**: Migrar desde `sessions_by_mode` (`LS_SESSIONS_BY_MODE_KEY` en `config.js`), no `sessionsByMode`. Mantener compatibilidad con `active_session` legacy (ya migrado a `sessions_by_mode.rsvp` por `migrateLegacyActiveSession`).

**Rationale**: El spec usa nombre conceptual; el código usa `sessions_by_mode`.

**Alternatives considered**:
- Renombrar clave V1 — rompe usuarios existentes sin beneficio

## R3 — Mitigación tamaño localStorage

**Decision**: Tras `JSON.stringify`, si payload >400KB, mover `shared.rawMarkdown` a `mylearning_doc_text_{docId}` y guardar `shared.rawMarkdownRef: { storageKey, charCount }` en su lugar. `getSession`/`getActiveSession` rehidratan transparentemente.

**Rationale**: Texto es ~80% del peso; externalizar preserva CRUD simple.

**Alternatives considered**:
- IndexedDB — correcto a largo plazo, fuera de scope
- Comprimir gzip — complejidad sync/browser sin ganancia en MVP

## R4 — Deduplicación `conceptInventory`

**Decision**: `canonicalId = hash(normalizeLabel(label))` donde `normalizeLabel` = lowercase, trim, quitar stopwords ES/EN básicas, colapsar espacios. Merge por `canonicalId`; conservar definición más larga y `detectedBy` como array.

**Rationale**: Evita duplicados RSVP+Cloze con labels ligeramente distintos.

**Alternatives considered**:
- Solo label exacto — alta tasa de duplicados
- Embeddings — overkill offline

## R5 — Estrategia migración V1→V2

**Decision**: `detectAndMigrateV1()` idempotente: si `mylearning_doc_sessions` existe y `schemaVersion >= 2`, skip. Si `sessions_by_mode` existe: inferir `rawMarkdown` orden slow > rsvp > cloze > questions (`rawText`, `rawMarkdown`, `materialText`); construir una `DocumentSession`; backup en `mylearning_v1_backup`; borrar `sessions_by_mode` solo tras `validateDocumentSession` OK.

**Rationale**: V1 asumía un documento activo; múltiples slots son del mismo doc.

**Alternatives considered**:
- Una DocumentSession por slot — incorrecto para el modelo unificado
- Borrar V1 inmediatamente — riesgo alto

## R6 — Wrapper `session.js` incremental

**Decision**: Fase 1 (T03): `loadSessionForMode`/`storeSessionForMode` leen/escriben slice dentro de `DocumentSession` activa vía session-store. API pública sin cambios. Fase 2 (T04+): `study.js` usa `getActiveSession()` directamente.

**Rationale**: Permite migrar modos uno a uno sin big-bang.

**Alternatives considered**:
- Reemplazar session.js de golpe — alto riesgo de regresión

## R7 — Condición skip fase 0 Cloze

**Decision**: Saltar fase 0 LLM si `session.modes.slow?.graphEnrichedUnlocked === true` **O** `session.shared.conceptInventory.length >= 5`. Umbral 5 alinea con spec T06.

**Rationale**: `graphEnrichedUnlocked` es señal fuerte; inventario ≥5 cubre Slow parcial sin enriched.

**Alternatives considered**:
- Solo graphEnrichedUnlocked — pierde caso Fase 0 completada sin enriched

## R8 — Integración `docHierarchy`

**Decision**: `shared.docHierarchy` usa el shape de `20260609-doc-hierarchy-index` (`DocHierarchy | null`). Al migrar V1, copiar `docHierarchy` desde el slice slow/rsvp si existe.

**Rationale**: Jerarquía es propiedad del documento, no del modo.

**Alternatives considered**:
- Mantener en slice slow — duplicación al cambiar modo

## R9 — SM-2 pool unificado

**Decision**: `shared.smItems[]` con `sourceMode`, `id` estable (UUID o compuesto `{sourceMode}:{localId}`). `upsertSmItem` por `id`. Modos siguen guardando en su slice durante transición; T06 escribe también en shared.

**Rationale**: Pool único para revisión cross-mode sin refactor SM-2 interno aún.

**Alternatives considered**:
- Mover SM-2 solo a shared de golpe — rompe review.js hasta adaptar
