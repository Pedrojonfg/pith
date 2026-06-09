# ROADMAP — Document Hierarchy Pre-Index

**Feature**: `20260609-doc-hierarchy-index` | **Spec**: `specs/20260609-doc-hierarchy-index/spec.md` | **Plan**: `specs/20260609-doc-hierarchy-index/plan.md`

## Tabla de tareas

| ID | Descripción | Deps | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T01 | `hierarchy.js`: funciones puras (determinístico, trivial, validate, flatten, chunks) | — | M | [x] |
| T02 | `buildDocumentHierarchy` + prompt LLM + fallback | T01 | M | [x] |
| T03 | `hierarchy-cache.js` + integración cache | — | S | [x] |
| T04 | Integración upload: `study.js` + `session.js` + loading UI | T02, T03 | M | [x] |
| T05 | Scope picker desde árbol (`slow/headings.js`) | T04 | M | [x] |
| T06 | Paginación respeta fronteras (`slow/pagination.js`, `reader.js`) | T04 | M | [x] |
| T07 | Chunks Fase 0 + contexto árbol (`slow/phase0.js`) | T04 | M | [x] |
| T08 | Tests integración + quickstart closure | T05, T06, T07 | M | [x] |

## Diagrama de dependencias

```text
T01 → T02 → T04 → T05 → T08
T03 ↗        ↓ → T06 → T08
             ↓ → T07 → T08
```

**Paralelizables desde inicio**: T01, T03 (hasta 2 agentes)

**Paralelizables tras T04**: T05, T06, T07 (hasta 3 agentes)

**Secuenciales críticos**: T01 antes T02; T02+T03 antes T04; T04 antes T05/T06/T07

## Orden de ejecución recomendado

### Ola 1 (paralelo — 2 agentes)
- **T01** funciones puras `hierarchy.js`
- **T03** cache `hierarchy-cache.js`

### Ola 2 (1 agente, tras T01)
- **T02** LLM + `buildDocumentHierarchy`

### Ola 3 (1 agente, tras T02+T03)
- **T04** integración upload + sesión + UI

### Ola 4 (paralelo — 3 agentes, tras T04)
- **T05** scope picker
- **T06** paginación
- **T07** Fase 0 chunks

### Ola 5 (cierre)
- **T08** tests integración + quickstart

---

## PROMPT T01 — hierarchy.js funciones puras

Implementa **T01** del ROADMAP Document Hierarchy Pre-Index.

**Contexto**: Feature `20260609-doc-hierarchy-index`. Una sola fuente de verdad estructural (`docHierarchy`) para scope picker, paginación y Fase 0. Ver `specs/20260609-doc-hierarchy-index/contracts/hierarchy-schema.md`.

**Archivos**:
- `src/js/normalization/hierarchy.js` (NUEVO) — `buildDeterministicHierarchy`, `buildTrivialHierarchy`, `validateHierarchy`, `flattenHierarchy`, `getChunksFromHierarchy`
- `cursor-tests/20260609_doc-hierarchy-pure.mjs` (NUEVO) — tests primero

**Sin LLM en esta tarea.** `buildDeterministicHierarchy` parsea líneas `#`/`##`/`###` y calcula offsets. `buildTrivialHierarchy` un nodo raíz. `validateHierarchy` según contrato. `getChunksFromHierarchy` fusiona/divide respetando `maxChunkSize`.

**Criterio de éxito**: tests pasan para determinístico, trivial, validación, flatten y chunks sin pérdida de texto. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T02 — LLM buildDocumentHierarchy

Implementa **T02** del ROADMAP Document Hierarchy Pre-Index.

**Contexto**: Modo LLM para docs ≥3000 chars sin headings. Ver `specs/20260609-doc-hierarchy-index/contracts/llm-hierarchy-prompt.md`.

**Archivos**:
- `src/js/normalization/hierarchy.js` — añadir `buildDocumentHierarchy(markdownText, llmFn, options)` con selección de modo, prompt, JSON parse, `validateHierarchy`, fallback determinístico

**Depende de T01.** `llmFn` inyectado (no importar `api.js`). Tests con mock `llmFn`.

**Criterio de éxito**: dado fixture paper sin headings, `text.slice(node.startOffset, node.endOffset)` coincide; JSON inválido → fallback determinístico. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T03 — hierarchy-cache.js

Implementa **T03** del ROADMAP Document Hierarchy Pre-Index.

**Contexto**: Cache localStorage por hash, TTL 7 días, LRU 20 entradas. Ver `specs/20260609-doc-hierarchy-index/data-model.md` (HierarchyCacheEntry).

**Archivos**:
- `src/js/normalization/hierarchy-cache.js` (NUEVO) — `hashText`, `getCachedHierarchy`, `setCachedHierarchy`
- Integrar en `buildDocumentHierarchy` con `useCache: true`

**Criterio de éxito**: segunda llamada con mismo texto no invoca `llmFn` (test mockeado). Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T04 — Integración upload y sesión

Implementa **T04** del ROADMAP Document Hierarchy Pre-Index.

**Contexto**: Tras normalizar, generar `session.docHierarchy`. Ver `specs/20260609-doc-hierarchy-index/contracts/consumer-integration.md` §1.

**Archivos**:
- `src/js/session.js` — `docHierarchy: null` en defaults
- `src/js/study.js` — llamar `buildDocumentHierarchy` post-upload; cablear `llmFn` desde `llm.js`/`api.js`; loading state no bloqueante
- `index.html` / CSS mínimo si hace falta indicador de carga en scope picker

**Sin API key en modo LLM requerido → `docHierarchy = null`.**

**Criterio de éxito**: tras subir doc ≥3000 chars, `session.docHierarchy` válido; loading visible en modo LLM. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T05 — Scope picker desde árbol

Implementa **T05** del ROADMAP Document Hierarchy Pre-Index.

**Contexto**: Reemplazar heurísticas cuando `docHierarchy` existe. Ver contrato §2.

**Archivos**:
- `src/js/slow/headings.js` — `buildScopeOptions` lee `flattenHierarchy(session.docHierarchy.tree, 2)`; fallback si `null`
- `src/js/study.js` — pasar `docHierarchy` si necesario

**Criterio de éxito**: paper sin headings muestra árbol inferido en scope picker; sesión sin `docHierarchy` sin regresión. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T06 — Paginación respeta fronteras

Implementa **T06** del ROADMAP Document Hierarchy Pre-Index.

**Contexto**: Snap ±200 chars a `startOffset` de sección. Ver contrato §3.

**Archivos**:
- `src/js/slow/pagination.js` — opción `sectionBoundaries`, `sectionSnapSlack: 200`
- `src/js/slow/reader.js` — pasar boundaries desde `docHierarchy` (scope-relative)

**Criterio de éxito**: test con secciones conocidas — cortes en fronteras, no a mitad. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T07 — Chunks Fase 0 desde árbol

Implementa **T07** del ROADMAP Document Hierarchy Pre-Index.

**Contexto**: Map-reduce usa `getChunksFromHierarchy`; prompt Fase 0 recibe árbol. Ver contrato §4.

**Archivos**:
- `src/js/slow/phase0.js` — reemplazar chunking arbitrario; contexto estructural en prompts

**Criterio de éxito**: chunks contiguos, sin solapamiento, cubren texto completo; títulos de sección en cada chunk. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T08 — Tests integración y QA

Implementa **T08** del ROADMAP Document Hierarchy Pre-Index.

**Contexto**: Cierre de feature. Ver `specs/20260609-doc-hierarchy-index/quickstart.md`.

**Archivos**:
- `cursor-tests/20260609_doc-hierarchy-integration.mjs` (NUEVO)
- Casos: headings→determinístico; sin headings→LLM; <3k→trivial; cache; validación fallida→fallback; chunks; scope picker; paginación

**Criterio de éxito**: todos los cursor-tests pasan; checklist quickstart completo; marcar T01–T08 [x] en este ROADMAP. Ejecuta `/validate` antes de cerrar este mensaje.
