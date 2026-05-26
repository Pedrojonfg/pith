# Feature Specification: Zero-Latency Block Transitions (Background Prefetch)

**Feature Branch**: `20260527-zero-latency-blocks`

**Created**: 2026-05-27

**Status**: Draft

**Input**: Eliminar la latencia entre bloques generando el bloque N+1 en segundo plano mientras el estudiante lee/responde el bloque N. Al terminar un bloque: flujo rápido "Skip" (sin cambios, 0s de espera si el prefetch está listo) vs "Make changes" (dudas, ajuste de preguntas, regeneración). Eliminar comentarios/dudas en la pantalla de transición; usar la sidebar. Opcional futuro: ajuste diferencial del número de preguntas sin regenerar el bloque entero.

## Clarifications

### Session 2026-05-27

- Q: Si el estudiante elige el camino rápido (Skip) pero el prefetch de N+1 aún no ha terminado, ¿qué ocurre? → A: El botón principal del camino rápido permanece **deshabilitado** hasta `ready`; indicador visible (barra/punto de prefetch). Sin clic hasta que la generación en segundo plano termine.
- Q: En Make changes, si solo cambia `n_test` / `n_socratic` respecto al bloque prefetched, ¿qué regenera v1? → A: **Regen parcial**: conservar `explanation` (texto RSVP del bloque) del prefetch; **regenerar solo las preguntas** en cantidad/tipo solicitados (regen completa del subconjunto `questions`, no del cuerpo del bloque).
- Q: ¿Qué hacer con la tarjeta inline de respuesta del guía al terminar RSVP? → A: **Eliminar** la tarjeta inline; las respuestas del guía viven solo en el historial de la sidebar.
- Q: ¿Qué se muestra por defecto en la pantalla de transición (antes de Make changes)? → A: **Dos botones** (CTA principal deshabilitado hasta `ready` + secundario Adjust) **+ diccionario colapsado** + indicador de prefetch en la misma pantalla.
- Q: Etiquetas del CTA principal y del camino de ajuste → A: Principal **Siguiente bloque** · Secundario **Ajustar siguiente bloque**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prefetch durante el estudio del bloque actual (Priority: P1)

Como estudiante en el bloque N, quiero que el bloque N+1 se genere en segundo plano mientras leo en RSVP y respondo preguntas, para que al terminar el bloque N la espera sea mínima o nula.

**Why this priority**: Es el objetivo central del feature; sin prefetch oportuno no hay latencia cero.

**Independent Test**: Iniciar bloque 2 con sesión de ≥3 bloques; verificar (indicador de prefetch + red) que la generación de bloque 3 arranca al entrar en bloque 2, antes de abrir la pantalla de transición.

**Acceptance Scenarios**:

1. **Given** sesión con bloques pendientes de generar, **When** entro al bloque N (RSVP), **Then** el sistema dispara prefetch del bloque N+1 con la configuración por defecto (mismo número de preguntas que el perfil del bloque N+1).
2. **Given** prefetch de N+1 en curso, **When** completo preguntas del bloque N, **Then** no se inicia una segunda generación idéntica salvo cambio de configuración.
3. **Given** prefetch de N+1 completado con éxito, **When** elijo el camino rápido al siguiente bloque, **Then** paso al bloque N+1 sin llamada API adicional de generación completa.

---

### User Story 2 - Transición rápida "Skip" (Priority: P1)

Como estudiante que no quiere cambiar nada antes del siguiente bloque (~99% de casos), quiero un botón prominente que me lleve al siguiente bloque al instante si ya está generado.

**Why this priority**: Define la UX diaria; debe ser el camino por defecto.

**Independent Test**: Completar bloque 1 con red normal; en transición pulsar Skip/Continue rápido; medir tiempo hasta primer flash RSVP del bloque 2 (objetivo: &lt;500ms percibido si prefetch ready).

**Acceptance Scenarios**:

1. **Given** prefetch listo y config sin cambios, **When** pulso el CTA principal (Siguiente bloque), **Then** cierro la transición y abro RSVP del bloque N+1 sin espera de generación post-clic.
2. **Given** la transición por defecto, **When** la abro, **Then** veo CTA principal + acción secundaria Adjust, diccionario en sección colapsada, e indicador de prefetch; no hay textarea de dudas ni controles de preguntas hasta elegir Adjust.
3. **Given** prefetch aún en curso al abrir la transición, **When** veo el camino rápido, **Then** el botón Skip/Next está deshabilitado y el indicador muestra generación en curso; al pasar a `ready`, el botón se habilita.
4. **Given** prefetch `ready`, **When** pulso Skip, **Then** la transición cierra y el RSVP del bloque N+1 abre en &lt;500ms percibidos (sin espera post-clic).

---

### User Story 3 - Camino "Make changes" (Priority: P2)

Como estudiante que quiere ajustar el siguiente bloque, quiero abrir un flujo explícito (equivalente al actual) para cambiar número de preguntas test/socráticas y, si aplica, forzar regeneración.

**Why this priority**: Caso minoritario pero necesario; no debe bloquear el camino rápido.

**Independent Test**: En transición elegir Make changes; subir `n_test`; verificar regeneración con nueva `configKey` y bloque coherente.

**Acceptance Scenarios**:

1. **Given** pantalla de transición, **When** elijo Make changes, **Then** veo controles de preguntas (y regeneración si la config cambia) como hoy.
2. **Given** bloque N+1 prefetched con `explanation` válida, **When** en Make changes cambio solo `n_test` o `n_socratic`, **Then** el sistema conserva `explanation` y `title` y regenera únicamente el array `questions` acorde a la nueva config.
3. **Given** Make changes sin cambiar `n_test` ni `n_socratic` respecto al prefetch, **When** confirmo, **Then** reutilizo el bloque prefetched íntegro (explicación + preguntas).
4. **Given** cambio de `explanation_profile` o `gap_focus` (afecta la explicación), **When** confirmo en Make changes, **Then** el sistema regenera el bloque completo (explicación + preguntas).

---

### User Story 4 - Dudas solo en sidebar (Priority: P2)

Como estudiante con dudas durante el estudio, quiero usar la sidebar/guía en lugar de campos de texto en RSVP o en la transición entre bloques.

**Acceptance Scenarios**:

1. **Given** transición entre bloques (camino rápido), **When** la veo, **Then** no hay textarea "preguntas al guía" ni "comentarios antes del siguiente bloque".
2. **Given** bloque en curso, **When** tengo una duda, **Then** la escribo en la sidebar; no hay flujo obligatorio de comentario en RSVP al terminar la lectura.
3. **Given** el guía respondió a un comentario en sidebar, **When** termino el RSVP del bloque, **Then** no aparece tarjeta inline de respuesta; el usuario consulta el historial en la sidebar.
4. **Given** comentario pendiente procesado en background (`triggerCommentReply`), **When** avanzo en el estudio, **Then** la respuesta se añade al historial de la sidebar sin interrumpir RSVP ni transición.

---

### Edge Cases

- Prefetch falla (API, timeout): camino rápido muestra error y ofrece reintento o Make changes.
- Make changes con solo cambio de preguntas pero prefetch sin `explanation`: degradar a regen completa del bloque.
- Usuario cambia assessment/perfil que altera `configKey` durante estudio: invalidar prefetch stale.
- Último bloque de la sesión: no prefetch; flujo de cierre sin transición.
- Bloque N+1 ya importado/generado en confirm: no regenerar en prefetch.
- Offline / sin API key: prefetch no arranca; transición degrada con mensaje claro.
- Usuario acelera mucho (RSVP skip): puede llegar a transición antes de que termine prefetch; el botón rápido queda deshabilitado con indicador hasta `ready` (sin segundo flujo de espera post-clic).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Al iniciar estudio del bloque N (entrada a RSVP), el sistema DEBE disparar prefetch del bloque N+1 si existe y aún no está generado con la `configKey` vigente.
- **FR-002**: La pantalla de transición tras el bloque N DEBE mostrar por defecto: CTA principal (camino rápido), acción secundaria Adjust (Make changes), diccionario **colapsado** (`<details>` o equivalente), e indicador de estado de prefetch en la misma vista.
- **FR-002a**: Los controles de ajuste de preguntas y regeneración solo se revelan tras elegir **Ajustar siguiente bloque** (no en la vista por defecto).
- **FR-002b**: El CTA del camino rápido DEBE etiquetarse **Siguiente bloque** (no "Skip"); el secundario **Ajustar siguiente bloque**.
- **FR-003**: El camino rápido DEBE usar el bloque prefetched cuando `configKey` coincide; NO DEBE exigir comentarios ni textarea de dudas.
- **FR-003a**: En el camino rápido, el CTA principal DEBE estar **deshabilitado** mientras `prefetch.status !== 'ready'` para la `configKey` esperada; DEBE mostrarse indicador de progreso (barra o punto) sin permitir clic prematuro.
- **FR-004**: El camino de ajuste DEBE permitir modificar `n_test` y `n_socratic` del bloque N+1 y regenerar cuando la config difiera del prefetch.
- **FR-005**: Los comentarios/dudas entre bloques y en RSVP finish NO DEBEN usar textarea dedicado; la sidebar es el canal único para dudas durante el estudio.
- **FR-005a**: Al terminar RSVP, el sistema NO DEBE mostrar tarjeta inline de respuesta del guía (`ensureGuideResponseCardVisible` y equivalentes); las respuestas solo en historial de sidebar.
- **FR-006**: El indicador de prefetch (p. ej. punto en barra de progreso) DEBE reflejar idle / generating / ready / failed sin bloquear la lectura.
- **FR-007**: Si en Make changes solo cambian `n_test` y/o `n_socratic` y existe prefetch con `explanation` válida, el sistema DEBE conservar `explanation` (y metadatos de bloque no pedagógicos) y DEBE regenerar solo `questions` mediante llamada API acotada (no regen del cuerpo RSVP).
- **FR-008**: Si cambian factores que afectan la explicación (`explanation_profile`, `gap_focus`, o no hay `explanation` en prefetch), el sistema DEBE regenerar el bloque completo.

### Key Entities

- **Prefetch slot**: `{ blockIndex, status, configKey, data, error }` — una generación en vuelo o lista para el siguiente índice.
- **Block config key**: firma de `n_test`, `n_socratic`, `explanation_profile`, `gap_focus` usada para cachear prefetch.
- **Transition choice**: `fast` | `adjust` — elección del usuario al cerrar un bloque.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En ≥90% de transiciones en red estable, el prefetch alcanza `ready` antes de que el usuario termine el bloque; al pulsar Skip, el primer flash RSVP del bloque siguiente aparece en &lt;1s (sin espera de generación post-clic).
- **SC-002**: En camino rápido, 0 campos de texto obligatorios entre bloques.
- **SC-003**: No se duplica la llamada API de generación completa cuando prefetch ready y config sin cambios.
- **SC-004**: Regresión: estudio bloque a bloque, export .md, y sidebar guía siguen funcionando.

## Assumptions

- Ya existe infraestructura de prefetch (`triggerPrefetch`, `getPrefetchedBlock`, `configKey` con perfil de assessment); este feature refactoriza UX y acota el camino rápido.
- La pantalla `betweenBlocks` en `index.html` está obsoleta; la transición canónica es el overlay dinámico (`transitionOverlay`).
- Regen parcial (solo `questions`) aplica cuando el prefetch ya incluye `explanation`; requiere contrato/prompt API que acepte explicación fija + nueva cuenta de preguntas.
- Un solo prefetch adelantado (N+1) es suficiente para v1.
