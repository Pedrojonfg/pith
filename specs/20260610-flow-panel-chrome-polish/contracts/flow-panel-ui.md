# Contract: Flow Recommendation Panel UI (v2)

**Location**: `index.html` + `study.js` + `main.css`

**Replaces**: `specs/20260609-flow-recommendation/contracts/recommendation-ui.md` (markup/CSS only; estados conservados)

## Element IDs

| ID | Purpose |
|----|---------|
| `#flowRecommendUpload` | Wrapper CTA upload (visible en `cta_upload`) |
| `#flowRecommendBtn` | «Recommend my study flow» |
| `#flowRecommendFileInput` | `input[type=file]` oculto |
| `#recommendationPanel` | Container panel (`intro` \| `progress`) |
| `#recommendationGenreLabel` | Genre + tiempo total |
| `#recommendationFlowTitle` | Título pasos «RSVP → Questions» |
| `#recommendationReasoning` | Subtítulo reasoning |
| `#recommendationStartBtn` | CTA principal |
| `#recommendationOverrideSelect` | «Go directly to…» |
| `#recommendationWhyDetails` | `<details>` Why this flow |
| `#recommendationWhyBody` | Contenido explicación |
| `#recommendationQuickFlow` | Link flujo rápido |
| `#recommendationProgress` | Stepper container |
| `#recommendationProgressSteps` | Lista de steps |

## View states

### `cta_upload`

- `#flowRecommendUpload` visible
- `#recommendationPanel` hidden

### `intro` / `progress`

- `#flowRecommendUpload` hidden
- `#recommendationPanel` visible
- Stepper: todos `upcoming` excepto completados en `progress`
- CTA label: `Start [first step]` o `Continue with [next]`

## Interactions

| Control | Action |
|---------|--------|
| `#flowRecommendBtn` | Abre file picker → upload → `computeAndPersistModeRecommendation` → re-render |
| `#recommendationStartBtn` | `applyFlowRecommendationOnEnterMode(step.mode)` + navegar |
| `#recommendationOverrideSelect` | `change` → `recordUserOverride` + launch selected mode |
| `#recommendationWhyDetails` | Toggle nativo; no `preventDefault` |
| `#recommendationQuickFlow` a | Launch `quickFlow[0].mode` |

## Styling requirements (dark theme)

```css
/* Minimum contract */
.flow-override-select {
  color-scheme: dark;
  background: var(--surface-elevated, #1e1e2e);
  color: var(--text-primary, #e8e8ed);
}
.flow-override-select option {
  background: #1e1e2e;
  color: #e8e8ed;
}
.flow-progress-step .completed { opacity: 1; border-color: var(--accent); }
.flow-progress-step .current { box-shadow: 0 0 0 2px var(--accent); }
.flow-progress-step .upcoming { opacity: 0.45; }
```

- Contraste texto/fondo ≥ 4.5:1 en select y options
- Un solo stepper; NO segunda barra `.progress-fill` huérfana
- Panel: `.flow-panel` con animación entrada 200ms ease-out

## Accessibility

- `#recommendationWhyDetails summary` focusable
- Override select: `aria-label="Go directly to another study mode"`
- Stepper: `role="list"` con `aria-current="step"` en paso actual

## Copy (English)

- CTA: «Recommend my study flow»
- Override label: «Another mode» / placeholder «Go directly to…»
- Why: «Why this flow?»
- Quick: «Only ~{n} min? → {labels}»
- Time suffix: «(approx.)»

## Mount points

Panel y CTA viven en `#screenModeSelect` (arriba del fieldset de modos), no en create screen, para evitar duplicación al volver de biblioteca de documentos.
