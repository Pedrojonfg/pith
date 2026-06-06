# Contract: Viewport Pagination Engine

**Feature**: `20260528-slow-mode` | **FR**: FR-003, FR-005c

## API (`src/js/slow/pagination.js`)

```js
export function computePageBreakpoints(scopeText, containerEl, typography) → PageBreakpoint[]
export function getPageCount(breakpoints) → number
export function getPageSlice(breakpoints, pageIndex) → { charStart, charEnd }
export function charOffsetToPage(breakpoints, charOffset) → number
```

`PageBreakpoint`: `{ pageIndex, charStart, charEnd }` — offsets relativos al **scope**.

## Rendering (`screenSlowReader`)

- Una página visible; sin scroll vertical en columna de texto.
- Controles: prev/next, swipe horizontal, barra de progreso `pageIndex+1 / total`.
- Cambio tipografía → recomputar breakpoints → mantener página más cercana por `charStart` actual.

## Performance

- Cache breakpoints mientras `(scopeText, typography, width)` no cambien.
- Recompute tipografía: debounce 150ms.

## Acceptance

- Texto de 3 páginas navegable adelante/atrás sin pérdida de posición.
- Tras cambiar font size, anotaciones en margen siguen alineadas al fragmento correcto.
