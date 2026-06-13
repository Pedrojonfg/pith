# SPEC: `20260609-unified-session`

**Feature**: Sesión unificada cross-mode  
**Estado**: Draft  
**Prioridad**: Alta — desbloquea integración Slow→Cloze, agenda SM-2, y la mayoría de mejoras pedagógicas futuras  
**Rompe**: el schema actual de `sessionsByMode` en localStorage (requiere migración)  
**No toca**: la lógica interna de cada modo (sus pipelines, prompts, UI). Solo la capa de datos.

---

## El problema en una frase

Un documento es una unidad de estudio, pero la app lo trata como cuatro objetos independientes. Cuando cambias de modo, pierdes todo el contexto que construiste en el otro.

---

## Decisión de diseño central: un documento = una `DocumentSession`

Cada documento que subes genera una `DocumentSession` identificada por el hash de su markdown normalizado. Esta sesión tiene dos capas:

- **`shared`**: datos que cualquier modo puede leer y escribir — el texto, la jerarquía, los conceptos detectados, las anotaciones, los ítems SM-2.
- **`modes`**: slices privados de cada modo — `modes.rsvp`, `modes.slow`, `modes.cloze`, `modes.questions`. Cada slice contiene exactamente lo que contenía antes en `sessionsByMode[mode]`.

Los modos no se tocan entre sí directamente. Se comunican a través de `shared`. Esto es importante — no es que Cloze llame a funciones de Slow Mode, sino que Cloze lee `session.shared.annotations` y `session.shared.conceptInventory` que Slow Mode escribió.

### ¿Por qué no un único grafo compartido?

Los grafos de RSVP y Cloze tienen schemas incompatibles (nodos `block:` vs nodos epistémicos puros). Forzarlos al mismo schema sería un refactor enorme con beneficio marginal. En cambio, lo que sí tiene sentido compartir son los **inputs** que alimentan esos grafos: el inventario de conceptos y las anotaciones del usuario. Cada modo construye su grafo, pero lo hace con más contexto.

---

## Schema completo

Ver `data-model.md` y `contracts/session-store-api.md` para el contrato formal.

### Almacenamiento en localStorage

```
localStorage['pith_doc_sessions'] = DocumentSession[]
localStorage['pith_active_doc_id'] = string | null
```

Tamaño: una sesión típica (paper de 40 páginas) ocupa ~150-400KB. Con 20 documentos, ~4-8MB — cerca del límite de localStorage. Mitigación: si la sesión supera 400KB, guardar `rawMarkdown` en `pith_doc_text_{docId}`.

---

## Comportamiento nuevo que esto desbloquea

### A — Cloze importa el trabajo de Slow Mode

Cuando el usuario entra a Cloze en un documento donde ya hizo Slow Mode con grafo enriquecido desbloqueado:

- Pipeline cloze salta la fase 0 (grafo epistémico LLM)
- Usa `session.shared.conceptInventory` como base de nodos
- Usa `session.shared.annotations` como contexto adicional para los ítems
- Solo ejecuta fases 2-4 (ítems NODE/EDGE, distractores, QA)

### B — Pool SM-2 unificado

Todos los ítems cloze, RSVP y flashcards futuras van a `shared.smItems`. La pantalla de revisión puede consultar `getSmItemsDueToday()`.

### C — Pantalla de documentos estudiados

Lista de `getAllSessions()` con título inferido, modos completados, última actividad e ítems SM-2 pendientes.

---

## Módulos nuevos

- `src/js/session-store.js` — capa de acceso a datos
- `src/js/session-migration.js` — migración V1→V2 al boot

## Módulos modificados

- `src/js/session.js` — wrapper thin que delega en `session-store.js`
- `src/js/study.js` — orquestador usa `DocumentSession`
- `src/js/graph/adapters.js` — recibe `shared` como input opcional
- `src/js/cloze/pipeline.js` — fase 0 condicional
- `src/js/slow/*` — anotaciones y conceptos escriben en `shared`

---

## ROADMAP (tareas)

| ID | Descripción |
|----|-------------|
| T01 | Schema y tipos + `session-store.js` CRUD |
| T02 | Migración V1→V2 (`session-migration.js`) |
| T03 | `session.js` wrapper + boot migration |
| T04 | `study.js` usa DocumentSession |
| T05 | Slow Mode escribe en `shared` |
| T06 | Cloze lee de `shared` |
| T07 | `adapters.js` recibe `shared` |
| T08 | Pantalla documentos estudiados (opcional) |
| T09 | Tests de integración |

---

## Criterio global de done

Dado el mismo paper filosófico, estudiado en secuencia:

1. Slow Mode hasta Fase 3 → `shared.annotations` y `shared.conceptInventory` tienen datos
2. Abrir Cloze en el mismo documento → pipeline no llama al LLM en fase 0; ítems referencian conceptos del Slow Mode
3. Los ítems cloze aparecen en `shared.smItems`
4. Abrir RSVP en el mismo documento → datos de Slow y Cloze intactos
5. Cerrar navegador, reabrir → todo persiste correctamente
