# Contract: Phase 3 — Consolidation, Graph, Gamification

**Feature**: `20260528-slow-mode` | **FR**: FR-008, FR-010, FR-012, FR-015

## Entry

- Usuario marca "Lectura completa" en Fase 1 → `phase: 'phase3'`.
- Módulos elegibles (tabs o cards): A Revisión | B Retrieval | C Grafo.

## Módulo A — Revisión argumental

- Diff `phase0.argumentMap` vs anotaciones (proximidad offset ±200 chars, tipos relevantes).
- UI: ✓/✗ por nodo; no es calificación — copy del diseño ("oportunidades de revisión").

## Módulo B — Preguntas desde anotaciones

- IA genera preguntas según tabla tipo-anotación → tipo-pregunta del diseño.
- Modo Crítico: incluir "abogado del diablo inverso" por cada `⊘`/`↯`/`⚠`.

## Módulo C — Grafo

- Nodos usuario `[Pedro:]` desde anotaciones; edges `cuestiona`/`refuta` para críticas.
- Vista grafo enriquecida desbloqueada al completar Fase 3 (`graphEnrichedUnlocked`).

## Depth score & feedback

- Calcular en Fase 3 únicamente (tabla de puntos diseño).
- Penalizaciones `-1` con explicación accionable.
- Hallazgos silenciosos de Fase 1 revelados aquí (salvo mapa rellenable).

## Flashcards

- Desde anotaciones `→`, `≈`, `⊘`, `↯` → botón "Convertir a flashcard" → formato existente spaced repetition.

## Export

- Extender `export.js` con sección Slow: material, scope, phase0, anotaciones, depth score.
