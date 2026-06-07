# Contract: Critical Pedagogy & Rich Phase 3

**Feature**: `20260528-slow-mode` Wave 2 | **Spec**: §7, §8, §9

## Steel-man nudge

Al confirmar anotación `⊘`|`↯`|`⚠`:
1. Buscar en ±500 chars anotación previa `⇑` o `≈` con texto.
2. Si ausente → modal: "¿Has formulado el mejor argumento del autor?" [Pedir steel man] [Continuar].
3. No bloquear — registro `skippedSteelMan: true` en anotación.

## Depth score (critical mode)

- Multiplicador `×1.25` en puntos de tipos `⊘ ↯ ⚠ ★ ⇑` cuando `criticalMode`.

## Phase 3 module picker

- Cards: **A Revisión** | **B Retrieval** | **C Grafo** — usuario elige orden; puede omitir.

## Module A rich

- Por nodo mapa: ✓/✗ + página + snippet anotación usuario.
- Footer: `Conceptos: 3/5`, `Puntos débiles: 2/3`.

## Module B per-type retrieval

Implementar tabla spec §7 (≈ → "Explica sin palabras del texto", etc.) vía prompts dedicados o plantillas locales.

## Abogado del diablo inverso

Por cada `⊘`/`↯`/`⚠`: pregunta socrática generada (IA) pidiendo réplica del autor antes de evaluar texto.

## Quality feedback

En Fase 3, por anotación penalizada: texto accionable ("Esta ⊘ podría especificar qué justificación faltaría…").

## Flashcards UI

Lista anotaciones convertibles → botón por ítem → `review.js` / storage existente.
