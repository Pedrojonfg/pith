# Quickstart: Structure Inference QA

**Feature**: `20260531-structure-inference`

## Prerequisites

- App servida localmente (`npx serve` o equivalente)
- Node para `cursor-tests`

## Automated

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260527_t18-input-normalization.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260608_t01-structure-inference.mjs
```

## Manual — TXT con secciones numeradas

1. Crear `test-notes.txt`:
   ```text
   1. Introducción

   Párrafo de cuerpo largo con varias oraciones.

   1.1 Contexto

   Más cuerpo.
   ```
2. Subir en Slow Mode o RSVP.
3. **Expect**: `normalizedFormat === "markdown"`; contenido incluye `##` o `#` antes de Introducción/Contexto.
4. Abrir scope picker → **Expect**: opciones además de "Full document".

## Manual — HTML Word export

1. Archivo con `<p class="Heading1">Capítulo 1</p><p>Texto...</p>`
2. Subir como `.html`
3. **Expect**: `html_min` contiene `<h1>Capítulo 1</h1>` o equivalente.

## Manual — PDF académico

1. Subir PDF de paper con texto seleccionable (no escaneado).
2. **Expect**: sin líneas sueltas `42` entre párrafos; al menos un `#` o `##` si el PDF tiene secciones tipográficas.
3. Si PDF uniforme: **Expect**: warning `low_heading_confidence` en consola o metadatos.

## Manual — Regresión Slow scope

1. Tras upload normalizado, ir a Slow Mode → elegir scope.
2. **Expect**: `buildScopeOptions` devuelve ≥2 entradas cuando hay headings.

## Manual — MD preservado

1. Subir `.md` con `# Title` existente.
2. **Expect**: `# Title` intacto; sin `<script>` si había basura.

## Failure signals

| Síntoma | Posible causa |
|---------|----------------|
| Scope solo "Full document" | Pipeline no emitió headings |
| Números sueltos en texto | strip-artifacts no aplicado |
| HTML sin h1 | inferencia antes de strip falló |
| Upload PDF vacío | scanned_pdf_no_text |
