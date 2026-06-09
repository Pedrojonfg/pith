# Quickstart: Section Detection Improvements QA

**Feature**: `20260534-section-detection-impr`

## Prerequisites

- App servida localmente (`npx serve` o Live Server)
- Node 18+ para cursor-tests
- PDF *Primates y Filósofos* (De Waal) — opcional para manual golden test

## Automated

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260609_t01-outline-normalize.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260609_t02-front-matter.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260609_t03-outline-short-circuit.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260609_t04-scope-min-chars.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260609_t05-dehyphenate.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260609_t06-regression-integration.mjs
```

Regresión structure-inference existente:

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260608_t01-structure-inference.mjs
```

## Manual — Golden PDF (Primates y Filósofos)

1. Subir PDF en Slow Mode.
2. Esperar normalización → pantalla scope picker.
3. **Expect**:
   - ~6 partes L1 visibles (no 19 opciones planas)
   - Sin "ATE", "~II~", "PAIDOS"
   - Tamaños en formato `~420k`, no `417406 chars`
   - "Full document" siempre primera opción
4. Abrir consola → verificar `structure.outlineCoverage` ≈ 1.0 si expuesto.

## Manual — TXT sin estructura

1. Subir `.txt` con >5k chars de párrafo continuo.
2. **Expect**: banner `low_heading_confidence` + secciones "Sección 1", "Sección 2"…
3. Botón "Editar secciones" activo.

## Manual — Overrides

1. Tras upload con headings, click "Editar secciones".
2. Renombrar una sección → label cambia en picker, texto intacto.
3. Eliminar sección → desaparece del picker.
4. Recargar página → overrides persisten.

## Manual — Dehyphenation

1. Subir PDF con palabras partidas (`intrinseca-\nmente`).
2. Inspeccionar `session.slow.normalizedTextFull`.
3. **Expect**: `intrinsecamente` sin guión ni salto.

## Failure signals

| Síntoma | Posible causa |
|---------|----------------|
| 19 opciones planas sin jerarquía | FIX-08 no aplicado |
| "Introducci6n" en headings | FIX-01 no aplicado |
| Secciones de portada | FIX-02 / FIX-05 |
| Headings duplicados outline+heuristic | FIX-03 |
| Opciones de 12 chars | FIX-04 |
| Texto mezclado bicolumna en TOC | FIX-06 |
