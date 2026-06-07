# ROADMAP — Grafo Académico (Género Textual y Tipado Filosófico)

**Feature**: `20260530-graph-academic-genre` | **Spec**: `specs/20260530-graph-academic-genre/spec.md` | **Plan**: `specs/20260530-graph-academic-genre/plan.md`

## Tabla de tareas

| ID | Descripción | Deps | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T01 | Tipado de nodos (`nodeType`) en Phase 0 + normalización + labels grafo | — | M | [x] |
| T02 | Vocabulario de aristas ampliado (`EDGE_TYPES` + `export-format.js`) | — | S | [x] |
| T03 | Detección `textGenre` en prompts Phase 0 + validación | — | M | [x] |
| T04 | `buildSlowPhase0Graph` genre-aware (`historically_precedes` vs `sequence`) | T03 | M | [x] |
| T05 | Deduplicación clusters (`includes`) en prompt + normalización | T01 | S | [x] |
| T06 | `pruneOrphanNodes` en build.js + view.js | T04 | S | [x] |
| T07 | Estilos SVG aristas en canvas.js | T02 | S | [x] |
| T08 | Tests `t15-graph-academic-genre` + quickstart QA | T04,T05,T06,T07 | M | [x] |

## Diagrama de dependencias

```text
T03 → T04 → T06 → T08
T01 → T05 ↗
T02 → T07 ↗
```

**Paralelizables desde el inicio**: T01, T02, T03 (tres chats independientes)

**Secuenciales**:
- T04 requiere T03
- T05 requiere T01
- T06 requiere T04 (prune sobre grafo genre-aware)
- T07 requiere T02
- T08 requiere T04–T07

## Orden de ejecución recomendado

### Ola 1 (paralelo — lanzar 3 chats a la vez)

1. **T01** — tipado nodos
2. **T02** — aristas + export
3. **T03** — género textual Phase 0

### Ola 2 (paralelo — tras Ola 1)

4. **T04** — tras T03
5. **T05** — tras T01
6. **T07** — tras T02

### Ola 3 (secuencial)

7. **T06** — tras T04

### Ola 4 (cierre)

8. **T08** — tras T06 y T07

---

## PROMPT T01 — Tipado de nodos en capa text

Implementa el **Cambio 1** del feature Grafo Académico: subtipos de nodo en capa `text`.

**Contexto**: El sistema Slow Mode extrae conceptos en Phase 0 (`src/js/slow/phase0.js`) y los renderiza en `buildSlowPhase0GraphFromInputs` (`src/js/graph/build.js`). Hoy todos los nodos van a `layer: "text"` sin distinción.

**Archivos a tocar**:
- `src/js/slow/phase0.js` — `buildPhase0SystemPrompt`, `buildSynthesisSystemPrompt`, `normalizeConcept`, `validatePhase0Orientation`
- `src/js/graph/build.js` — `buildSlowPhase0GraphFromInputs`, `collectTextConceptsFromLists`
- `specs/20260530-graph-academic-genre/contracts/text-node-subtypes.md` (referencia)

**Subtipos**: CONCEPTO, PERSONA, OBRA, MOVIMIENTO, EVENTO.

**Instrucciones prompt** (añadir en sección conceptsToFind):
```
Para cada nodo indica su tipo entre corchetes: [CONCEPTO], [PERSONA], [OBRA],
[MOVIMIENTO] o [EVENTO]. Nunca crees un nodo [PERSONA] para el autor del texto
que estás analizando. Si el texto contiene su propio nombre como referencia
bibliográfica, ignóralo como nodo.
```

**Implementación**:
1. Campo `nodeType` en JSON schema del prompt y en `normalizeConcept` (parsear también desde prefijo `[TIPO]` en `term`).
2. Nodos grafo: `label: \`[${nodeType}] ${term}\``, metadata `nodeSubtype`.
3. Validación: enum conocido; default `CONCEPTO`.

**Criterio de éxito**: `normalizeConcept({ term: "Bildung", authorUsage: "...", nodeType: "CONCEPTO" })` produce nodo con label `[CONCEPTO] Bildung`; prompts actualizados en single y synthesis. Ejecuta `/validate` antes de cerrar este mensaje.

**Referencia**: `ROADMAP.md`, `specs/20260530-graph-academic-genre/spec.md` FR-003, FR-004.

---

## PROMPT T02 — Vocabulario de aristas ampliado

Implementa el **Cambio 2** (parte datos/export) del feature Grafo Académico.

**Archivos a tocar**:
- `src/js/graph/build.js` — exportar `EDGE_TYPES` / constantes; usar en `addEdge` validation opcional
- `src/js/export-format.js` — extender `EDGE_TYPE_FAMILIES`
- `specs/20260530-graph-academic-genre/contracts/graph-edge-vocabulary.md` (referencia)

**Tipos nuevos**: `historically_precedes`, `reinterprets`, `constitutes`, `contrasts_with`, `influences` (+ `instantiates` ya parcialmente usado).

**Familias export**:
- `historically_precedes` → didactic
- `reinterprets`, `constitutes`, `influences` → semantic
- `contrasts_with` → argumentative

**Criterio de éxito**: `formatGraphEdgeMarkdown("a","b","contrasts_with","es")` incluye familia argumentativa; `EDGE_TYPES` contiene los 6 tipos nuevos. Ejecuta `/validate` antes de cerrar este mensaje.

**Referencia**: `ROADMAP.md`, spec FR-006, FR-010.

---

## PROMPT T03 — Detección de género textual Phase 0

Implementa el **Cambio 3** (parte IA/validación) del feature Grafo Académico.

**Archivos a tocar**:
- `src/js/slow/phase0.js` — system prompts (single, chunk synthesis), `validatePhase0Orientation`, `normalizeArgumentMapNode`
- `specs/20260530-graph-academic-genre/contracts/phase0-text-genre.md` (referencia)

**Géneros**: ARGUMENTO_LINEAL, GENEALOGÍA, DEBATE, DEFINICIÓN, ANÁLISIS_DE_CASO.

**Prompt** (al inicio, antes de argumentMap):
```
Antes de construir el mapa argumental, clasifica este texto en uno de estos géneros:
[lista de 5 géneros]
Devuelve el género detectado como campo "textGenre" en el JSON de Phase 0.
```

**Estructuras argumentMap por género** (instruir en prompt):
- GENEALOGÍA → nodos con `period`
- DEBATE → nodos con `author`
- DEFINICIÓN → nodo central + satélites
- ARGUMENTO_LINEAL → P1/P2/C (actual)

**Validación**: `textGenre` obligatorio en output normalizado; default `ARGUMENTO_LINEAL` si ausente/inválido.

**Map-reduce**: synthesis prompt debe emitir `textGenre` global.

**Criterio de éxito**: `validatePhase0Orientation({ textGenre: "GENEALOGÍA", thesis, argumentMap: [{id:"G1",text:"x",period:"XVIII"}], conceptsToFind: [...3 items], guideQuestion })` retorna objeto válido con `textGenre`. Ejecuta `/validate` antes de cerrar este mensaje.

**Referencia**: `ROADMAP.md`, spec FR-001, FR-002, FR-011.

---

## PROMPT T04 — buildSlowPhase0Graph genre-aware

Implementa el **Cambio 3** (parte grafo) — aristas según género.

**Deps**: T03 completado (`textGenre` en phase0).

**Archivos a tocar**:
- `src/js/graph/build.js` — `buildSlowPhase0GraphFromInputs`
- Opcional: reglas direccionalidad `reinterprets` si T01 ya mergeado

**Lógica**:
```js
const mapEdgeType =
  phase0.textGenre === "GENEALOGÍA" ? "historically_precedes" : "sequence";
// entre nodos consecutivos de argumentMap
```

**Labels arg nodes**: incluir `period` o `author` en label si presente (ej. `G1 (siglo XVIII): ...`).

**Criterio de éxito**: test manual o unit: phase0 con `textGenre: "GENEALOGÍA"` y 3 nodos mapa → 2 edges `historically_precedes`, 0 `sequence`. Phase0 lineal → edges `sequence`. Ejecuta `/validate` antes de cerrar este mensaje.

**Referencia**: `ROADMAP.md`, spec FR-005, contract `phase0-text-genre.md`.

---

## PROMPT T05 — Deduplicación de clusters (includes)

Implementa el **Cambio 4** del feature Grafo Académico.

**Deps**: T01 completado.

**Archivos a tocar**:
- `src/js/slow/phase0.js` — prompt conceptsToFind + `normalizeConcept`
- `src/js/graph/build.js` — propagar `includes` a nodo grafo (tooltip/metadata)

**Instrucción prompt** (ver `contracts/text-node-subtypes.md`):
Agrupar conceptos con mismo rol estructural en un nodo con `includes: [...]`.

**Criterio de éxito**: `normalizeConcept` preserva `includes`; nodo grafo tiene campo `includes` cuando aplica. Ejecuta `/validate` antes de cerrar este mensaje.

**Referencia**: `ROADMAP.md`, spec FR-003, SC-006.

---

## PROMPT T06 — pruneOrphanNodes

Implementa el **Cambio 5** del feature Grafo Académico.

**Deps**: T04 completado.

**Archivos a tocar**:
- `src/js/graph/build.js` — `export function pruneOrphanNodes`; llamar al final de `buildSlowPhase0GraphFromInputs` y `buildSlowEnrichedGraphFromInputs`
- `src/js/graph/view.js` — antes de `persistEnrichedGraph`
- `specs/20260530-graph-academic-genre/contracts/orphan-prune.md` (referencia)

**Regla**: conservar nodos `layer === 'user'` aunque sin aristas.

**Criterio de éxito**: grafo con 1 nodo text aislado → tras build queda vacío (excepto user); `console.warn` con conteo. Ejecuta `/validate` antes de cerrar este mensaje.

**Referencia**: `ROADMAP.md`, spec FR-008, SC-004.

---

## PROMPT T07 — Estilos SVG aristas en canvas

Implementa la parte visual del **Cambio 2**.

**Deps**: T02 completado.

**Archivos a tocar**:
- `src/js/graph/canvas.js` — `EDGE_COLORS`, stroke dash patterns en render de `<path>`
- Opcional: leyenda edge types

**Estilos**:
- Sólida: sequence, historically_precedes, constitutes, influences
- Punteada: relates, contrasts_with, reinterprets
- Gruesa punteada: contradicts, refuta, cuestiona

**Criterio de éxito**: SVG paths con `stroke-dasharray` distinto según `data-edge-type`; colores para tipos nuevos. Ejecuta `/validate` antes de cerrar este mensaje.

**Referencia**: `ROADMAP.md`, spec FR-009, contract `graph-edge-vocabulary.md`.

---

## PROMPT T08 — Tests y QA

Cierra el feature con tests automatizados y verificación quickstart.

**Deps**: T04, T05, T06, T07 completados.

**Archivos a crear/tocar**:
- `cursor-tests/20260607_t15-graph-academic-genre.mjs` (nuevo)
- Verificar regresión: `cursor-tests/20260607_t14-graph-refactor.mjs`
- `specs/20260530-graph-academic-genre/quickstart.md` (seguir escenarios)

**Tests mínimos**:
1. `buildSlowPhase0GraphFromInputs` con GENEALOGÍA → `historically_precedes`
2. `buildSlowPhase0GraphFromInputs` con ARGUMENTO_LINEAL → `sequence`
3. `pruneOrphanNodes` elimina text huérfano, conserva user
4. `normalizeConcept` con `nodeType` + `includes`
5. `formatGraphEdgeMarkdown` para `contrasts_with`

**Criterio de éxito**: ambos test files PASS; quickstart escenarios A–D verificados. Ejecuta `/validate` antes de cerrar este mensaje.

**Referencia**: `ROADMAP.md`, `specs/20260530-graph-academic-genre/quickstart.md`.
