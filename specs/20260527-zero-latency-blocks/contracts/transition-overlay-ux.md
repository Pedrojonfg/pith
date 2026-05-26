# Contract: Block Transition Overlay UX

**Location**: `src/js/study.js` — `getOrCreateTransitionOverlay()`, `finishQuestions()`, `setTransitionOverlayOpen()`

## Views

### Default view (`view === "default"`)

**Visible**:
- Título: `Continuar al bloque {nextIndex+1} de {total}`
- Diccionario: `renderDictionary({ collapsedByDefault: true })` — siempre colapsado al abrir
- Barra de estado prefetch (`statusBarText` + fill animation)
- Botón primario: **Siguiente bloque** (`continueBtn` repurposed)
- Botón secundario: **Ajustar siguiente bloque** (`adjustBtn` — nuevo o reutilizar control)

**Hidden / absent**:
- Textarea guía / comentarios
- Controles `n_test` / `n_socratic` (hasta entrar en Adjust)
- Botón "Skip this block" de error (solo en fallo)

**Primary button rules**:
- `disabled` when `prefetchState.blockIndex !== nextIndex` OR `status !== 'ready'` OR `configKey !== expectedConfigKey`
- `enabled` when ready + key match
- `onclick`: persist block from prefetch → `setTransitionOverlayOpen(false)` → `startBlock(nextIndex)` — **no** `getPrefetchedBlock` wait loop post-click

### Adjust view (`view === "adjust"`)

**Visible**:
- `<details open>` con steppers test/socratic (existentes)
- Botón **Confirmar** (regenerar o reutilizar según diff de config)
- Enlace **Volver** a default view

**Behavior on Confirm**:
- Si config === prefetch key y `ready`: consume prefetch
- Si solo counts changed + valid explanation: `generateQuestionsOnlyForIndex` (ver otro contrato)
- Else: `generateBlockDirect` full

## Labels (Spanish UI)

| Control | Text |
|---------|------|
| Primary | Siguiente bloque |
| Secondary | Ajustar siguiente bloque |
| Adjust confirm | Confirmar |
| Adjust back | Volver |

## Error states

| State | UI |
|-------|-----|
| `failed` | Mensaje error + Reintentar + (opcional) saltar bloque |
| `generating` | Barra animada; primary disabled |
| `ready` | Barra verde "Listo ✓"; primary enabled |

## Removed behaviors

- No `setPendingComment` from overlay
- No auto-continue loop with `continueRequested` + `Finishing up… (~Ns)` on fast path (only if user explicitly confirms in Adjust while generating)

## Integration

- `setPrefetchIndicator(status)` sigue sincronizado con barra overlay
- `prefetchStartedAtByIndex` opcional para telemetría dev
