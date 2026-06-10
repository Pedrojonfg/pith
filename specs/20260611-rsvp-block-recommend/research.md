# Research: RSVP Block Count Recommendation

**Feature**: `20260611-rsvp-block-recommend` | **Date**: 2026-06-10

## R1 — Separar inventario de empaquetado

**Decision**: Refactorizar `twoPhaseConceptSplit` en `session.js` en dos fases exportadas: `runConceptInventory(material, opts)` y `packInventoryToBlocks(inventory, nBlocks, material, opts)`. `twoPhaseConceptSplit` sigue siendo un wrapper que llama ambas (comportamiento actual para usuarios manuales).

**Rationale**: El spec exige que "Recommend" ejecute solo inventario y que "Generate" reutilice inventario sin re-indexar. Hoy ambas fases están acopladas en una sola función.

**Alternatives considered**:
- Cachear resultado completo de `twoPhaseConceptSplit` con N dummy — desperdicia llamada pack en recommend
- Segunda función paralela duplicada — drift de lógica

## R2 — Ubicación del cache de inventario

**Decision**: Estado efímero en `state.blockSplitCache` (módulo `state.js` / `study.js`) con fingerprint `{ fileKey, studyNotes, materialWordCount }`. No persistir en `DocumentSession` ni localStorage (out of scope v1).

**Rationale**: El cache vive solo en el flujo create RSVP de la pestaña actual; invalidación simple al cambiar archivo o notas.

**Alternatives considered**:
- `session.shared.conceptInventory` en DocumentSession — mezcla create-flow con sesión persistida; riesgo de stale cross-upload
- sessionStorage — complejidad sin beneficio v1

## R3 — Fórmula determinística para N

**Decision**: Función pura `computeBlockCountRecommendation(signals)` en `src/js/recommendation/block-count-recommender.js`:

```text
targetConceptsPerBlock = 5 - (conceptualLoad - 1) * 0.75   // 5 @ load 1 → 2 @ load 5
conceptN  = ceil(conceptCount / targetConceptsPerBlock)
wordN     = ceil(wordCount / 2200)
sectionN  = sectionCount > 0 ? sectionCount : 0
rawN      = max(conceptN, wordN, sectionN || conceptN)

multiplier:
  philosophical OR argumentativeDensity >= 4  → 1.15
  scientific_theoretical AND conceptualLoad >= 4 → 1.10
  lecture_notes OR firstPersonRatio > 0.03 → 0.95
  sizeCategory tiny → cap rawN at min(rawN, 8) before multiplier

N = clamp(round(rawN * multiplier), 5, 60)
```

**Rationale**: Ancla principal en conceptos (disponible tras inventario); palabras y secciones evitan bloques gigantes en textos largos poco conceptuales; multiplicadores alineados con flow-recommendation genre table.

**Alternatives considered**:
- Solo `ceil(conceptCount / 4)` — falla en textos largos con pocos conceptos explícitos
- LLM elige N — rechazado en clarificación (tokens)

## R4 — Señales gratis en recommend

**Decision**: Al pulsar Recommend, reunir:
- `analyzeText(cleanedMaterial)` — ya usado en flow recommendation
- `pedagogicalMeta` desde `DocumentSession.shared` / hierarchy cache si existe; else `buildDeterministicPedagogicalMeta(textMetrics)`
- `sectionCount` = nodos hoja del árbol jerárquico si cacheado; else `structureSignals` heading count proxy
- `conceptCount` = `inventory.length` tras `runConceptInventory`

**Rationale**: Cero LLM extra para meta; degradación graceful si hierarchy aún no corrió.

**Alternatives considered**:
- Forzar `buildDocumentHierarchy` en recommend — latencia + tokens no requeridos por spec

## R5 — Texto de explicación ("Why N blocks?")

**Decision**: Plantilla determinística en inglés, 1–2 frases, mencionando 2–3 factores dominantes (e.g. "42 concepts across ~12k words; philosophical density → 14 blocks"). Sin LLM.

**Rationale**: FR-005; coherente con copy EN del create screen.

**Alternatives considered**:
- LLM reasoning — coste innecesario

## R6 — Invalidación

**Decision**: `invalidateBlockSplitCache()` cuando:
- Cambia `fileInput` (nuevo archivo)
- Cambia `studyNotesInput` (blur o input debounced 500ms)
- Cambia `studyMode` away from RSVP

No invalidar cuando solo cambia `blocksInput.value`.

**Rationale**: Spec FR-007; evita recomendaciones stale.

**Alternatives considered**:
- Invalidar en cada keystroke de blocks — rompe reuse intent

## R7 — Segundo click en Recommend

**Decision**: Si fingerprint válido e inventario en cache, saltar `runConceptInventory`; solo recomputar `computeBlockCountRecommendation` y actualizar UI.

**Rationale**: Edge case spec; ahorra tokens si el usuario re-pide sin cambios.

## R8 — Alcance RSVP UI

**Decision**: Botón `#recommendBlocksBtn` visible solo cuando `studyMode === 'rsvp'` y `rsvpAdvancedDetails` visible. Oculto en Questions/Slow/Cloze.

**Rationale**: FR-009; reduce confusión con review.

## R9 — Generate con cache vs sin cache

**Decision**:
- Con cache válido → `packInventoryToBlocks(cached.inventory, nBlocks, material)` + dedup (sin inventario)
- Sin cache → `twoPhaseConceptSplit` completo (path manual actual)

**Rationale**: SC-005 no regression para manual path; SC-001 single inventory cuando recommend precedió generate.

## R10 — Tests

**Decision**: `cursor-tests/20260611_rsvp-block-recommend.mjs` — unit tests importando recommender + invalidación fingerprint; smoke de exports session.js.

**Rationale**: Patrón flow-recommendation; sin Playwright.

**Alternatives considered**:
- Solo manual QA — insuficiente para fórmula con muchos coeficientes
