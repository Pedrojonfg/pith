# Contract: Mode Selector & Cloze Sessions

**Feature**: `20260529-cloze-mode` | **FR**: FR-001, FR-009, FR-009a

## UI: Create screen

1. Tres radios: RSVP, Slow Mode, **Cloze Detection** — ninguno preseleccionado.
2. Hint Cloze: recuperación activa con ítems cloze NODE/EDGE sobre el material.
3. Tras elegir `cloze`:
   - Si `sessions_by_mode.cloze` existe → panel **Continuar** / **Nueva sesión**.
   - Si no → upload directo.
4. Controles RSVP (bloques) y Slow (critical mode, scope) **ocultos** cuando modo = `cloze`.

## Resume / New

- **Continuar**: carga slot → `state.activeSession` + pantalla según `cloze.pipelineStatus` / `studyIndex`.
- **Nueva sesión**: confirmación si slot existía; reemplaza solo `cloze`.

## Bootstrap (`session.js`)

```text
normalizeStudyMode('cloze') → 'cloze'
emptySessionsByMode() → { rsvp: null, slow: null, cloze: null }
parseSessionsByModeRaw: incluir cloze
migrate: si cloze ausente → null
```

## Invariants

- `sessions_by_mode.cloze.studyMode === 'cloze'`.
- Slot cloze nunca contiene sub-objeto `slow` con datos de lectura.
- Cambiar modo mid-sesión: no permitido; volver a create.

## Regression

- RSVP y Slow sin regresiones en selector y resume.
