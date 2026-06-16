# Quickstart — SM-2 Priority Queue

## Orden de implementación recomendado

### Paso 1 — `src/js/sm2.js` (funciones puras, ~80 líneas)
Crear el módulo con `createSmItem`, `updateSmItem`, `isOnTime`, `buildReviewQueue`, `getQueueStats`.
Testear con `cursor-tests/sm2.test.mjs` antes de tocar nada más.

### Paso 2 — `session-store.js`: añadir `upsertSmItem`
Una función de 8 líneas. Asegurarse de que `shared.smItems` se inicializa como `[]` en `normalizeSession`.

### Paso 3 — Conectar RSVP / Questions
En `study.js`, tras registrar respuesta en bloque, llamar a `registerRsvpBlockAnswer`.
Verificar en DevTools que `smItems` crece en localStorage.

### Paso 4 — Botón Review con badge
En `screenModeSelect`, al mostrar pantalla, calcular `getQueueStats` y mostrar badge si `dueNow > 0`.

### Paso 5 — `screenReview` con priority queue
Reemplazar la lógica actual de Review por `buildReviewQueue(session.shared.smItems)`.
Mostrar ítem, capturar respuesta, llamar `updateSmItem`, guardar, siguiente.

### Paso 6 — Conectar Cloze y Slow
Una vez validado con RSVP, añadir los hooks en `cloze/study.js` y `slow/phase3.js`.

## Lo que NO tocar en este sprint
- El pipeline de RSVP (blocks, ensureBlockGenerated, packing)
- El GKV / knowledge-vault (usa smItems existentes sin tocarlo)
- El diseño visual de Review más allá del badge y el chip "⚡ Repaso anticipado"
