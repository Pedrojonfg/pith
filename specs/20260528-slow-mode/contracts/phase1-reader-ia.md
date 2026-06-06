# Contract: Phase 1 Reader & On-Demand IA

**Feature**: `20260528-slow-mode` | **FR**: FR-006, FR-015

## Layout (`screenSlowReader`)

```text
┌─────────────────────┬──────────────┐
│ Text column (pages) │ Sidebar      │
│ + margin marks      │ annotations  │
│ + progress bar      │ dictionary   │
│                     │ Ask IA       │
└─────────────────────┴──────────────┘
```

- Sidebar colapsable; focus mode oculta sidebar + chrome.
- Tipografía: controles font size / line height.

## Anti-spoiler context

```js
const contextEnd = slow.maxReadCharEnd; // updated on each page view
const iaContext = scopeText.slice(0, contextEnd);
```

- Prompt system: responder solo con `iaContext`; si pregunta requiere texto posterior, decirlo sin revelar.
- Tras respuesta: overlay dismissable; foco vuelve al texto.

## Invocation modes

1. Sidebar free text.
2. Annotation `⚑`.
3. Annotation `⇑` (steel man).
4. Long-press concepto diccionario.

## Prohibited

- Resumir secciones no leídas.
- Feedback calidad anotaciones en tiempo real.
- Push/proactive messages.

## Update `maxReadCharEnd`

- Al mostrar página P: `maxReadCharEnd = max(maxReadCharEnd, breakpoints[P].charEnd)`.
