# Deep Dive: Global Knowledge Vault (Post A+)

## 1. Qué construimos

Extensión del Knowledge Vault A+ con **curación manual**, **importación externa** (texto, documento sin sesión, CSV/JSON), **detección de misconceptions**, **maestría declarativa/procedimental** (con BKT opcional a ≥15 obs), **grafo de prerequisitos robusto** (ciclos → co-prereqs, inferencia LLM cross-doc, centralidad), **visualización gráfica** del vault y **spaced review** alimentado por decay del vault. Todo persiste en `localStorage` schema v2, sin backend.

## 2. Decisiones de diseño

### Schema v2 + migración on-read

- **Elegido**: `loadVault()` migra v1→v2 inyectando `misconceptions`, `coPrerequisites`, dimensiones de maestría, `manualOrigin`; `rebuildDependents()` reconstruye aristas inversas desde `prerequisites`.
- **Alternativas**: Migración one-shot al primer save; dual-read indefinido.
- **Trade-off**: Sin script de migración separado; cualquier write posterior persiste v2. Tests que solo setean `dependents` sin `prerequisites` rompen — el grafo debe modelarse por prereqs.

### Merge como operación de grafo, no solo de datos

- **Elegido**: `mergeEntries(survivor, merged)` reasigna obs/sources, une aliases, reemplaza IDs en prereqs/dependents/co-prereqs de todo el vault, elimina el merged.
- **Alternativas**: Soft-delete merged; merge lazy en lectura.
- **Trade-off**: Operación O(n) sobre entries pero invariantes fuertes; un bug aquí corrompe el grafo entero.

### Ciclos → co-prerequisites bidireccionales

- **Elegido**: `addPrerequisiteSafe` detecta arista inversa o camino DFS y convierte el par en `coPrerequisites` mutuos, eliminando edges one-way conflictivos.
- **Alternativas**: Rechazar el edge; permitir ciclos.
- **Trade-off**: Modela “aprender A y B en cualquier orden”; no distingue equivalencia fuerte de mera correlación.

### Import con partial success

- **Elegido**: CSV/JSON validan fila a fila; filas válidas persisten; errores en `ImportRecord.errors[]` + UI.
- **Alternativas**: Transacción todo-o-nada.
- **Trade-off**: Mejor UX para archivos grandes con ruido; estado intermedio posible.

### Misconception: regla local + LLM opcional

- **Elegido**: ≥3 negative obs con mismo `wrongAnswer` en 30 días → misconception; máx 1 LLM/session; auto-resolve tras 3 positivos consecutivos.
- **Alternativas**: LLM siempre; umbral 2 obs.
- **Trade-off**: Coste acotado; falsos positivos mitigados por umbral alto.

### Maestría dual + BKT gated

- **Elegido**: `taskKind` rutea a declarative/procedural; blend 0.4/0.6; `maybeEnableBkt` al 15º obs.
- **Alternativas**: BKT desde el inicio; una sola dimensión.
- **Trade-off**: Calibración más fina cuando hay señal; complejidad en `getCurrentMastery`.

### Importancia topológica simple

- **Elegido**: `dependents.length + 0.5 * coPrerequisites.length` recalculado en mutaciones de prereq.
- **Alternativas**: PageRank; betweenness centrality.
- **Trade-off**: O(n) barato; suficiente para priorizar review y layout de grafo.

### Spaced review como bridge a `smItems`

- **Elegido**: `syncVaultToReviewPool` inserta items `vault:*` con prioridad `(0.5 - mastery) * (1 + importance/10)`; preserva items no-vault.
- **Alternativas**: Cola separada solo-vault; duplicar SM engine.
- **Trade-off**: Reutiliza SM v1 existente; mezcla fuentes en un pool compartido.

### Debug UI como hub operativo

- **Elegido**: Settings → Knowledge Vault con edit/merge/delete/add, import, graph launcher, pending inferred edges.
- **Trade-off**: Mucha superficie en un panel; no hay pantalla dedicada de gestión fuera de Settings.

## 3. Conceptos aplicados

| Concepto | Dónde |
|----------|-------|
| **Graph invariant maintenance** | `rebuildDependents`, `replaceEntryIdReferences`, `addPrerequisiteSafe` |
| **DFS cycle detection** | `prerequisite-graph.js` al añadir arista |
| **EMA + exponential decay** | `mastery-model.js` (heredado A+, extendido por dimensión) |
| **Bayesian Knowledge Tracing** | `bktMastery`, `maybeEnableBkt` en `mastery-model.js` |
| **Schema migration on read** | `migrateEntryV2` en `vault-store.js` |
| **Adapter pattern** | `vault-graph.js` → `buildVaultGraph` para `graph/view.js` |
| **Partial failure pipeline** | `importStructuredRows`, `parseCsvText` |
| **Prompt injection / context assembly** | `prompt-injection.js` + misconceptions |
| **Priority queue heuristics** | `spaced-review.js` centrality-weighted decay |
| **localStorage sharding** | Mismo split 300KB que A+ |
| **Cooldown-gated LLM batch** | `shouldRunInference` (5 docs, 7 días) |

## 4. Deuda técnica y mejoras

**Bien hecho**
- Módulos bajo `src/js/vault/` con contratos en specs; 280+ assertions en cursor-tests.
- Co-prereqs y merge con tests de invariantes.
- Mutation check A+ suite mata 6/6 mutantes.

**Chapuza funcional**
- `debug-ui.js` es monolito (~700 líneas): modales, import, inferencia pending, graph launcher.
- Centralidad es conteo de aristas, no topología real.
- BKT con params fijos; sin per-concept calibration.
- Inferencia LLM requiere API key y 5 docs — difícil de QA manual sin fixtures.

**No escalaría**
- `rebuildDependents` + `replaceEntryIdReferences` en cada mutación con miles de entries.
- Grafo canvas con 100+ nodos ya tiene umbrales (topic picker a 150); sin clustering.
- `importHistory` capped a 20; sin export de audit trail.
- T15–T16 (sync, collaborative filtering) ausentes — vault sigue siendo single-device.

## 5. Preguntas de consolidación

1. Si `m1.prerequisites = ["m2"]` pero `m2.dependents` en JSON persistido está vacío, ¿qué valor tiene `m2.dependents` tras `loadVault()` y por qué?
2. ¿En qué orden se evalúan BKT, blend declarativo/procedimental y `masteryBase` legacy en `getCurrentMastery()`?
3. ¿Qué pasa si importas CSV con una fila válida que referencia un prereq por título inexistente — se importa la fila, se reporta error, o ambos?

## 6. Actualización sugerida para .cursorrules

1. **Vault graph invariants**: Nunca persistir `dependents` como fuente de verdad; siempre modelar con `prerequisites` y dejar que `rebuildDependents` sincronice en `loadVault`/mutaciones.
2. **Post-A+ imports**: Cualquier cambio en `vault-store.js` que toque prereqs debe llamar `recomputeImportanceScores` y considerar co-prereq side effects vía `addPrerequisiteSafe`.
3. **SW bump**: Al tocar `src/js/vault/**`, `index.html` o `src/css/**`, incrementar `SW_VERSION` en `sw-update.js` y `?v=` en `index.html` en el mismo commit.
