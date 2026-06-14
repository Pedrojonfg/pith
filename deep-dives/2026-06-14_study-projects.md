# Deep Dive: Study Projects

**Date**: 2026-06-14  
**Feature**: `20260623-study-projects`  
**Spec**: `specs/20260623-study-projects/spec.md`

---

## 1. Qué construimos

Jerarquía de **Projects** que agrupa documentos (1:1, default `misc`), con browser en Library, review acotado por subject, y prioridad de contexto GKV por proximidad de proyecto al generar material. Migración idempotente backfill `projectId` + store `mylearning_projects`. UI: breadcrumbs, picker plano indentado, hub Continue/Library/Review en mode select, selector de proyecto en upload.

---

## 2. Decisiones de diseño

### Store plano + árbol derivado (`parentId`)

**Elegido**: `ProjectStore.projects[]` flat; árbol via `getChildren` / `getProjectTree`.

**Alternativas**: nodos anidados persistidos — más difícil de migrar y reparent.

**Trade-off**: reparent y cycle-check requieren walks; aceptable para profundidad v1 razonable.

### `project-store.js` puro + `project-library.js` orchestration

**Elegido**: CRUD/tree sin DOM/localStorage en `project-store.js`; wiring UI en `project-library.js`; `study.js` delega.

**Alternativas**: todo en `study.js` — archivo ya >8k líneas.

**Trade-off**: tests de contrato deben mirar dos módulos (p.ej. back button en `project-library.js`).

### `review-project-scope.js` separado de `review.js`

**Elegido**: filtrado puro exportado; `review.js` importa UI helper de library.

**Alternativas**: todo en `review.js` — rompe tests Node (loader mock de `ui.js`).

**Trade-off**: un módulo más; evita import cycles y facilita tests.

### Vault: ordenar por `scopeDepth`, nunca excluir

**Elegido**: `getVaultContextForDoc(session)` → scored entries; `buildVaultContextBlock` tres bandas; truncación futura general → related → never same.

**Alternativas**: filtrar entries ajenos al proyecto — viola FR-010 y US-3.

**Trade-off**: prompts más largos; calibración mejor en mismo subject.

### Sin bump de `schemaVersion` en DocumentSession

**Elegido**: `projectId` opcional en validación; `migrateProjects()` backfill.

**Alternativas**: schema v3 — innecesario para un campo root opcional.

**Trade-off**: sesiones legacy válidas pre-migración; consumidores deben usar `|| MISC_PROJECT_ID`.

### V1 migration fix: `recall: null` + `projectId`

**Elegido**: `buildDocumentSessionFromV1` emite sesión v2 completa.

**Alternativas**: relajar validación en migración — ocultaría sesiones mal formadas.

**Trade-off**: regression test unified-session-migration vuelve a pasar.

---

## 3. Conceptos aplicados

| Concepto | Qué es | Dónde |
|----------|--------|-------|
| **Tree on flat list** | Árbol con punteros `parentId` | `project-store.js` |
| **Cycle detection** | DFS descendants antes de reparent | `moveProject` |
| **Idempotent migration** | Boot step safe to re-run | `migrateProjects()` |
| **Pure module boundary** | Sin I/O en core | `project-store.js`, `review-project-scope.js` |
| **Scored sort** | Secondary key for prioritization | `getVaultContextForDoc` |
| **Facade orchestration** | DOM + callbacks | `project-library.js` |
| **Contract testing** | Static + functional asserts | `cursor-tests/20260623_*.mjs` |

---

## 4. Deuda técnica y mejoras

**Bien hecho**: invariantes misc/cycle/delete centralizados; tests por capa; GKV no filtra entries.

**Chapuzas funcionales**:
- `window.prompt` / `window.alert` para CRUD y move — usable pero feo.
- `renderDocLibrary` legacy coexistiendo con `renderProjectLibraryView` — duplicación de listado.
- Move overlay inline en `project-library.js` sin componente reutilizable.

**No escalaría**:
- `getVaultContextForDoc` llama `getAllSessions()` cada pack — O(n docs) por generación.
- Review scope UI repopulates select on every change — ok v1, pesado con muchos projects.
- Subagent Task enum no incluye `study-projects-t*` — solo files en `.cursor/agents/`.

---

## 5. Preguntas de consolidación

1. ¿Por qué `getReviewableItemsForProject` depende de **dos** stores (sessions + ProjectStore) y qué pasa si el árbol de projects y `session.projectId` divergen?

2. ¿Cómo se calcula `scopeDepth` cuando un vault entry tiene sources en varios documentos de distintos projects?

3. ¿Qué invariantes garantiza `migrateProjects()` en el segundo boot y por qué V1→V2 ahora debe emitir `recall` y `projectId`?

---

## 6. Actualización sugerida para .cursorrules

1. **Study Projects boot**: Any change to session shape must keep `migrateProjects()` + V1 builder passing `validateDocumentSession` (include `modes.recall`, optional `projectId` backfill).

2. **PWA bump**: Study Projects UI touches `index.html` / CSS / JS — always bump `SW_VERSION`, `?v=`, and `CACHE_NAME` together.

3. **Pure vs orchestration**: New project tree logic goes in `project-store.js`; DOM wiring only in `project-library.js` / `study.js` — keeps Node tests mock-free for core.
