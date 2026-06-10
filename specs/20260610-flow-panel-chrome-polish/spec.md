# Feature Specification: Flow Panel & Study Chrome Polish

**Feature Branch**: `20260610-flow-panel-chrome-polish`

**Created**: 2026-06-10

**Status**: Draft

**Input**: Corregir visibilidad de FABs flotantes (libro rojo, menú guía) y pulir el panel de recomendación de flujo: exclusividad CTA/panel, contraste del desplegable, enlace «Why this flow?» funcional, barra de progreso coherente. Directrices estéticas: interfaces distintivas, legibles en tema oscuro, sin controles muertos.

**Depends on**: `20260609-flow-recommendation` (backend `modeRecommendation` ya implementado)

## User Scenarios & Testing

### User Story 1 — Chrome flotante solo donde aporta (Priority: P1)

Como estudiante, quiero que los botones flotantes (releer bloque y guía/diccionario) aparezcan únicamente en las fases de estudio donde son útiles, para no distraerme en la pantalla principal ni en Slow Mode.

**Why this priority**: Los FABs visibles en pantallas incorrectas son el fallo más visible y rompen la confianza en la app.

**Independent Test**: Navegar por todas las pantallas principales y modos; verificar ausencia de FABs fuera de contexto sin subir material.

**Acceptance Scenarios**:

1. **Given** pantalla de selección de modo o configuración de sesión, **When** el usuario observa la interfaz, **Then** no ve el botón rojo de libro ni el botón azul de menú.
2. **Given** sesión RSVP en fase de lectura rápida (bloques), **When** el usuario no está en preguntas, **Then** no ve el botón rojo de libro.
3. **Given** sesión RSVP en fase de preguntas (test o socrático), **When** hay texto de bloque disponible, **Then** ve el botón rojo de libro y puede abrir el panel de releer.
4. **Given** sesión en modo Cloze o Questions durante preguntas o diccionario de conceptos del bloque, **When** el usuario está en test, socrático o entre bloques con diccionario, **Then** ve el botón azul de menú/guía.
5. **Given** sesión en modo RSVP, Slow o Cloze fuera de fases de preguntas/diccionario, **When** el usuario navega, **Then** no ve el botón azul de menú.
6. **Given** sesión Slow Mode (cualquier fase), **When** el usuario estudia, **Then** nunca ve el botón azul de menú ni el rojo de libro.

---

### User Story 2 — Un solo camino para recomendar flujo (Priority: P1)

Como estudiante que ya subió material, quiero ver o bien el botón para recomendar flujo o bien el panel con el flujo sugerido, nunca ambos a la vez.

**Why this priority**: Mostrar CTA y panel juntos confunde y sugiere que hay dos acciones distintas para lo mismo.

**Independent Test**: Subir documento sin recomendación persistida → solo CTA; tras cálculo → solo panel; sin documento → solo CTA.

**Acceptance Scenarios**:

1. **Given** usuario sin documento cargado ni `modeRecommendation`, **When** abre la pantalla de modos, **Then** ve «Recommend my study flow» y no ve el panel de flujo.
2. **Given** documento subido y `modeRecommendation` calculada, **When** abre la pantalla de modos, **Then** ve el panel de flujo y no ve el botón «Recommend my study flow».
3. **Given** recomendación con `userOverride === true`, **When** vuelve a la pantalla de modos, **Then** no ve ni CTA ni panel intro (comportamiento heredado de flow-recommendation).

---

### User Story 3 — Panel de flujo usable y legible (Priority: P2)

Como estudiante con flujo recomendado, quiero entender el camino sugerido, saltar a otro modo con contraste legible, saber por qué se recomienda y ver mi progreso de forma clara.

**Why this priority**: El panel actual tiene controles rotos (dropdown ilegible, enlace muerto, progreso confuso).

**Independent Test**: Con recomendación mock, interactuar con cada control del panel y validar feedback visual.

**Acceptance Scenarios**:

1. **Given** panel de flujo visible, **When** el usuario abre «Go directly to…», **Then** las opciones tienen contraste suficiente (texto y fondo distinguibles en tema oscuro; ratio mínimo 4.5:1).
2. **Given** panel con `genreReasoning` o `reasoning`, **When** el usuario activa «Why this flow?», **Then** ve una explicación (popover, drawer o details expandible) sin navegar fuera de la pantalla.
3. **Given** flujo sin pasos completados, **When** se muestra progreso, **Then** una sola barra o stepper muestra pasos pendientes (sin elementos duplicados o huérfanos).
4. **Given** uno o más pasos completados, **When** se muestra progreso, **Then** pasos completados, actual y pendientes son distinguibles y el CTA principal refleja el siguiente paso.
5. **Given** `quickFlow` más corto que `primaryFlow`, **When** el usuario tiene poco tiempo, **Then** ve enlace secundario legible hacia el flujo rápido.

---

### Edge Cases

- Usuario offline: panel y CTA respetan restricciones offline existentes; FABs de guía ocultos si ya aplica `isOfflineMode`.
- Sesión reanudada con progreso parcial: panel en estado «progreso», no CTA de upload.
- Documento subido pero recomendación aún calculándose: spinner o estado intermedio; no mostrar CTA ni panel roto.
- Modo Questions sin bloque previo (bloque 0): diccionario entre bloques no fuerza FAB azul.
- Override select con un solo modo disponible: deshabilitado o oculto con mensaje claro.

## Requirements

### Functional Requirements

- **FR-001**: El botón flotante de releer bloque (libro rojo) MUST mostrarse solo en modo RSVP durante pantallas de preguntas (test y socrático) cuando hay contenido de bloque disponible.
- **FR-002**: El botón flotante de guía (menú azul) MUST mostrarse solo en modos Cloze y Questions durante fases de preguntas (test, socrático) y diccionario de conceptos (entre bloques con conceptos).
- **FR-003**: Ambos FABs MUST permanecer ocultos en pantalla principal (selección de modo, configuración, biblioteca), Slow Mode, assessment inicial, y cualquier pantalla no listada en FR-001/FR-002.
- **FR-004**: El CTA «Recommend my study flow» y el panel de recomendación MUST ser mutuamente excluyentes según existencia de `session.shared.modeRecommendation` válida para el documento activo.
- **FR-005**: El desplegable «Go directly to…» MUST usar estilos de tema oscuro con contraste accesible en estado cerrado, abierto y foco.
- **FR-006**: «Why this flow?» MUST revelar `pedagogicalMeta.genreReasoning` o, en su defecto, `modeRecommendation.reasoning`, de forma accesible por teclado.
- **FR-007**: La visualización de progreso MUST usar un único componente coherente (stepper o barra segmentada) alineado con `primaryFlow`, `completedSteps` y `currentStepIndex`; sin elementos visuales redundantes.
- **FR-008**: El panel MUST reutilizar datos existentes de `20260609-flow-recommendation` sin nuevas llamadas LLM.
- **FR-009**: Copy de usuario en inglés en la UI del panel y CTA (coherente con el resto de la app).

### Key Entities

- **ChromeVisibilityContext**: Pantalla activa, modo de estudio normalizado, fase (lectura / preguntas / diccionario), flags offline y assessment.
- **FlowPanelViewState**: `hidden` | `cta_upload` | `intro` | `progress` — derivado de `modeRecommendation` y documento activo.
- **ModeRecommendation**: Entidad existente en `session.shared`; sin cambios de esquema salvo necesidad de campos UI ya presentes.

## Success Criteria

### Measurable Outcomes

- **SC-001**: En recorrido manual de 12 pantallas/modos definidos en quickstart, 0 apariciones indebidas de FABs.
- **SC-002**: 100% de los estados documento/recomendación muestran exactamente un bloque (CTA o panel, nunca ambos).
- **SC-003**: Opciones del desplegable «Go directly to…» pasan verificación de contraste ≥ 4.5:1 en tema oscuro.
- **SC-004**: «Why this flow?» muestra texto explicativo en el 100% de los casos con recomendación válida.
- **SC-005**: Barra/stepper de progreso: un solo elemento visual principal; usuarios de prueba identifican el siguiente paso en &lt; 3 s (QA subjetivo).
- **SC-006**: Tests automatizados de regresión chrome + panel pasan en CI local (`cursor-tests`).

## Assumptions

- El backend de recomendación (`analyzer`, `recommender`, `tracker`, `session-store`) no requiere cambios funcionales.
- La UI del panel fue retirada temporalmente; esta feature la restaura con diseño corregido.
- «Modo rápido» en el contexto del libro rojo = flujo RSVP con bloques y fase de preguntas.
- El botón azul abre la guía lateral existente; el diccionario de conceptos puede ser inline (entre bloques) o vía guía según implementación actual.
- Diseño visual sigue el tema oscuro existente con refinamiento tipográfico y espaciado (frontend-design: intencional, no genérico).
