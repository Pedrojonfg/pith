# Deep Dive: Knowledge Vault Curation

## 1. Qué construimos

Cerramos el loop bidireccional entre sesiones de documento y el Global Knowledge Vault (GKV). El usuario puede curar manualmente definiciones y ítems de repaso facet-tagged desde conceptos **realmente estudiados**, y las respuestas en Review actualizan mastery, `facetCoverage`, y SM-2 por ítem. La navegación se bifurca en App Home (`Vault` / `Sessions`), reemplazando el hub global en `screenModeSelect`.

## 2. Decisiones de diseño

**App Home vs hub en modeSelect**
- Elegido: bifurcación explícita Vault/Sessions en primer nivel.
- Alternativa descartada: tres botones Continue/Library/Review en modeSelect (study-projects §7.3).
- Trade-off: un paso más para llegar al mode picker, pero separación clara vault-level vs session-level.

**Mastery escalar + facetCoverage metadata**
- Elegido: un solo `mastery` (A+), facets solo en `VaultReviewItem` y timestamps en `facetCoverage`.
- Alternativa descartada: mastery por faceta (sparsity como en BKT).
- Trade-off: no distingues dominio relacional vs aplicativo numéricamente, pero evitas ruido con pocas observaciones.

**Dual pool Review (smItems + reviewItems)**
- Elegido: dos stores, merge en consulta con `source: session|vault`.
- Alternativa: unificar en `shared.smItems`.
- Trade-off: más lógica de routing en `handleSm2QualityClick`, pero preserva semántica distinta (fallos de sesión vs ítems curados cross-doc).

**Schema v2 extendido (no v3)**
- Elegido: añadir `reviewItems`, `definitions`, `facetCoverage` al v2 existente.
- Alternativa: bump a schemaVersion 3.
- Trade-off: migración más simple, pero el número de versión ya no refleja solo A+.

**Decay calibration log**
- Instrumentación FIFO en `localStorage` sin tocar `lambda`.
- Prepara calibración futura sin riesgo de cambiar comportamiento actual.

## 3. Conceptos aplicados

| Concepto | Dónde |
|----------|--------|
| **Additive schema migration** | `vault-store.js` `migrateEntryCuration`, `reviewItems: []` on load |
| **Union of sets (studied concepts)** | `vault-curation.js` `collectStudiedConceptIds` |
| **Idempotent append** | `hasDefinitionFromDoc` + commit skip per `sourceDocId` |
| **Dual-source priority queue** | `review-project-scope.js` merge + `source` tag |
| **Exponential decay** | `applyVaultReviewItemObservation` predicted vs observed log |
| **SM-2 spaced repetition** | `updateSmItem` reused for `VaultReviewItem.sm2` |
| **FIFO cap** | `decay-calibration.js` max 1000 entries |
| **Navigation state machine** | `enterAppHome`, `enterVaultBranch`, `enterModeSelectScreen` |

## 4. Deuda técnica y mejoras

**Bien hecho**
- Módulo `vault-curation.js` con funciones puras testeables.
- Contratos spec + 42 tests de validación.
- Fix real encontrado en validate: `facet` no se propagaba en `applyObservations`.

**Chapuzas / límites**
- `mock-ui.mjs` del test loader no reflejaba `renderBreadcrumb` hasta el fix de regresión — deuda del harness, no del producto.
- `commitVaultCuration` hace `normalizeConceptsToVault` LLM en runtime (no testeable sin mock).
- Upload flow acoplado a `study.js` (orquestación + DOM render inline).
- `getVaultReviewDueCount` cuenta vault items globalmente, no por scope de proyecto en badge.

**No escalaría**
- Render inline de candidate list en `study.js` sin componente reutilizable.
- LLM batch sin timeout/retry policy centralizada.
- Dos URLs de módulo `ui.js` vs `ui.js?v=` en Node loader (mock vs real).

## 5. Preguntas de consolidación

1. ¿Por qué `facetCoverage` se actualiza al **revisar** y no al **crear** un `VaultReviewItem`, y qué implica eso para interpretar "cobertura de facet"?
2. ¿Cómo decide `handleSm2QualityClick` si actualizar `shared.smItems` o `vault.reviewItems`, y qué pasa si un ítem pierde el tag `source` tras `normalizeSmItem`?
3. ¿Qué garantiza la idempotencia de definiciones en re-upload y qué casos de `merge/alias` del LLM podrían saltársela?

## 6. Actualización sugerida para .cursorrules

1. Tras cambios en `vault/session-close.js` `applyObservations`, siempre propagar campos metadata nuevos (`facet`, etc.) a `updateMastery`.
2. Nuevas pantallas de primer nivel (`screenAppHome`) deben tener tests de markup en `cursor-tests/` y entrada en `main.js` bootstrap.
3. Al extender `mock-ui.mjs`, añadir stubs de exports que consumidores nuevos (`project-library.js`) requieran.
