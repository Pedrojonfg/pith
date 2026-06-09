# Quickstart: Unified Cross-Mode Session

**Feature**: `20260609-unified-session`

## Prerequisites

- Branch `20260609-unified-session` (o feature directory activo en `.specify/feature.json`)
- `20260609-doc-hierarchy-index` recomendado (docHierarchy en shared)
- Navegador con localStorage habilitado

## Automated tests

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260609_unified-session-crud.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260609_unified-session-migration.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260609_unified-session-integration.mjs
```

## Manual QA

### QA-1 — MVP: datos persisten entre modos

1. Subir paper filosófico
2. Estudiar en RSVP (generar al menos 1 bloque)
3. Cambiar a Slow Mode sin re-subir
4. Volver a RSVP → bloques intactos

### QA-2 — Migración V1

1. En DevTools, simular V1: solo `sessions_by_mode` con sesión slow completa
2. Recargar app
3. Verificar `mylearning_doc_sessions` creado, `mylearning_v1_backup` presente
4. Anotaciones visibles en Slow Mode

### QA-3 — Slow → Cloze integración

1. Completar Slow Mode hasta Fase 3 (`graphEnrichedUnlocked`)
2. Abrir Cloze en el mismo documento
3. Pipeline no ejecuta fase 0 LLM (network tab)
4. Ítems referencian conceptos del inventario compartido

### QA-4 — SM-2 pool

1. Generar ítems en Cloze y RSVP del mismo doc
2. `getSmItemsDueToday()` devuelve ambos con `sourceMode` distinto

### QA-5 — Re-subida mismo documento

1. Subir documento, estudiar
2. Subir el mismo archivo de nuevo
3. Recupera sesión existente (mismo `docId`), no sesión vacía

### QA-6 — Persistencia

1. Flujo QA-3
2. Cerrar pestaña, reabrir
3. Todos los modos conservan progreso

## Dev inspection

```js
JSON.parse(localStorage.getItem('mylearning_doc_sessions'))
localStorage.getItem('mylearning_active_doc_id')
```

## Global done checklist

- [x] T01–T04 MVP (no silos destructivos)
- [x] T05–T06 integración Slow→Cloze
- [x] T07 grafos coherentes
- [x] T09 tests verdes
