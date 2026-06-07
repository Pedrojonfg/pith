# Contract: Reader Sidebar & Tap-to-Source

**Feature**: `20260528-slow-mode` Wave 2 | **Spec**: `slow_mode_spec.md` §5, §12

## Sidebar layout

- Visible al 20% derecho cuando expandida; tab discreta `#slowSidebarTab` cuando colapsada.
- Secciones (accordion o scroll):
  1. **Mis anotaciones** — grupos por `type`; línea: `≈ Paráfrasis (3)`; cada ítem: símbolo + excerpt 40 chars + página.
  2. **Diccionario** — términos de `phase0.conceptsToFind` + `session_concepts` merge.
  3. **Preguntar a IA** — input + lista queries de la sesión (tipo `ia-query`).

## Tap-to-source

```js
export function jumpToAnnotation(session, annotation) → void
```

1. `page = charOffsetToPage(breakpoints, annotation.charStart)`
2. `goToReaderPage(session, page)`
3. Highlight `charStart..charEnd` en página (clase `.slow-highlight-pulse`, 2s)

## Margin marks Y-position

- Por cada anotación en página: calcular Y relativo al fragmento (Range sobre texto de página).
- Fallback: distribución vertical si Range falla.

## Acceptance

- 5 anotaciones de tipos distintos listadas en sidebar con contadores correctos.
- Tap ítem → salta a página correcta con highlight.
- Colapsar sidebar deja solo texto + barra (lectura limpia).
