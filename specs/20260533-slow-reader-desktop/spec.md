# Feature Specification: Slow Mode Reader Desktop UX

**Feature Branch**: `20260533-slow-reader-desktop`

**Created**: 2026-06-09

**Status**: Draft

**Input**: Diagnóstico UX del lector Slow Mode: layout móvil dentro de contenedor 840px, texto plano sin markdown, toolbar incompleta, chrome global visible, sidebar estrecha, interacciones touch-first.

**Related**: `specs/20260528-slow-mode` (Fase 1 reader), `specs/20260532-markdown-canonical` (texto fuente markdown).

## Clarifications

### Session 2026-06-09

- Q: ¿Alcance v1? → A: Rediseño de **presentación y layout** del lector (`screenSlowReader`). Sin cambiar modelo de anotaciones, paginación por viewport, ni contratos IA anti-spoiler.
- Q: ¿Móvil? → A: Mantener patrones móvil existentes (swipe, bottom sheet) con `@media`; desktop es el foco del rediseño.
- Q: ¿Markdown en lector? → A: Sí — renderizar `normalizedFormat: "markdown"` con estilos `md-content`; offsets de anotación siguen en **texto fuente plano** (coordenadas del scope string).
- Q: ¿Focus mode? → A: Activar automáticamente al entrar en Fase 1; el usuario puede salir manualmente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lectura cómoda en pantalla ancha (Priority: P1)

Como estudiante en ordenador, quiero que el texto ocupe un ancho de lectura cómodo sin quedar encajonado en una card de 840px, para leer material académico sin sensación de app móvil estirada.

**Why this priority**: Es la queja principal del diagnóstico; bloquea la adopción en desktop.

**Independent Test**: Abrir Slow Mode reader en viewport 1920×1080; la columna de texto debe tener ≥ 60ch útiles con sidebar cerrada y el layout debe usar ancho útil del viewport (no centrado en card estrecha).

**Acceptance Scenarios**:

1. **Given** viewport ≥ 1024px y sidebar cerrada, **When** abro el lector, **Then** la columna de lectura tiene entre 60ch y 75ch de ancho útil y no está limitada por `--content-max: 840px`.
2. **Given** viewport ≥ 1024px, **When** abro el sidebar, **Then** el panel tiene ancho fijo 300–380px y el texto no queda por debajo de 52ch.
3. **Given** viewport &lt; 768px, **When** abro el lector, **Then** se mantiene layout móvil actual (drawer + tab ☰) sin regresión.

---

### User Story 2 - Texto formateado, no terminal (Priority: P1)

Como estudiante, quiero ver encabezados, listas y énfasis del material normalizado, para seguir la estructura del documento mientras leo.

**Why this priority**: El material ya es markdown; mostrarlo como `textContent` degrada la lectura académica.

**Independent Test**: Subir material con `# Título` y listas; el lector muestra HTML tipografiado, no literales `#` y `-`.

**Acceptance Scenarios**:

1. **Given** sesión con `normalizedFormat: "markdown"`, **When** renderizo una página, **Then** el contenido usa clase `md-content` con encabezados y párrafos visibles.
2. **Given** texto renderizado como HTML, **When** selecciono un fragmento y anoto, **Then** los offsets `charStart`/`charEnd` coinciden con el string fuente del scope (misma semántica que hoy).
3. **Given** sesión legacy `html_min`, **When** abro lector tras migración, **Then** se muestra markdown migrado o fallback legible sin romper offsets.

---

### User Story 3 - Toolbar y navegación de escritorio (Priority: P2)

Como estudiante en PC, quiero indicador de página, atajos de teclado y control de interlineado, para navegar sin depender de swipe o botones minúsculos.

**Accept Test**: Pulsar ←/→ cambia página; se muestra "página 3 de 47"; controles A+/A− e interlineado persisten en sesión.

**Acceptance Scenarios**:

1. **Given** lector activo, **When** pulso ArrowLeft/ArrowRight (sin foco en input), **Then** navego página anterior/siguiente.
2. **Given** lector activo, **When** miro la toolbar, **Then** veo indicador `N / total` además de la barra de progreso.
3. **Given** cambio interlineado, **When** recargo sesión, **Then** `slow.typography.lineHeight` persiste y la paginación se recalcula.

---

### User Story 4 - Modo lectura sin distracciones (Priority: P2)

Como estudiante concentrado, quiero que al entrar en lectura se oculte el chrome ajeno (guide, API key, nueva sesión) y el sidebar no robe espacio por defecto en desktop.

**Acceptance Scenarios**:

1. **Given** entro en Fase 1 por primera vez en la sesión, **When** se muestra el lector, **Then** focus mode está activo y chrome global de la app está oculto.
2. **Given** viewport ≥ 1024px y sin preferencia guardada, **When** abro lector, **Then** sidebar inicia **cerrada** (tab visible).
3. **Given** salgo del lector, **When** vuelvo a otra pantalla, **Then** chrome global reaparece.

---

### User Story 5 - Panel lateral usable (Priority: P3)

Como estudiante, quiero un sidebar legible en desktop con textarea para IA y tipografía cómoda.

**Acceptance Scenarios**:

1. **Given** sidebar abierta en desktop, **When** leo anotaciones y diccionario, **Then** texto base ≥ 14px (no 0.82rem en ítems críticos).
2. **Given** sección IA, **When** escribo pregunta larga, **Then** uso textarea multilínea (Enter envía, Shift+Enter nueva línea opcional o documentado).

---

### Edge Cases

- Ventana redimensionada: paginación se recalcula (comportamiento actual); no debe perder página actual.
- Sidebar abierta + ventana estrecha (&lt; 900px): sidebar pasa a overlay/drawer.
- Selección que cruza nodos HTML (negrita, enlace): offset debe mapear al plain text del scope.
- Margen de anotaciones con HTML renderizado: marcas Y deben seguir alineadas (Range API sobre texto plano o walker).
- Focus mode + usuario abre sidebar: sidebar visible; focus oculta toolbar excepto salida de focus.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE sacar `#screenSlowReader` del layout de card centrada (`--content-max`) en viewport ≥ 1024px (breakout full-bleed o reubicación DOM).
- **FR-002**: El sistema DEBE aplicar clase `body.slow-reader-active` mientras `screenSlowReader` está visible y ocultar chrome global no esencial (guide toggle, corner links).
- **FR-003**: El sistema DEBE usar grid desktop `texto | margen | sidebar` con sidebar de ancho fijo 300–380px (no `20vw` dentro de contenedor 840px).
- **FR-004**: Por defecto en viewport ≥ 1024px sin `slow.sidebarOpen` persistido, el sidebar DEBE iniciar cerrado.
- **FR-005**: El sistema DEBE renderizar páginas markdown con `renderMarkdown` / `md-content` cuando `normalizedFormat === "markdown"`.
- **FR-006**: El sistema DEBE preservar contrato de offsets de anotación en coordenadas del string scope (plain source text).
- **FR-007**: El sistema DEBE mostrar indicador de página `current+1 / total` en toolbar.
- **FR-008**: El sistema DEBE soportar navegación ←/→ con teclado cuando el foco no está en input/textarea.
- **FR-009**: El sistema DEBE exponer control de interlineado además de A+/A− y persistir en `slow.typography`.
- **FR-010**: El sistema DEBE activar focus mode al `initSlowReader` (Fase 1) con opción de desactivar manualmente.
- **FR-011**: En viewport ≥ 1024px, respuestas IA DEBEN mostrarse en modal centrado; en &lt; 768px mantener bottom sheet con swipe.
- **FR-012**: El sistema DEBE integrar columna de margen en el grid (no `position: absolute; right: -36px` que clippea con `overflow-x: hidden`).
- **FR-013**: El sistema NO DEBE cambiar contratos anti-spoiler IA ni estructura de `slow.annotations[]`.

### Key Entities

- **`slow.typography`**: `{ fontSizePx, lineHeight, fontFamily }` — ampliado en UI, sin nuevos campos obligatorios.
- **`slow.sidebarOpen`**: boolean persistido; default derivado de viewport en primera visita.
- **`slow.readerLayout`**: (opcional v1) `{ focusMode: boolean }` — puede reutilizar clase DOM + aria-pressed existente sin migración JSON.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En viewport 1920px, columna de lectura ≥ 60ch con sidebar cerrada (medido en DevTools).
- **SC-002**: Material con 3 niveles de heading se distingue visualmente sin símbolos markdown crudos en pantalla.
- **SC-003**: Crear anotación tras selección en texto renderizado produce offset correcto en ≥ 95% de selecciones de prueba manual (quickstart).
- **SC-004**: Usuario navega 10 páginas con solo teclado sin usar ratón.
- **SC-005**: Chrome global (guide, +, API key) no visible durante lectura activa.

## Assumptions

- `markdown-canonical` completado o en curso: el texto fuente será markdown en sesiones nuevas.
- Paginación viewport-based se mantiene; no se introduce scroll infinito en v1.
- Sin nuevas dependencias npm; reutilizar `marked` vía `markdown.js` existente.
- Tests en `cursor-tests/` con jsdom o eval de funciones puras donde sea posible; QA manual en quickstart para layout.
