# Research: RSVP Assessment Reposition

**Feature**: `20260611-rsvp-assessment-reposition`  
**Date**: 2026-06-11

## R1 — Posición del assessment en el pipeline

**Decision**: Assessment entre `runConceptInventory` y `packInventoryToBlocks`; reemplaza el flujo post-packing legacy en RSVP.

**Rationale**: El spec y clarificaciones confirman que el valor está en informar segmentación, no en ajustar `_config` post-facto. `20260523-assessment-informed-blocks` queda obsoleto para RSVP cuando el flag está activo.

**Alternatives considered**:
- Mantener ambos assessments → rechazado (UX duplicada, señales contradictorias)
- Assessment solo en modo Questions → fuera de scope RSVP

## R2 — Alcance del filtro por capas

**Decision**: `knowledge_profile` filtra solo `blockIndex` y `learning_goal`. `concept_inventory`, `material_graph` y diccionario permanecen completos.

**Rationale**: El conocimiento previo no borra el documento; evita bloques dedicados. Referencias cruzadas resueltas por diccionario completo.

**Alternatives considered**:
- Filtrar grafo UI → rechazado (pierde contexto global)
- Marcar bloques `skipped_by_mastery` in-place → rechazado en clarificación (3B: ausentes del índice activo)

## R3 — Semántica de N bloques

**Decision**: N del input usuario = **techo máximo** (`max_blocks`). Packing puede devolver `final_n < N` cuando hay conceptos dominados.

**Rationale**: Alineado con diff UI "hasta 5 → 3". `pack_meta` existente ya registra `requested_n` vs `final_n`.

**Alternatives considered**:
- N fijo siempre → no reduce tiempo de estudio real
- LLM elige N sin input → rompe UX actual y block recommend cache

## R4 — Diff "X → Y bloques"

**Decision**: Comparar `requested_n` (techo) vs `final_n` con perfil. Opcionalmente cachear resultado de packing uniforme **solo para diff UI** si `ASSESSMENT_SHOW_DIFF` y hay dominados — implementación lazy: estimar Y = `requested_n` cuando no hay perfil previo en sesión (no segundo LLM call en v1 salvo que packing paralelo ya lance ambos).

**Rationale**: Segundo packing completo es caro. v1: mostrar `requested_n → final_n` del run con perfil; baseline "sin assessment" = `requested_n` (techo), no re-pack.

**Alternatives considered**:
- Doble LLM pack (con/sin perfil) → defer P2 si se necesita diff exacto

## R5 — Tipos de ítem del quiz

**Decision**: MVP **MCQ only** en UI; schema acepta `open_short` pero no se genera en v1.

**Rationale**: UI mockup es MCQ + "No lo sé"; reduce scope de evaluación LLM.

**Alternatives considered**:
- open_short desde día 1 → más parsing/UX

## R6 — Paralelización

**Decision**: Tras inventory → prefetch `generateAssessmentItems` en background. Tras evaluación → `packInventoryToBlocks` en background si `ASSESSMENT_PARALLEL_PACKING`. Pantalla resultados no bloquea.

**Rationale**: Spec §6.1 latencia percibida. Patrón similar a gap synthesis paralelo en `20260523`.

**Alternatives considered**:
- Secuencial estricto → peor UX

## R7 — Persistencia y flags

**Decision**: Nuevo módulo `src/js/config/flags.js` exportando constantes. `session._meta` en `localStorage` vía `session.js` existente.

**Rationale**: No existe `flags.js` hoy; centralizar toggles. Sin bump `schemaVersion` — campos opcionales.

**Alternatives considered**:
- `window.assessmentConfig` only → inconsistente con otros features

## R8 — Integración con block-split cache

**Decision**: `state.blockSplitCache.conceptInventory` se reutiliza; assessment y packing leen el mismo inventario. Invalidación igual que `20260611-rsvp-block-recommend` (archivo/notas).

**Rationale**: Evita re-indexar. Generate flow pasa por inventory → assessment gate → pack.

## R9 — Legacy removal strategy

**Decision**: Cuando `ASSESSMENT_BEFORE_PACKING`, ocultar `assessmentChoiceWrap` post-blocks y no invocar `generateAssessmentQuestions` / `applyAssessmentResults` en RSVP. Código legacy permanece detrás de flag para rollback.

**Rationale**: Clarificación 1B; rollback seguro.

## R10 — Resume mid-flow

**Decision**: v1 no persiste quiz a medias; si usuario abandona antes de pack, re-ejecutar desde inventory cacheada si fingerprint válido.

**Rationale**: YAGNI; sesión RSVP resumible sigue siendo post-confirm blocks.
