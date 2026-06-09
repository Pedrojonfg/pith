# Research: Document Hierarchy Pre-Index

**Feature**: `20260609-doc-hierarchy-index` | **Date**: 2026-06-09

## R1 — Cuándo usar LLM vs determinístico

**Decision**: Tres modos mutuamente excluyentes según tabla de condiciones del spec (headings → determinístico; <3k → trivial; ≥3k sin headings + API key → LLM).

**Rationale**: Headings markdown son O(n) y fiables; LLM solo donde heurísticas actuales fallan (papers filosóficos). Umbral 3000 chars evita coste en notas cortas.

**Alternatives considered**:
- Siempre LLM — rechazado por coste/latencia en libros con TOC claro
- Nunca LLM — no resuelve el caso de uso principal

## R2 — Inyección de LLM en módulo puro

**Decision**: `buildDocumentHierarchy(markdownText, llmFn, options)` recibe `llmFn` como dependencia inyectada; el módulo `hierarchy.js` no importa `api.js` ni `llm.js`.

**Rationale**: Funciones puras testeables con mock; `input-normalization.js` o `study.js` cablean `llmFn` real.

**Alternatives considered**:
- Import directo de `callChatCompletion` — acopla normalización a red y dificulta tests

## R3 — Hash y cache

**Decision**: Hash ligero no criptográfico (djb2 o FNV sobre string); clave `localStorage['mylearning_hierarchy_{hash}']`; TTL 7 días; LRU 20 entradas.

**Rationale**: Evita re-llamar LLM en re-subidas; límite de entradas protege quota localStorage.

**Alternatives considered**:
- Cache en sesión solamente — no sobrevive recarga
- IndexedDB — overkill para ~20 árboles JSON compactos

## R4 — Integración scope picker

**Decision**: Extender `buildScopeOptions` en `slow/headings.js` para leer `session.docHierarchy` vía `flattenHierarchy` (niveles 1–2) antes de `parseHeadings`; si `docHierarchy === null`, flujo actual.

**Rationale**: `buildScopeOptions` ya es el punto único del picker; evita duplicar UI en `study.js`.

**Alternatives considered**:
- Nuevo `slow/scope.js` — el spec original lo nombraba pero no existe en repo

## R5 — Paginación con fronteras de sección

**Decision**: Pasar `sectionBoundaries` opcional a `computePageBreakpoints` en `pagination.js`; al calcular fin de página, si hay `startOffset` de sección en `(cut, cut+200]`, snap al `startOffset`.

**Rationale**: Cambio localizado; `reader.js` ya llama `computePageBreakpoints` con options.

**Alternatives considered**:
- Re-paginar solo al cambiar sección — más complejo, peor UX

## R6 — Chunks Fase 0

**Decision**: Reemplazar lógica interna de `buildMapReduceChunks` para aceptar árbol vía `getChunksFromHierarchy`; mantener firma compatible con `sectionBoundaries` derivadas del árbol.

**Rationale**: `phase0.js` ya usa `sectionBoundaries` de headings; el árbol unifica la fuente.

**Alternatives considered**:
- Duplicar función nueva en phase0 — dos caminos de chunking

## R7 — Momento de ejecución en pipeline

**Decision**: Llamar `buildDocumentHierarchy` al final de `normalizeStudyMaterial` / flujo de upload en `study.js`, no dentro de `normalizeDocumentStructure` (que debe seguir siendo determinístico puro).

**Rationale**: LLM requiere API key de sesión y loading UI; la normalización estructural no debe depender de red.

**Alternatives considered**:
- Dentro de `normalization/index.js` — mezcla determinístico + async LLM

## R8 — Validación post-LLM

**Decision**: `validateHierarchy(tree, textLength)` comprueba: enteros en rango, hermanos contiguos sin solapamiento, ≥1 nodo, `endOffset` último raíz = textLength (tolerancia ±1 si trim).

**Rationale**: LLMs fallan en offsets; fallback determinístico es red de seguridad obligatoria.

**Alternatives considered**:
- Re-prompt LLM en fallo — latencia doble, coste extra
