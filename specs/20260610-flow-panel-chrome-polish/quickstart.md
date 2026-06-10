# Quickstart: Flow Panel & Study Chrome Polish

**Feature**: `20260610-flow-panel-chrome-polish`

## Prerequisites

- `20260609-flow-recommendation` backend completo
- Branch `20260610-flow-panel-chrome-polish`
- `.specify/feature.json` apunta a este feature dir

## Automated tests

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260610_flow-panel-chrome-polish.mjs
```

Regresión UI compact (no debe romper):

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260610_ui-compact-collapsibles-validate.mjs
```

Actualizar test compact para permitir panel v2 (IDs restaurados).

## Manual QA

> Automated regression: `20260610_flow-panel-chrome-polish.mjs` (74 cases) + compact validate updated for panel v2.

### QA-CHROME-1 — Pantalla principal

1. Abrir app → mode select
2. Verificar: sin FAB rojo, sin FAB azul

### QA-CHROME-2 — RSVP lectura

1. RSVP → upload → bloques → ready → leer bloque
2. Verificar: sin FABs durante lectura RSVP

### QA-CHROME-3 — RSVP preguntas

1. Llegar a test/socrático bloque 1+
2. Verificar: FAB rojo visible; FAB azul oculto

### QA-CHROME-4 — Questions mode

1. Modo Questions → sesión con conceptos
2. En test/socrático: FAB azul visible, FAB rojo oculto
3. En between con diccionario: FAB azul visible

### QA-CHROME-5 — Cloze mode

1. Cloze → generar → estudiar → preguntas si aplica
2. FAB azul en fases de preguntas; sin FAB rojo

### QA-CHROME-6 — Slow Mode

1. Cualquier fase Slow
2. Sin FAB rojo ni azul

### QA-FLOW-1 — Solo CTA

1. Mode select sin documento
2. Solo «Recommend my study flow»; sin panel

### QA-FLOW-2 — Solo panel

1. Subir paper → esperar recomendación
2. Panel visible; CTA oculto

### QA-FLOW-3 — Override select

1. Abrir «Go directly to…»
2. Opciones legibles (no blanco sobre blanco)
3. Elegir modo → navega y `userOverride` true

### QA-FLOW-4 — Why this flow

1. Expandir «Why this flow?»
2. Texto explicativo visible

### QA-FLOW-5 — Progreso

1. Completar un paso del flujo
2. Stepper muestra ✓ en completado, highlight en actual
3. Sin barra duplicada

### QA-FLOW-6 — Quick flow link

1. Recomendación con `quickFlow` más corto
2. Link «Only ~N min?» visible y funcional
