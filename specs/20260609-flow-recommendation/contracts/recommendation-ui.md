# Contract: Recommendation Panel UI

**Location**: `index.html` (markup) + `study.js` (render/mount) + `main.css` (styles)

## Element IDs (suggested)

| ID | Purpose |
|----|---------|
| `#recommendationPanel` | Container principal |
| `#recommendationGenreLabel` | genreLabel + tiempo total |
| `#recommendationFlowSteps` | Steps lineales primaryFlow |
| `#recommendationReasoning` | 1–2 frases |
| `#recommendationStartBtn` | "Comenzar [primer paso]" |
| `#recommendationOverrideSelect` | Desplegable 4 modos |
| `#recommendationWhyLink` | Tooltip genreReasoning |
| `#recommendationQuickFlow` | Link flujo rápido si tiempo limitado |
| `#recommendationProgress` | Vista progreso (estado B) |

## State A — Introducción (documento nuevo o sin progreso)

**Show when**: `modeRecommendation && currentStepIndex === 0 && completedSteps.length === 0 && !userOverride`

Content:
- `[genreLabel] · ~[sum estimatedTimeMin] min flujo completo (aprox.)`
- Steps: `paso1 → paso2 → paso3` con labels
- `reasoning` text
- Primary CTA → lanza `primaryFlow[0].mode`
- Secondary → override select → `recordUserOverride` + launch mode
- "¿Por qué este flujo?" → `pedagogicalMeta.genreReasoning` o `analysis.genreLabel`
- Si `quickFlow` total < primary: `¿Tienes menos de X min? → [quickFlow labels]`

## State B — Progreso

**Show when**: `completedSteps.length > 0`

Content:
- `Progreso: Slow ✓ → Cloze (siguiente) → Revisión`
- CTA "Continuar con [next mode]"
- Badge SM-2 due count si `review` pendiente

## State C — Hidden

- `userOverride === true` (intro no vuelve)
- Cambio de modo intra-sesión (panel no re-mount)
- Sin `modeRecommendation`

## Accessibility

- Botones focusables; tooltip accesible vía `title` o `aria-describedby`
- No bloquear scroll ni modal overlay

## Copy locale

Español; sufijo "(aprox.)" en tiempos.
