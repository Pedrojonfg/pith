# Quickstart: Grafo Académico — Género Textual

**Feature**: `20260530-graph-academic-genre` | **Branch**: `20260530-graph-academic-genre`

## Prerequisites

- API key LLM configurada
- Servidor local o `index.html` abierto
- Tests: `node --import ./cursor-tests/register.mjs cursor-tests/20260607_t15-graph-academic-genre.mjs`

## Scenario A — Texto genealógico (Horlacher / Bildung)

1. Crear sesión Slow nueva.
2. Subir material filosófico-histórico (o pegar extracto sobre Bildung).
3. Elegir scope y generar Phase 0.
4. **Verificar**:
   - Bloque orientación muestra género detectado (o inspeccionar `session.slow.phase0.textGenre` en consola).
   - `textGenre === "GENEALOGÍA"` (o DEBATE si el extracto es comparativo).
   - `conceptsToFind` incluye `nodeType` (ej. CONCEPTO para Bildung, PERSONA para Humboldt).
   - Nodos anti-tecnocracia agrupados con `includes` si hay varios ejemplos.
5. Abrir vista grafo Phase 0 (`mode: slow_phase0`).
6. **Verificar**:
   - Aristas entre nodos del mapa son `historically_precedes` (inspeccionar `data-edge-type` en SVG o lista).
   - Labels muestran `[CONCEPTO]`, `[PERSONA]`, etc.
   - No hay nodos sueltos sin aristas (Zöllner, obras citadas de paso).

## Scenario B — Regresión texto lineal (economía)

1. Usar fixture `fixtures/session-samples/generic-slow-mode-session.md` o texto técnico similar.
2. Generar Phase 0.
3. **Verificar**:
   - `textGenre === "ARGUMENTO_LINEAL"` (o ausente → default).
   - Mapa P1/P2/C intacto.
   - Aristas `sequence` entre premisas.
4. Ejecutar `cursor-tests/20260607_t14-graph-refactor.mjs` — todo PASS.

## Scenario C — Grafo enriquecido + prune

1. Completar Fase 1–3 con anotaciones `⟷` y `⊘`.
2. Abrir grafo enriquecido.
3. **Verificar**:
   - Nodos usuario conectados a conceptos.
   - Conceptos Phase 0 sin links ni mapa no aparecen (pruned).
   - Export `.md` lista aristas `contrasts_with` con familia argumentativa.

## Scenario D — Canvas edge styles

1. Grafo con mezcla: `historically_precedes`, `contrasts_with`, `contradicts`.
2. **Verificar** visualmente:
   - `contrasts_with` → línea punteada
   - `contradicts` → línea gruesa punteada
   - `historically_precedes` → línea sólida (color distinto de `sequence`)

## Console checks

```js
// En DevTools con sesión activa:
const p0 = JSON.parse(localStorage.getItem('sessions_by_mode'))?.slow?.slow?.phase0;
console.log(p0?.textGenre, p0?.conceptsToFind?.map(c => ({ term: c.term, nodeType: c.nodeType, includes: c.includes })));
```

## Automated test

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260607_t15-graph-academic-genre.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260607_t14-graph-refactor.mjs
```
