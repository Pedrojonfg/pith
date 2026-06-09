# Quickstart: Flow Recommendation

**Feature**: `20260609-flow-recommendation`

## Prerequisites

- `20260609-unified-session` T01+T04 completos (`session.shared`, upload DocumentSession)
- `20260609-doc-hierarchy-index` operativo
- API key LLM opcional (fallback determinístico sin ella)
- Branch `20260609-flow-recommendation` o feature dir activo en `.specify/feature.json`

## Automated tests

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260609_flow-recommendation-analyzer.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260609_flow-recommendation-recommender.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260609_flow-recommendation-tracker.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260609_flow-recommendation-integration.mjs
```

## Manual QA

### QA-1 — Paper filosófico (criterio global #1)

1. Subir texto Nietzsche-like (~15k chars, sin headings)
2. Panel muestra genre filosófico, ~125 min flujo completo (aprox.)
3. Flujo: Slow → Cloze → Revisión
4. Razón legible en español

### QA-2 — Apuntes de clase (#2)

1. Subir texto con "yo creo que", ~5k chars
2. Panel: RSVP → Questions, ~20 min

### QA-3 — Texto tiny (#3)

1. Subir ~1500 chars
2. Un solo paso Questions, UI minimal

### QA-4 — Progreso (#4)

1. Completar Slow Mode en paper filosófico
2. Volver a pantalla modo → "Slow ✓ → Cloze (siguiente)"

### QA-5 — Override

1. En panel, "Ir a RSVP directamente"
2. `userOverride: true` en DevTools → `session.shared.modeRecommendation`
3. Panel intro no reaparece al cambiar modo

### QA-6 — Sin LLM (#5)

1. Quitar API key / forzar `llmFn: null`
2. Los 4 casos anteriores funcionan con recomendación menos precisa, sin errores

### QA-7 — Sesión existente

1. Estudiar parcialmente, cerrar pestaña
2. Reabrir mismo doc → progreso panel, no recálculo de flujo

## Dev inspection

```js
JSON.parse(localStorage.mylearning_doc_sessions)[0].shared.modeRecommendation
```

## Done checklist

- [ ] T01–T08 marcados [x] en ROADMAP.md
- [ ] Todos los cursor-tests pasan
- [ ] QA-1 a QA-7 verificados manualmente
