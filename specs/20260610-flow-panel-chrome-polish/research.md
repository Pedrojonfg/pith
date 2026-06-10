# Research: Flow Panel & Study Chrome Polish

**Feature**: `20260610-flow-panel-chrome-polish`

## R1 — Reglas actuales de FABs

**Decision**: Reemplazar `SCREENS_WITH_GUIDE_TOGGLE` plano por función `resolveChromeVisibility({ screenId, studyMode, phase })` que combine pantalla + modo.

**Rationale**: Hoy `syncFloatingChrome` muestra guía en `clozeStudy`, `review`, `between`, etc. sin filtrar por modo; el libro rojo solo chequea `isRsvp` pero no excluye pantallas principales si `blockReadWanted` queda true.

**Alternatives considered**:
- CSS `body[data-screen]` únicamente — rechazado: lógica de negocio debe vivir en JS testeable.
- Duplicar reglas en `dictionary.js` — rechazado: una sola fuente de verdad en `ui.js`.

## R2 — Matriz modo × fase × FAB

**Decision**:

| FAB | Visible cuando |
|-----|----------------|
| Libro rojo | `studyMode === 'rsvp'` AND `screenId ∈ {test, socratic}` AND `blockReadWanted` |
| Menú azul | `studyMode ∈ {cloze, questions}` AND `screenId ∈ {test, socratic, between}` AND NOT slow/offline/assessment AND (between → concepts.length > 0) |

**Rationale**: Alineado con requisitos del usuario; excluye RSVP del menú azul y excluye Slow de ambos.

**Alternatives considered**:
- Mostrar menú azul también en RSVP preguntas — rechazado por spec usuario.
- Mostrar libro en modo Questions standalone — rechazado (solo RSVP).

## R3 — Exclusividad CTA vs panel

**Decision**: `resolveFlowPanelViewState(doc)` → `'cta' | 'panel' | 'hidden'` donde `panel` si `doc.shared.modeRecommendation` válido y no `userOverride`; `cta` si hay doc sin recomendación o sin upload; `hidden` si override.

**Rationale**: Una función pura evita race entre botón y panel en DOM.

**Alternatives considered**:
- Ocultar CTA con CSS cuando panel visible — rechazado: ambos en DOM confunde tests y a11y.

## R4 — Progreso visual

**Decision**: Stepper horizontal con pills (`completed` | `current` | `upcoming`); eliminar barra duplicada inferior.

**Rationale**: La captura muestra cápsula huérfana + barra llena sin semántica; stepper comunica pasos del `primaryFlow` directamente.

**Alternatives considered**:
- Barra % única — rechazado: pocos pasos (2–4) se leen mejor como stepper.
- Sin progreso en intro — rechazado: usuario necesita ver el camino completo desde el inicio.

## R5 — «Why this flow?»

**Decision**: `<details class="flow-why">` o botón que togglea `aria-expanded` panel inline bajo el encabezado; contenido = `genreReasoning || reasoning`.

**Rationale**: Sin modal ni librería; accesible, funciona offline, coherente con collapsibles del create screen.

**Alternatives considered**:
- Tooltip `title` solo — rechazado: texto largo ilegible.
- Modal — rechazado: fricción innecesaria.

## R6 — Desplegable tema oscuro

**Decision**: `select.flow-override-select` con `color-scheme: dark`, fondo `--surface-elevated`, `option` con `background` explícito, `:focus-visible` ring.

**Rationale**: Nativos `<select>` ignoran tema si no se fuerza `color-scheme` y estilos de `option`.

**Alternatives considered**:
- Custom dropdown component — rechazado: YAGNI para 4 opciones.

## R7 — Estética (frontend-design)

**Decision**: Panel como «editorial card» — tipografía display en título de flujo, acento cyan existente, borde sutil gradient, micro-animación `fade-in` al montar; sin fuentes genéricas nuevas (heredar stack del app).

**Rationale**: Diferenciación sin romper cohesión del tema oscuro actual.

**Alternatives considered**:
- Purple gradient slop — rechazado por skill frontend-design.
