# Research: Flow Recommendation

**Feature**: `20260609-flow-recommendation` | **Date**: 2026-06-09

## R1 — Fuente de metadatos pedagógicos

**Decision**: Extender el JSON de respuesta del prompt LLM en `buildDocumentHierarchy` con `pedagogical_meta` al mismo nivel que `tree`. Parsear en `parseLlmHierarchyTree` o función dedicada `parsePedagogicalMeta(raw)`.

**Rationale**: Cero llamadas LLM adicionales; el modelo ya lee el texto completo para jerarquía.

**Alternatives considered**:
- Llamada LLM separada — coste y latencia duplicados
- Solo heurísticas — insuficiente para género filosófico sin headings

## R2 — Fallback sin LLM

**Decision**: `buildDeterministicPedagogicalMeta(textMetrics)` cuando `method` es `deterministic`, `trivial`, LLM falla, o `llmFn` es null. Mapeo tosco: `firstPersonRatio > 0.03` → `lecture_notes`; `hasBibliography && hasMathNotation` → `scientific_empirical`; `academicVocabDensity` alta + `longParagraphRatio` alta → `philosophical`; default → `unknown`.

**Rationale**: Spec exige funcionamiento offline; heurísticas alineadas con tabla de decisión.

**Alternatives considered**:
- `null` pedagogicalMeta — rompe recommender sin rama especial
- Reutilizar solo `docMeta.estimatedGenre` — granularidad insuficiente (sin `argumentativeDensity`)

## R3 — Shape de retorno `buildDocumentHierarchy`

**Decision**: Añadir campo opcional `pedagogicalMeta: PedagogicalMeta | null` al objeto retornado. Actualizar `hierarchy-cache.js` para cachear también `pedagogicalMeta` cuando `method === 'llm'`.

**Rationale**: Consumidores existentes ignoran campos nuevos; cache evita re-clasificar.

**Alternatives considered**:
- Guardar meta solo en session — pierde cache cross-session

## R4 — Vocabulario académico bilingüe

**Decision**: Listas estáticas ES+EN (~80 términos cada una: "epistemología", "hypothesis", "therefore", etc.). `academicVocabDensity = matches / wordCount`. Detección case-insensitive con word boundaries.

**Rationale**: Spec marca riesgo alto en inglés; es configuración, no arquitectura.

**Alternatives considered**:
- Solo español — falla en papers EN
- Stemming — overkill para señal ratio

## R5 — Estimación ítems Cloze / Review

**Decision**: Proxy `estimatedClozeItems = Math.max(5, Math.ceil(wordCount / 200))` hasta que exista pipeline cloze. `TIME_FACTORS.cloze(items)` y `review(items)` usan ese proxy en `computeStepTimes`.

**Rationale**: Tiempos orientativos en panel; precisión real vendrá post-generación cloze.

**Alternatives considered**:
- Omitir paso review en estimación — subestima flujo filosófico
- Leer `modes.cloze.items.length` si existe — mejor en T06 update, no en cálculo inicial

## R6 — Reglas de visibilidad del panel

**Decision**: Mostrar panel si `modeRecommendation` existe Y (`currentStepIndex === 0` sin `completedSteps`) O (`completedSteps.length > 0` para vista progreso). Ocultar introducción si `userOverride === true`. No re-mostrar al cambiar de modo intra-sesión.

**Rationale**: Mitiga riesgo "panel molesto"; spec dice una vez al subir o si no se ha comenzado.

**Alternatives considered**:
- Panel persistente en sidebar — fuera de scope, más intrusivo

## R7 — IDs de pasos y completado

**Decision**: Convención `step_{mode}_1` (e.g. `step_slow_1`, `step_cloze_1`). `updateFlowProgress` evalúa condiciones del spec contra `session.modes` sin exigir orden del flujo.

**Rationale**: Tracking independiente del orden elegido por el usuario.

**Alternatives considered**:
- UUID por paso — dificulta tests y debugging

## R8 — Persistencia y recálculo

**Decision**: Calcular recomendación solo en upload nuevo (`getSession(docId)` miss) o si `modeRecommendation === null`. Nunca recalcular `primaryFlow` en sesión existente; solo `updateFlowProgress` muta tracking fields.

**Rationale**: Flujo recomendado estable; progreso es lo que cambia.

**Alternatives considered**:
- Recalcular en cada carga — confunde si el usuario ya avanzó

## R9 — Integración `session-store`

**Decision**: Añadir `updateRecommendation(docId, recommendation)` que merge en `shared.modeRecommendation` y persiste. Validación laxa en `validateDocumentSession` (objeto o null).

**Rationale**: Patrón consistente con `addAnnotationToShared`.

**Alternatives considered**:
- Solo `saveActiveSession` — más boilerplate en study.js

## R10 — Etiquetas UI (`genreLabel`)

**Decision**: Mapa estático ES en `recommender.js`:

| genre | genreLabel |
|-------|------------|
| philosophical | Texto filosófico argumentativo |
| scientific_theoretical | Texto científico teórico |
| scientific_empirical | Texto científico empírico |
| essay | Ensayo |
| lecture_notes | Apuntes de clase |
| textbook_chapter | Capítulo de manual |
| unknown | Texto académico |

**Rationale**: Spec criterio global menciona strings legibles en español.

**Alternatives considered**:
- i18n completo — fuera de scope MVP
