# Research: Grafo Académico — Género Textual y Tipado Filosófico

**Feature**: `20260530-graph-academic-genre` | **Date**: 2026-06-07

## R1 — Clasificación de género textual en Phase 0

**Decision**: Añadir `textGenre` al JSON Phase 0, generado *antes* del `argumentMap` en el mismo prompt system (sin llamada IA extra).

**Rationale**: El usuario identificó este cambio como el más importante. Un segundo pass IA duplicaría latencia y coste; el modelo puede clasificar y estructurar en una sola respuesta JSON si las instrucciones preceden al schema del mapa.

**Alternatives considered**:
- *Clasificador separado pre-Phase 0* — rechazado: +1 llamada IA, más complejidad de orquestación.
- *Inferir género heurísticamente en cliente* — rechazado: impreciso para textos mixtos.
- *Solo metadata manual del usuario* — rechazado: fricción UX innecesaria.

## R2 — Estructuras de argumentMap por género

**Decision**:

| Género | Estructura mapa | Arista secuencial en grafo |
|--------|-----------------|---------------------------|
| ARGUMENTO_LINEAL | P1/P2/…/C (actual) | `sequence` |
| GENEALOGÍA | nodos con `period` | `historically_precedes` |
| DEBATE | nodos con `author` | `relates` o `contrasts_with` (según linkType IA) |
| DEFINICIÓN | central + satélites | `constitutes` / `contrasts_with` hacia centro |
| ANÁLISIS_DE_CASO | caso + marco teórico | `instantiates` / `influences` |

**Rationale**: Cada género refleja la ontología del discurso académico; Horlacher (genealogía) no es un argumento lineal.

**Alternatives considered**:
- *Un solo mapa P1/C para todos* — status quo; falla en genealogías (problema reportado).
- *Grafo libre sin mapa* — rechazado: pierde orientación Phase 0 para el lector.

## R3 — Subtipos de nodo en capa text

**Decision**: Campo `nodeType` en `conceptsToFind`; label de nodo grafo prefijado `[TIPO]`; reglas de arista validadas en `build.js`.

**Rationale**: Misma capa `text` en canvas (columna 2) — no requiere nueva columna layout; el subtipo es metadata + prefijo visual.

**Alternatives considered**:
- *Capas separadas por tipo (persona, obra)* — rechazado: rompe layout de 4 columnas y sidebar dictionary.
- *Solo en prompt sin persistir* — rechazado: se pierde en grafo enriquecido y export.

## R4 — Vocabulario de aristas ampliado

**Decision**: Añadir 6 tipos al enum implícito de `GraphEdge.type`:

| Tipo | Familia export | Uso |
|------|----------------|-----|
| `historically_precedes` | didactic | Genealogía temporal |
| `reinterprets` | semantic | Persona/movimiento resignifica concepto |
| `constitutes` | semantic | Componente filosófico |
| `contrasts_with` | argumentative | Distinción sin contradicción lógica |
| `influences` | semantic | Causalidad débil |
| `instantiates` | semantic | Caso concreto de abstracción |

**Rationale**: `contradicts` ≠ `contrasts_with` (Bildung vs Erziehung). Tipos existentes (`supports`, `contradicts`, `relates`, `sequence`) se mantienen.

**Alternatives considered**:
- *Reutilizar solo `relates` con metadata* — rechazado: pierde semántica en export y estilos canvas.
- *Ontología OWL completa* — rechazado: over-engineering para PWA local.

## R5 — Deduplicación de clusters (includes)

**Decision**: Campo opcional `includes: string[]` en `conceptsToFind`; prompt instruye agrupar roles estructurales equivalentes.

**Rationale**: Resuelve inflación de nodos anti-Bildung (PISA, estandarización, etc.) sin post-procesamiento heurístico.

**Alternatives considered**:
- *Merge automático por similitud de embedding* — rechazado: sin embeddings en cliente; coste IA.
- *Límite duro de nodos sin agrupar* — rechazado: pierde información si se trunca arbitrariamente.

## R6 — Prune de nodos huérfanos

**Decision**: `pruneOrphanNodes(graph)` en `build.js`, invocado al final de `buildSlowPhase0GraphFromInputs` y `buildSlowEnrichedGraphFromInputs`; también en `view.js` antes de `persistEnrichedGraph`.

**Rationale**: Nodos sin aristas (excepto `user`) contaminan vista y export; el usuario citó casos concretos (Del soliloquio, Zöllner).

**Alternatives considered**:
- *Ocultar en UI solo* — rechazado: siguen en export y dictionary merge.
- *Prune solo en Phase 0* — rechazado: enriched graph también genera huérfanos desde concepts sueltos.

## R7 — Estilos canvas para aristas

**Decision**: Mapeo stroke en `canvas.js`:

- Sólida (default): `sequence`, `requires`, `covers`, `supports`, `constitutes`, `influences`
- Punteada: `relates`, `contrasts_with`, `historically_precedes`, `reinterprets`
- Doble (`stroke-width` + dash offset): `contradicts`, `refuta`, `cuestiona`

**Rationale**: Diferenciación visual sin cambiar arquitectura de layout por columnas.

**Alternatives considered**:
- *Color único por tipo (12 colores)* — rechazado: paleta saturada, accesibilidad.
- *Force-directed layout* — rechazado: fuera de alcance; spec pide estilos de línea solamente.

## R8 — Backward compatibility

**Decision**: `textGenre` default `ARGUMENTO_LINEAL`; `nodeType` default `CONCEPTO`; campos `period`, `author`, `includes` opcionales.

**Rationale**: Sesiones Slow existentes en localStorage siguen validando y renderizando.

**Alternatives considered**:
- *Migración one-shot al cargar sesión* — diferido; defaults suficientes para v1.
