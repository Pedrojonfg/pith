# Contract: Mode Selector & Sessions By Mode

**Feature**: `20260528-slow-mode` | **FR**: FR-001, FR-002, FR-011, FR-011a, FR-011b

## UI: Create screen (`screenPlaceholder`)

1. Al abrir, **ningún** modo preseleccionado (`rsvp` y `slow` radios/tabs sin `checked`).
2. Cada modo muestra hint breve (matriz del diseño: RSVP = qué/hechos; Slow = por qué/argumento).
3. Tras elegir modo y confirmar:
   - Si `sessions_by_mode[mode]` existe → panel **Continuar sesión** / **Nueva sesión**.
   - Si no existe → flujo de upload directo.
4. Controles RSVP (`blocksInput`, preguntas) **ocultos** cuando modo = `slow`.
5. Controles Slow (`criticalMode` toggle, scope placeholder) **ocultos** cuando modo = `rsvp`.

## Resume

- **Continuar**: carga slot → `state.activeSession` + navega a fase guardada (`slow.phase`).
- **Nueva sesión**: pide confirmación si slot existía; al confirmar upload, reemplaza slot.

## Bootstrap (`main.js`)

```text
if sessions_by_mode missing and active_session exists:
  migrate → sessions_by_mode.rsvp = active_session

on load:
  if URL/hash no resume: show create screen (not auto-rsvp-ready)
  do NOT auto-enter session without mode choice
```

## Invariants

- `sessions_by_mode.rsvp` nunca contiene sub-objeto `slow` con datos de lectura.
- `sessions_by_mode.slow.studyMode === 'slow'`.
- Cambiar modo mid-lectura: no permitido; requiere volver a create + elección explícita.

## Regression

- RSVP create → blocks → study: sin cambios funcionales.
- Offline pack: solo disponible en modo RSVP (v1).
