# Deep Dive: SM-2 Priority Queue

**Date**: 2026-06-13  
**Feature**: `20260620-sm2-priority-queue`  
**Spec**: `specs/20260620-sm2-priority-queue/spec.md`

---

## 1. Qué construimos

Un sistema de repetición espaciada SM-2 no bloqueante para la PWA de estudio. Cada documento mantiene una cola unificada de `SmItem` en `shared.smItems`, ordenada por urgencia (`scheduledDue`), pero el usuario puede repasar antes de tiempo sin que el algoritmo “castigue” el intervalo. Los modos RSVP, Cloze, Slow flashcards y el vault de conocimiento alimentan la misma piscina. La UI mínima añade un botón **Review** con badge en la pantalla de selección de modo y un flujo de estudio con cuatro botones de calidad y chip “Early review”.

---

## 2. Decisiones de diseño

### Non-blocking SM-2 (time orders, never blocks)

**Elegido**: Ordenar por `scheduledDue`; permitir review en cualquier momento; avanzar intervalo solo si `isOnTime(item, now)`.

**Alternativas descartadas**:
- Due-date lock clásico — bloquea práctica útil.
- FSRS — fuera de scope.

**Trade-off**: Los ítems pueden reaparecer “antes de lo esperado” si el usuario repasa mucho en modo early; mitigado con chip UI + historial de observaciones.

### THRESHOLD_RATIO = 0.7 (on-time window)

**Elegido**: On-time cuando `now >= scheduledDue - intervalMs * 0.3`; primera review siempre on-time.

**Alternativas**: 50% (demasiado permisivo), solo `scheduledDue` exacto (equivalente a bloqueo duro).

**Trade-off**: Constante fija no configurable en v1.

### `normalizeSmItem` on read (no migration script)

**Elegido**: Normalizar en `getSession`, `upsertSmItem`, `buildReviewQueue`, `getSmItemsDueToday`.

**Alternativas**: Wipe `smItems` (pérdida de datos), dual-read en cada consumidor (complejidad).

**Trade-off**: Escrituras persisten forma canónica; lecturas toleran legacy indefinidamente.

### `sm2.js` puro + `sm2-ingest.js` delgado

**Elegido**: Algoritmo sin side effects en `sm2.js`; registro en `sm2-ingest.js`; hooks mínimos en `study.js` / modos.

**Alternativas**: Todo en `session-store` o `study.js` — diffs enormes y acoplamiento.

**Trade-off**: Dos módulos que mantener; tests unitarios solo en el núcleo.

### Vault bridge: shape-only update

**Elegido**: `buildVaultSmItem` emite `sourceType: vault_concept`, `scheduledDue`; lógica de elegibilidad sin cambios.

**Alternativas**: Reescribir bridge Post A+ — fuera de scope.

**Trade-off**: Tests T13 actualizados de `source: vault_decay` → `sourceType: vault_concept`.

### Reutilizar `screenReview` para SM-2

**Elegido**: Vista `reviewSm2View` dentro de `screenReview`; flujo LLM (`reviewSessionBtn`) intacto.

**Alternativas**: Pantalla nueva — DOM extra innecesario.

**Trade-off**: `reviewQuitBtn` debe bifurcar según `sm2ReviewActive`.

---

## 3. Conceptos aplicados

| Concepto | Qué es | Dónde en el código |
|----------|--------|-------------------|
| **Pure functions** | Sin I/O ni estado global | `src/js/sm2.js` — `updateSmItem`, `buildReviewQueue` |
| **Stable sort** | Orden determinista con desempate por índice | `buildReviewQueue` — sort por `scheduledDue` + `index` |
| **Schema normalization** | Adapter legacy → canónico | `normalizeSmItem`, `normalizeSessionSmItems` en `session-store.js` |
| **Upsert / dedup key** | Clave primaria `id`, secundaria `(sourceType, sourceId)` | `upsertSmItem`, `registerOrUpdateSmItem` |
| **Priority queue (view)** | Cola derivada, no almacenada | `buildReviewQueue` — copia ordenada |
| **Threshold gating** | Ventana temporal para “on-time” | `isOnTime` + `THRESHOLD_RATIO` |
| **Observation log** | Event sourcing ligero por ítem | `SmObservation[]` en cada `updateSmItem` |
| **Bridge pattern** | Vault → smItems sin duplicar lógica de mastery | `vault/spaced-review.js` + `applyVaultReviewObservation` en review |
| **Fail-soft hooks** | Ingesta no rompe estudio | `try/catch` + `console.warn` en `study.js`, `cloze/study.js`, `phase3.js` |
| **PWA cache busting** | `SW_VERSION` + `CACHE_NAME` alineados | `sw-update.js`, `index.html`, `sw.js` |

---

## 4. Deuda técnica y mejoras

**Bien hecho**
- Núcleo SM-2 testeado de forma aislada antes del wiring.
- Normalización centralizada evita migraciones one-shot.
- Regresión T13 y unified-session actualizadas.

**Chapuzas / límites**
- Ingesta RSVP solo en `handleTestAnswer` (Questions mode comparte path, pero assessment runner legacy no ingesta).
- Cloze mapea solo correct/incorrect → EASY/FAIL, no EASY/MEDIUM/HARD granular.
- `reviewQuitBtn` comparte handler LLM + SM-2 con flag global `sm2ReviewActive`.
- Subagents `sm2-t0x` creados pero Task tool aún no los registra como `subagent_type`.

**No escalaría sin trabajo**
- `getSmItemsDueToday` escanea todas las sesiones si `docId` es null — OK ahora, costoso con miles de docs.
- Sin índice por `(docId, scheduledDue)` — lineal en `smItems.length`.
- Sin tests E2E browser del badge ni del flujo Review completo.
- Mutation testing automatizado (Stryker) no configurado.

---

## 5. Preguntas de consolidación

1. ¿Por qué un review “early” no debe modificar `interval`/`repetitions`/`easeFactor`, pero sí debe añadir una `observation` con `wasEarly: true`?
2. ¿Cómo resuelve `upsertSmItem` un conflicto cuando llega un ítem con `id` distinto pero mismo `(sourceType, sourceId)`?
3. ¿Qué diferencia hay entre `getQueueStats().dueNow` (badge) y `buildReviewQueue()` (pantalla Review) en cuanto a ítems incluidos?

---

## 6. Actualización sugerida para `.cursorrules`

1. **SmItem canonical only on write**: After `normalizeSmItem`, persist only canonical fields (`sourceType`, `scheduledDue`, `observations`); never write `nextReview` or `sourceMode` in new code paths.
2. **SM-2 ingest fail-soft**: Mode hooks that call `registerOrUpdateSmItem` MUST wrap in try/catch with `console.warn` — never throw into study flow.
3. **SW bump on SM-2 UI changes**: Any change to Review badge/session markup requires `SW_VERSION`, `index.html` `?v=`, and `CACHE_NAME` together (already in rules; reinforce for `reviewSm2View`).

---

## Validate closure (reference)

```
Tests generados:     55 (26 unit + 29 integration) + regression suite
Fuente de aserciones: specs/20260620-sm2-priority-queue/spec.md
Regression run:      sí — unified-session, cloze-shared, kv-post-t13, flow-tracker, SW flow
Mutation check:      omitido — Stryker no instalado; spot-check manual vía tests early/on-time
Bugs encontrados:    unified-session-integration esperaba sourceMode legacy (corregido)
```
