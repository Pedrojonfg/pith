# Contract: Phase 2 — Section Checkpoints

**Feature**: `20260528-slow-mode` | **FR**: FR-007

## Trigger

- Usuario en última página de `SectionBoundary` (charEnd alcanzado).
- Timer **10s** tras entrar en esa página (reset si navega away antes).
- Mostrar chip: `[≡ CHECKPOINT · 30 seg]` fijo margen inferior.

## Content

- Exactamente **una** pregunta de integración (no factual).
- Fuente: mapa argumental Fase 0 + texto de la sección leída.
- Generación: llamada IA ligera o plantilla si `phase0` skipped.

## Interaction

- Responder → anotación `→` con `userText` = respuesta.
- Swipe down / × / tap outside → dismiss; ID en `checkpointsDismissed[]`.
- Dismiss **no** bloquea avance de página.

## Re-show

- No re-mostrar checkpoint dismissado en la misma sesión.
