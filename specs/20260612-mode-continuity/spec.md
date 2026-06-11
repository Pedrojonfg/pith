# Feature Specification: Mode Continuity

**Feature Branch**: `20260612-mode-continuity`

**Created**: 2026-06-11

**Status**: Draft

**Input**: User description: "Mejorar la integración entre la recomendación de flujo y los diversos modos de estudio, y entre los propios modos. Al subir un archivo para recomendación y elegir un modo, el archivo debe estar ya cargado. Al terminar un modo (p. ej. RSVP) y continuar con otro (p. ej. Cloze), conservar el markdown y el trabajo previo (inventario de conceptos, etc.) sin empezar desde cero. Los modos no deben ser silos aislados: evitar re-subir archivos y repetir procesos ya hechos; en Cloze tener en cuenta los fallos de modos anteriores."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Material listo al elegir modo tras recomendación (Priority: P1)

Un estudiante sube un PDF desde el panel de recomendación de flujo, ve la sugerencia (p. ej. RSVP → Cloze → Revisión) y pulsa "Comenzar RSVP" o elige un modo del desplegable. El sistema debe llevarle directamente al punto de entrada de ese modo con el material ya asociado al documento, sin pedirle que vuelva a subir el archivo ni que repita la normalización.

**Why this priority**: Es la primera fricción que el usuario percibe hoy: sube una vez para la recomendación y otra vez para estudiar. Eliminarla desbloquea confianza en el flujo recomendado.

**Independent Test**: Subir un archivo solo por el botón de recomendación, elegir cualquier modo, y comprobar que la pantalla de creación o de sesión muestra el documento activo sin segundo upload.

**Acceptance Scenarios**:

1. **Given** un archivo subido vía recomendación y una recomendación calculada, **When** el usuario elige el primer paso del flujo recomendado, **Then** entra al modo con el mismo documento ya cargado y no ve un formulario de upload vacío.
2. **Given** un archivo subido vía recomendación, **When** el usuario elige un modo distinto vía override, **Then** el material permanece cargado y el sistema registra que eligió un modo no recomendado sin perder el documento.
3. **Given** un documento ya normalizado en sesión activa, **When** el usuario vuelve al selector de modos y elige otro modo sin subir nada nuevo, **Then** el nuevo modo usa el mismo documento sin pedir archivo.

---

### User Story 2 - Continuar al siguiente modo sin reiniciar el documento (Priority: P1)

Un estudiante completa RSVP (o Questions) sobre un paper y quiere seguir con Cloze según el flujo recomendado. Al pulsar "Continuar con Cloze" (o equivalente tras completar un paso), el sistema reutiliza el markdown, la jerarquía del documento y el inventario de conceptos ya generado, y solo ejecuta lo que falta para ese modo (p. ej. generación de ítems cloze), no vuelve a inventariar conceptos desde cero.

**Why this priority**: Es el núcleo del anti-silo: el valor acumulado en un modo debe transferirse al siguiente.

**Independent Test**: Completar RSVP con bloques generados, volver al panel de flujo, continuar con Cloze, y verificar que no se pide re-upload ni re-inventario si ya existía inventario compartido.

**Acceptance Scenarios**:

1. **Given** RSVP completado con inventario de conceptos en la capa compartida del documento, **When** el usuario inicia Cloze desde el panel de progreso del flujo, **Then** Cloze arranca con el mismo documento y reutiliza el inventario existente.
2. **Given** Slow Mode con anotaciones y conceptos en la capa compartida, **When** el usuario abre Cloze en el mismo documento, **Then** la generación de ítems prioriza esos conceptos y anotaciones sin repetir la fase de descubrimiento inicial.
3. **Given** un paso del flujo marcado como completado, **When** el usuario pulsa continuar al siguiente paso, **Then** el sistema muestra el siguiente modo ya preparado con el documento activo, no la pantalla genérica de subida.

---

### User Story 3 - Los fallos de un modo informan al siguiente (Priority: P2)

Tras RSVP o Questions, el estudiante falló varias preguntas sobre conceptos concretos. Al pasar a Cloze, los ítems generados o priorizados deben favorecer esos conceptos débiles (más ítems, mayor prioridad en estudio, o sección "refuerzo" visible), de modo que el siguiente modo corrige lagunas detectadas, no repite el material al azar.

**Why this priority**: Convierte la secuencia de modos en un circuito de aprendizaje coherente, no en cuatro experiencias independientes.

**Independent Test**: Responder incorrectamente preguntas de RSVP sobre conceptos A y B, iniciar Cloze, y comprobar que A y B aparecen con mayor peso que conceptos solo leídos sin error.

**Acceptance Scenarios**:

1. **Given** respuestas incorrectas registradas en RSVP o Questions sobre conceptos identificables, **When** el usuario inicia Cloze en el mismo documento, **Then** al menos el 60% de los primeros ítems generados o priorizados corresponden a conceptos con fallos previos.
2. **Given** ningún fallo registrado en modos previos, **When** el usuario inicia Cloze, **Then** la generación sigue el comportamiento estándar basado en inventario y jerarquía, sin penalizar ni favorecer conceptos arbitrariamente.
3. **Given** fallos en un modo y éxito posterior en revisión del mismo concepto, **When** el usuario abre Cloze después, **Then** ese concepto deja de tratarse como laguna crítica (prioridad normalizada).

---

### User Story 4 - Cambio manual de modo dentro del mismo documento (Priority: P2)

Un estudiante que ya estudió en RSVP decide abrir Slow Mode o Cloze desde el selector de modos, sin seguir el flujo recomendado. El documento, markdown y datos compartidos (jerarquía, inventario parcial, anotaciones si existen) permanecen disponibles; solo se pide confirmación si iniciar de cero sobrescribiría una sesión guardada de ese modo.

**Why this priority**: Respeta la autonomía del usuario mientras mantiene continuidad de datos.

**Independent Test**: Con documento activo y sesión RSVP en curso, elegir Slow desde el selector y verificar material disponible sin segundo upload.

**Acceptance Scenarios**:

1. **Given** un documento activo con markdown en sesión, **When** el usuario cambia de modo desde el selector, **Then** no se le pide volver a subir el archivo.
2. **Given** una sesión guardada en el modo destino, **When** el usuario entra a ese modo, **Then** puede continuar o empezar de cero con confirmación explícita; empezar de cero no borra las sesiones de otros modos ni la capa compartida salvo que el usuario lo solicite.
3. **Given** datos compartidos del documento (jerarquía, recomendación), **When** el usuario cambia de modo, **Then** esos datos siguen visibles o aplicables en el nuevo modo.

---

### User Story 5 - Progreso del flujo refleja la realidad cross-mode (Priority: P3)

El panel de recomendación muestra qué pasos están hechos y cuál es el siguiente, basándose en el estado real de cada modo del documento (no solo en el último modo visitado). Tras completar un modo, el panel ofrece una acción clara para el siguiente paso sin obligar a navegar manualmente por menús.

**Why this priority**: Cierra el ciclo UX entre recomendación y continuidad; menor urgencia que cargar material y reutilizar trabajo.

**Independent Test**: Completar Slow Mode, abrir panel de flujo, ver paso marcado completo y botón "Continuar con Cloze" funcional.

**Acceptance Scenarios**:

1. **Given** un modo cumple su criterio de completado definido en el flujo, **When** el usuario abre el panel de recomendación, **Then** ese paso aparece como completado y el siguiente como disponible.
2. **Given** el usuario completó un paso fuera de orden (p. ej. Cloze antes que Slow), **When** consulta el panel, **Then** los pasos completados se marcan según criterios por modo, sin bloquear modos futuros.
3. **Given** todos los pasos del flujo principal completados, **When** el usuario abre el panel, **Then** ve estado de finalización y acceso a revisión si hay ítems pendientes.

---

### Edge Cases

- ¿Qué pasa si el usuario sube un archivo distinto con el mismo hash o nombre pero contenido diferente? El sistema trata cada documento por identidad de contenido; un cambio sustancial crea o activa otra sesión de documento sin mezclar datos.
- ¿Qué pasa si el inventario de conceptos no existe aún (usuario salta directo a Cloze)? Cloze ejecuta su flujo completo de descubrimiento; al terminar, los conceptos quedan en la capa compartida para modos posteriores.
- ¿Qué pasa si falla la generación de Cloze tras RSVP? El usuario puede reintentar sin perder RSVP ni el inventario; no se exige nuevo upload.
- ¿Qué pasa si el usuario elige "empezar de cero" en un modo? Solo se resetea la sesión de ese modo; la capa compartida y las sesiones de otros modos se conservan por defecto.
- ¿Qué pasa sin conexión o sin clave de modelo al auto-iniciar un modo que requiere generación? El sistema muestra el modo con material cargado y un mensaje claro de qué falta (p. ej. clave API), sin perder el documento.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST asociar un único documento de estudio a cada material normalizado subido, identificado de forma estable por su contenido.
- **FR-002**: Tras subir material para recomendación de flujo, el sistema MUST mantener ese documento como activo hasta que el usuario elija otro documento o inicie un estudio nuevo explícitamente.
- **FR-003**: Al elegir un modo desde el panel de recomendación (paso recomendado, override o flujo rápido), el sistema MUST iniciar ese modo usando el documento activo sin requerir un segundo upload del mismo material.
- **FR-004**: El sistema MUST exponer una capa compartida por documento con, como mínimo: texto normalizado, jerarquía del documento, inventario de conceptos, anotaciones del usuario, señales de evaluación (aciertos/fallos por concepto o bloque), y estado del flujo recomendado.
- **FR-005**: Al entrar a un modo con documento activo y sin sesión previa en ese modo, el sistema MUST inicializar el modo con los datos compartidos disponibles (markdown, jerarquía, inventario) en lugar de una pantalla vacía de subida.
- **FR-006**: Al cambiar de modo dentro del mismo documento, el sistema MUST preservar la capa compartida y las sesiones de otros modos.
- **FR-007**: Al completar un paso del flujo recomendado, el sistema MUST ofrecer continuar al siguiente paso con el mismo documento ya cargado y sin repetir normalización ni inventario de conceptos cuando ya existan en la capa compartida.
- **FR-008**: Al generar ítems Cloze en un documento con señales de fallo de RSVP o Questions, el sistema MUST priorizar conceptos o bloques con respuestas incorrectas frente a conceptos sin evaluación previa.
- **FR-009**: El sistema MUST registrar en la capa compartida las respuestas incorrectas y correctas de modos de evaluación (RSVP, Questions) de forma que modos posteriores puedan consultarlas.
- **FR-010**: Si el usuario elige empezar una sesión nueva en un modo concreto, el sistema MUST pedir confirmación y MUST limitar el borrado a la sesión de ese modo, conservando por defecto la capa compartida y otras sesiones de modo.
- **FR-011**: El panel de progreso del flujo MUST reflejar pasos completados según criterios por modo (Slow fase 3, RSVP evaluación completa, Cloze umbral de dominio, Questions con respuestas, revisión sin ítems vencidos hoy).
- **FR-012**: El sistema MUST permitir ignorar el flujo recomendado y abrir cualquier modo directamente, sin perder continuidad de documento.
- **FR-013**: Si un modo requiere trabajo pesado pendiente (p. ej. generar bloques RSVP), el sistema MUST mostrar el material ya cargado y el siguiente paso claro (generar, continuar, o reanudar), no un upload duplicado.

### Key Entities

- **Documento de estudio**: Unidad de material normalizado; identidad estable; agrupa capa compartida y sesiones por modo.
- **Capa compartida**: Datos reutilizables entre modos (texto, jerarquía, conceptos, anotaciones, señales de evaluación, recomendación de flujo, ítems de repetición espaciada).
- **Sesión de modo**: Estado privado de un modo (RSVP, Slow, Cloze, Questions) dentro de un documento; puede reanudarse o reiniciarse independientemente.
- **Señal de laguna**: Registro de que un concepto o bloque tuvo respuesta incorrecta o baja confianza en un modo de evaluación; usada para priorizar modos posteriores.
- **Paso de flujo**: Entrada en la recomendación (modo, etiqueta, tiempo estimado, estado completado/omitido).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100% de los casos de prueba definidos, tras subir material por recomendación y elegir un modo, el usuario no realiza un segundo upload del mismo archivo para comenzar.
- **SC-002**: En transiciones RSVP → Cloze o Slow → Cloze con inventario previo, el tiempo hasta poder estudiar en Cloze se reduce al menos un 50% frente al flujo actual (sin re-inventario ni re-normalización).
- **SC-003**: Cuando existen fallos registrados en RSVP/Questions, al menos el 60% de los primeros ítems Cloze priorizados corresponden a conceptos con lagunas detectadas.
- **SC-004**: El 90% de los usuarios de prueba completan una transición entre dos modos del mismo documento en menos de 3 acciones (sin contar confirmaciones de "empezar de cero").
- **SC-005**: Tras cerrar y reabrir la aplicación, el documento activo, la capa compartida y el progreso del flujo recomendado permanecen coherentes en el 100% de los escenarios de prueba de persistencia.
- **SC-006**: Ningún modo requiere re-subir material cuando ya existe sesión de documento con el mismo contenido normalizado.

## Assumptions

- Existe o existirá infraestructura de sesión unificada por documento (`DocumentSession` con capa compartida y slices por modo); esta feature define el comportamiento de continuidad sobre esa base, no el schema desde cero.
- La recomendación de flujo y el panel de progreso ya están definidos en `20260609-flow-recommendation`; esta feature conecta esos contratos con la experiencia de entrada y transición entre modos.
- Los criterios de "modo completado" para el tracker de flujo se reutilizan sin cambio sustancial salvo que la integración exponga huecos; en ese caso se alinean en implementación, no se redefinen aquí.
- Priorizar lagunas en Cloze es heurístico (peso mayor a conceptos fallados), no garantía pedagógica perfecta; no se exige personalización por historial del usuario entre documentos distintos.
- El usuario puede seguir ignorando el flujo recomendado; la continuidad aplica igual al cambiar de modo manualmente.
- Un "inventario de conceptos suficiente" para saltar redescubrimiento en Cloze sigue la regla ya acordada en sesión unificada (p. ej. umbral mínimo de conceptos o Slow Mode avanzado); esta spec no fija el número exacto, solo exige reutilización cuando ya existe.
- Textos de UI pueden permanecer en inglés como el resto de la app; el valor de negocio se describe en español para el stakeholder.

## Dependencies

- `20260609-unified-session`: capa compartida, persistencia por documento, hooks Slow→shared y Cloze←shared.
- `20260609-flow-recommendation`: recomendación, tracker de progreso, panel de flujo.
- `20260609-doc-hierarchy-index`: jerarquía reutilizable en todos los modos.
- `20260611-rsvp-block-recommend` (opcional): cache de inventario RSVP acelera handoff a RSVP sin re-indexar.

## Out of Scope

- Fusionar grafos epistémicos de RSVP y Cloze en un único grafo visual.
- Recomendación personalizada según historial del usuario entre documentos.
- Sincronización en la nube o multi-dispositivo.
- Modificar la lógica pedagógica interna de cada modo más allá de consumir la capa compartida y señales de laguna.
