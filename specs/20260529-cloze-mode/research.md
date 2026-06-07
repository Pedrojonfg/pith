# Research: Cloze Detection — Recuperación Activa sobre Grafo

**Feature**: `20260529-cloze-mode` | **Date**: 2026-06-07

## R1 — Slot `sessionsByMode.cloze`

**Decision**: Extender `sessions_by_mode` a `{ rsvp, slow, cloze }`. `normalizeStudyMode()` acepta `'cloze'`. Migración idempotente: si `cloze` ausente → `null`. `storeSessionsByMode` persiste los tres slots.

**Rationale**: Clarificación Q5; mismo contrato continuar/nueva que RSVP/Slow.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Historial multi-documento | Complejidad UI v1 innecesaria |
| Almacén separado de ítems | Rompe patrón `sessionsByMode` |

## R2 — Grafo epistémico aislado por sesión

**Decision**: `cloze.epistemicGraph` en sub-objeto de sesión. Fase 0 siempre en sesión nueva; omitida al continuar sesión con grafo persistido. **Sin** lectura de `material_graph` RSVP ni `slow.phase0`. Visualización vía nuevo builder `buildClozeEpistemicGraph()` registrado en `buildSessionGraph({ mode: 'cloze' })`.

**Rationale**: Clarificación Q2; formato epistémico (importance, sentence_context) incompatible con mapeo directo RSVP/Slow.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Caché cross-modo por hash | Rechazado en clarify |
| Reutilizar `conceptInventory` RSVP | Sin importance ni edge context |

## R3 — Disparo del pipeline (botón explícito)

**Decision**: Tras upload+normalización, estado `cloze.pipelineStatus: 'normalized'`. Botón "Generar ítems" ejecuta fases 0–4 secuenciales con UI de progreso `Fase N/5`. Sin llamadas IA en upload.

**Rationale**: Clarificación Q4; 5 llamadas IA requieren consentimiento explícito del usuario.

## R4 — Pipeline IA en 5 fases separadas

**Decision**: Módulo `src/js/cloze/pipeline.js` con funciones puras por fase, cada una con prompt JSON estructurado vía `llm.js` existente:

| Fase | Función | Output |
|------|---------|--------|
| 0 | `generateEpistemicGraph(text)` | `EpistemicGraph` |
| 1 | `analyzeSemanticCandidates(text, graph)` | `{ node_candidates, edge_candidates }` |
| 2 | `generateBaseItems(text, candidates)` | `{ node_items, edge_items }` |
| 3 | `generateDistractors(items, graph)` | ítems con 3 distractores (L1+L3) |
| 4 | `qaAndCalibrate(items)` | ítems con `qa_status`, `difficulty` |

Textos ≤15k chars: texto completo en cada llamada. >50k: chunking por secciones (headings) solo en fases 1–2.

**Rationale**: `cloze_mode_spec.md` §4; separación cognitiva de prompts mejora calidad de distractores.

## R5 — Distractores L1 + L3 (sin vault L2)

**Decision**: Fase 3 recibe pool L1 = todos los nodos del `epistemicGraph`. Si <3 candidatos válidos por reglas, completar con L3 (IA genera distractor sintético con `source: 'L3'`).

**Rationale**: Clarificación Q3; app sin vault global en v1.

## R6 — Sesión MC mínima (sin SR)

**Decision**: Nuevo módulo `src/js/cloze/study.js` que reutiliza `shuffleTestQuestionOptions` / `normalizeTestQuestion` de `shuffle-options.js` y patrones de render MC de `review.js`. Pantalla `screenClozeStudy` en `index.html`. Solo sirve ítems `qa_status === 'valid'`. Sin cola SR ni `next_review` activo.

**Rationale**: Clarificación Q1; evita acoplar SR en v1.

## R7 — Normalización de entrada

**Decision**: Reutilizar `input-normalization.js` y flujo upload de `study.js` (mismos formatos `pdf/html/txt/md`). `cloze.normalizedText` + `normalizedFormat` en sesión.

**Rationale**: FR-002; cero selector de archivos nuevo.

## R8 — Manejo de fallos por fase

**Decision**: `cloze.pipelineStatus`: `'normalized' | 'generating' | 'phase0'…'phase4' | 'ready' | 'failed'`. Fallo en fase N → `failed` con `pipelineError` + botón reintentar desde fase fallida. Ítems parciales no se sirven.

**Rationale**: Edge case spec; integridad de ítems > degradación parcial.

## R9 — Validación JSON de respuestas IA

**Decision**: Cada fase valida shape mínimo en cliente (campos requeridos, arrays no vacíos donde aplique). Sin Zod en v1 (no está en stack); validación manual + tests en `cursor-tests/`.

**Rationale**: PWA vanilla JS sin build step; YAGNI.

## R10 — Tests

**Decision**: `cursor-tests/20260529_t*.mjs` para: slot cloze en sessionsByMode, normalizeStudyMode, pipeline status transitions, filtro qa_status, shuffle options. Validación manual vía `quickstart.md`.

**Rationale**: Alineado con convención Slow Mode.
