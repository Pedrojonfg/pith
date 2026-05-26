# Contract: Block Transition Sneak Peek

**Feature**: `20260527-zero-latency-blocks` (FR-002c–FR-002e, SC-007)

## Purpose

Mostrar en la transición del bloque N una vista previa breve del bloque N+1, derivada localmente del `explanation` ya generado — **sin llamada API adicional**.

## Data source

| Estado prefetch N+1 | UI |
|---------------------|-----|
| `generating` / `idle` / `failed` | Placeholder: `Preparando siguiente bloque…` |
| `ready` + `configKey` match | Primeras **4 frases** de `session.blocks[N+1].explanation` (o `prefetchState.data.explanation`) |

**No** persistir campo `sneakPeek` en JSON de sesión; es derivado en runtime.

## Extraction: `extractSneakPeek(explanation)`

**Location**: `src/js/sneakPeek.js` (nuevo, portable a Flutter)

**Algorithm**:

1. `normalizeWhitespace(text)` — trim, colapsar `\s+` a espacio, unificar saltos de párrafo a espacio simple para conteo de frases.
2. Split de frases con regex conservadora: `(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9"(\[])` — tolerar abreviaturas comunes en español/inglés es deseable pero no bloqueante v1.
3. Tomar **máximo 4** frases; unir con espacio simple (sin `\n\n` — el sneak peek es un párrafo compacto).
4. Si 0 frases → cadena vacía (UI oculta contenedor o muestra hint mínimo).

**Export**: `export function extractSneakPeek(explanation, maxSentences = 4)`

## Prompt contract (generation time)

Para bloques con `blockIndex >= 1` (bloque 2+):

- El párrafo **Hook** DEBE incluir ≥1 frase que enlace explícitamente con el bloque inmediatamente anterior (nombre o concepto clave).
- Las primeras 4 frases del `explanation` DEBEN ser comprensibles como mini-intro incluyendo ese puente (el sneak peek no lee el párrafo Connection al final).

Ver cambios en `buildBlockGenerationSystemPrompt` / constantes `EXPLANATION_*` en `api.js`.

**User message enrichment** (opcional v1): incluir título del bloque anterior en `buildBlockGenerationUserContent` cuando `blockIndex > 0`.

## UI contract

**Location**: `src/js/study.js` — `getOrCreateTransitionOverlay()`, `finishQuestions()`, `refreshUiOnPrefetchReady()`

### DOM (default view)

Insertar **encima** de `dictionaryWrap`:

```text
sneakPeekWrap
  sneakPeekLabel   — "Siguiente bloque" (hint, opcional)
  sneakPeekText    — párrafo compacto o placeholder
```

**Styles**: reutilizar `.hint` para placeholder; texto sneak peek con `line-height: 1.5`, `margin-bottom: 10px`, sin markdown render (texto plano).

### Render rules

| Condición | `sneakPeekText` |
|-----------|-----------------|
| `!isPrefetchReadyForKey(fastPathConfigKey)` | `Preparando siguiente bloque…` |
| `ready` + explanation no vacía | `extractSneakPeek(explanation)` |
| `ready` + explanation vacía | ocultar wrap o placeholder |

### Refresh triggers

1. Apertura de overlay (`finishQuestions`)
2. `refreshUiOnPrefetchReady()` cuando overlay abierto
3. `syncPrefetchUi()` al pasar a `ready` (misma función o helper `renderTransitionSneakPeek(o, nextIndex)`)

**Adjust view**: sneak peek permanece visible (solo se ocultan `defaultActions`; sneak peek está fuera de `adjustWrap`).

## Tests

- Unit: `cursor-tests/20260527_t13-sneak-peek-extract.mjs` — whitespace, 4 frases max, textos cortos, LaTeX inline no rompe split.
- Integration: `cursor-tests/20260527_t15-sneak-peek-ui.mjs` — mock overlay state ready/not ready.

## Non-goals (v1)

- Segunda llamada LLM para reescribir sneak peek
- Streaming parcial del sneak peek
- Markdown/LaTeX render en sneak peek
- Sneak peek en export `.md`
