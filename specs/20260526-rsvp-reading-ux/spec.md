# Feature Specification: RSVP Reading UX (Focal Point + Stable Typography)

**Feature Branch**: `20260526-rsvp-reading-ux`

**Created**: 2026-05-26

**Status**: Draft

**Input**: User feedback: el punto focal del medio funciona fatal; adaptar el texto al cuadro en cada flash hace variar el tamaño de fuente dentro del mismo bloque y es muy difícil de seguir.

## Clarifications

### Session 2026-05-26

- Q: ¿Alcance v1 del punto focal? → A: Centrado óptico estable en pantalla para chunks de texto (1–10 palabras/flash). La letra resaltada debe coincidir con el **centro horizontal del contenedor**, no con un índice fijo del string completo.
- Q: ¿Tamaño de fuente? → A: **Fijo durante toda la sesión RSVP** (y al cambiar WPF solo recalcular una vez al reabrir chunk stream, no en cada flash). El resize del cuadro puede recalcular, pero **dos flashes consecutivos del mismo bloque no deben cambiar px** si el contenedor no cambió.
- Q: ¿ORP clásico por palabra? → A: Para `wordsPerFlash === 1`, mantener ORP por palabra. Para `wordsPerFlash > 1`, anclar en la **palabra central** del chunk (ORP de esa palabra únicamente).
- Q: ¿LaTeX? → A: Chunks matemáticos: sin ORP rojo; tamaño fijo relativo al texto (p. ej. 85% del `fontSizePx` de sesión), sin binary-search por chunk.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lectura con tamaño de fuente constante (Priority: P1)

Como estudiante leyendo un bloque en RSVP, quiero que el tamaño de fuente sea el mismo en cada flash del bloque, para no tener que re-adaptar la vista en cada palabra.

**Why this priority**: Es la queja principal; afecta directamente la legibilidad a 500–1000 WPM.

**Independent Test**: Abrir RSVP con WPF=4 en un bloque largo; capturar o observar que `font-size` en `#rsvp-word-display` no cambia entre flashes consecutivos (salvo resize manual del cuadro).

**Acceptance Scenarios**:

1. **Given** RSVP activo con contenedor de tamaño fijo, **When** avanzan 10 flashes de texto del mismo bloque, **Then** el `font-size` computado permanece idéntico en todos.
2. **Given** cambio de WPF en mitad de sesión, **When** se reconstruyen chunks, **Then** se recalcula tamaño **una vez** para la nueva WPF, no por flash individual.
3. **Given** usuario redimensiona el cuadro RSVP, **When** suelta el resize, **Then** se recalcula tamaño una vez y sigue constante entre flashes hasta el próximo resize.

---

### User Story 2 - Punto focal centrado en pantalla (Priority: P1)

Como estudiante, quiero que la letra resaltada (punto focal) esté siempre en el centro horizontal del cuadro de lectura, para fijar la mirada sin buscar la letra roja.

**Why this priority**: El ORP actual usa índice global del chunk multi-palabra → la 'j' queda desplazada respecto al centro visual.

**Independent Test**: WPF=4, texto en español con palabra larga en el medio; la letra roja debe quedar en el centro del recuadro, no desplazada a la izquierda.

**Acceptance Scenarios**:

1. **Given** chunk de 4 palabras, **When** se muestra el flash, **Then** la letra ORP de la palabra central está alineada al centro horizontal del `.rsvp-container` (tolerancia ≤ 4px).
2. **Given** WPF=1, **When** se muestra una palabra, **Then** ORP de esa palabra queda centrada igual que hoy pero con corrección de offset (translate).
3. **Given** chunk matemático, **When** se renderiza, **Then** no hay letra ORP roja; el contenido está centrado sin parpadeo de color.

---

### User Story 3 - Sin regresión en controles RSVP (Priority: P2)

Como estudiante, quiero seguir usando WPM, WPF, pause/play, skip y persistencia de tamaño de cuadro sin cambios de comportamiento.

**Acceptance Scenarios**:

1. **Given** defaults guardados en localStorage, **When** abro RSVP, **Then** WPM/WPF/cuadro se restauran como hoy.
2. **Given** 1000 WPM y WPF=4, **When** leo hasta preguntas, **Then** el temporizador y skip funcionan sin drift adicional por el nuevo layout.

---

### Edge Cases

- Palabras muy cortas (1 letra) o solo puntuación: ORP índice 0; centrado sigue aplicando.
- Chunks con comillas, dos puntos, guiones: ORP usa solo letras para posición, render conserva puntuación.
- Contenedor muy pequeño: tamaño mínimo legible (p. ej. 16px) con overflow oculto, sin reducir por flash.
- Texto RTL / mixto: fuera de alcance v1 (solo LTR como hoy).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE calcular `fontSizePx` de sesión RSVP una vez al iniciar o al cambiar WPF/contenedor, usando el peor caso de ancho para `wordsPerFlash` (cadena probe o palabras más largas del bloque), no el contenido de cada flash.
- **FR-002**: Entre flashes consecutivos del mismo bloque, el sistema NO DEBE invocar binary-search de ajuste por chunk salvo resize del contenedor.
- **FR-003**: Para chunks de texto multi-palabra, el ORP DEBE calcularse solo sobre la palabra ancla (central del chunk).
- **FR-004**: El sistema DEBE aplicar offset horizontal (`transform: translateX`) para colocar el glifo ORP en el centro del contenedor.
- **FR-005**: Chunks matemáticos DEBEN usar `fontSizePx * factor` fijo sin ORP.
- **FR-006**: Cambios solo en `src/js/rsvp.js`, `src/css/main.css` y tests RSVP existentes; sin tocar generación LLM ni session JSON exportado.

### Non-Functional Requirements

- **NFR-001**: Sin frameworks; sin backend.
- **NFR-002**: Recalcular layout ORP debe costar < 5ms por flash en desktop (una medida `getBoundingClientRect`).
- **NFR-003**: Compatible con viewport móvil (cuadro 90vw) sin saltos visuales al cambiar flash.

### Key Entities

- **RsvpTypographyProfile**: `{ fontSizePx, containerWidth, containerHeight, wordsPerFlash, computedAt }`
- **RsvpTextFlash**: chunk con palabras, palabra ancla, índice ORP local, offset de centrado

## Success Criteria

- **SC-001**: En prueba manual de 30 flashes WPF=4, 0 cambios de `font-size` sin resize.
- **SC-002**: En captura de pantalla, letra ORP dentro del 50% ± 2% del ancho del contenedor.
- **SC-003**: Usuario reporta seguimiento más fácil vs. build anterior (validación subjetiva en quickstart).
