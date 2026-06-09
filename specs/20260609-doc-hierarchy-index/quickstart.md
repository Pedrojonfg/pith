# Quickstart: Document Hierarchy Pre-Index

**Feature**: `20260609-doc-hierarchy-index`

## Prerequisites

- Branch `20260609-doc-hierarchy-index`
- API key DeepSeek o Gemini configurada (para modo LLM)
- `20260532-markdown-canonical` activo (markdown en sesión)

## Automated tests

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260609_doc-hierarchy-pure.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260609_doc-hierarchy-integration.mjs
```

## Manual QA

### QA-1 — Determinístico (con headings)

1. Subir `.md` con `# Cap 1` y `## Sec 1.1`
2. Verificar en consola: `session.docHierarchy.method === 'deterministic'`
3. Scope picker lista capítulos sin delay LLM

### QA-2 — LLM (sin headings)

1. Subir `.txt` filosófico ≥3000 chars sin `#`
2. Ver loading ~1–3s en scope picker
3. `method === 'llm'`; secciones tienen títulos inferidos
4. `text.slice(node.startOffset, node.endOffset)` legible

### QA-3 — Cache

1. Re-subir el mismo archivo
2. Sin segunda llamada LLM (network tab o mock)
3. Carga instantánea

### QA-4 — Trivial

1. Subir nota <3000 chars
2. Una sola sección en árbol; `method === 'trivial'`

### QA-5 — Paginación

1. Documento con secciones conocidas en Slow Mode Fase 1
2. Avanzar páginas: cortes cerca de inicios de sección, no a mitad de párrafo argumental

### QA-6 — Fase 0 map-reduce

1. Documento ≥60k chars
2. Chunks en consola/log muestran títulos de sección
3. Mapa argumental más coherente por sección

## Definition of Done

- [x] T01–T08 completados en ROADMAP.md
- [x] cursor-tests pasan
- [ ] QA-1 a QA-6 verificados manualmente
- [ ] Sesiones legacy sin regresión
