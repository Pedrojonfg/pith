# Quickstart: Markdown Canonical QA

**Feature**: `20260532-markdown-canonical`

## Prerequisites

- Rama `20260532-markdown-canonical`
- Node para `cursor-tests`

## Automated

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260527_t18-input-normalization.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260608_t01-structure-inference.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260608_t01-markdown-canonical.mjs
```

## Manual — HTML Word → markdown

1. Subir `<p class="Heading1">Capítulo 1</p><p>Texto.</p>`
2. **Expect**: `normalizedFormat === "markdown"`
3. **Expect**: contenido `# Capítulo 1` o `## Capítulo 1`, sin `<p>`
4. Slow scope picker → ≥2 opciones

## Manual — Slow reader sin tags

1. Tras upload HTML, abrir Slow reader
2. **Expect**: texto legible sin `<h1>` visible

## Manual — RSVP HTML upload

1. Subir HTML en modo RSVP
2. **Expect**: split de bloques sin tags HTML en consola/logs de material

## Manual — Sesión legacy

1. Cargar fixture `cursor-tests/fixtures/legacy-html-min-session.json`
2. **Expect**: sesión abre; scope picker funciona
3. Re-guardar → `normalizedFormat` pasa a `markdown`

## Failure signals

| Síntoma | Causa probable |
|---------|----------------|
| Tags visibles en reader | Pipeline aún emite html_min |
| Scope vacío tras HTML upload | Headings no emitidos en markdown |
| t18 falla en testHtmlNormalize | Test aún espera `html_min` |
