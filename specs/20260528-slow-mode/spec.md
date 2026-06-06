# Feature Specification: Slow Mode — Lectura Profunda

**Feature Branch**: `20260528-slow-mode`

**Created**: 2026-06-06

**Status**: Draft

**Input**: Nuevo modo de lectura para textos argumentativos densos (filosofía, papers teóricos, ensayo). Coexiste con RSVP. El usuario elige el modo en la pantalla de inicio (crear sesión). Basado en `slow_mode_spec.md`: lectura auto-paced paginada, anotaciones activas, IA bajo demanda, fases 0–3, modo crítico opcional.

## Clarifications

### Session 2026-06-06

- Q: ¿Qué alcance incluye v1 del Slow Mode? → A: **Opción C — spec completa**: Fases 0–3, Modo Crítico, todos los tipos de anotación, gamificación (hallazgos, depth score, mapa rellenable, vista de grafo enriquecida), focus mode, checkpoints, integración grafo y flashcards — todo `slow_mode_spec.md` en v1.
- Q: ¿Cómo se ingiere y pagina el texto en Slow Mode? → A: **Opción A** — reutilizar pipeline de normalización RSVP (`html_min` / markdown); paginar por viewport según tipografía; **anclas de anotación por offset de caracteres** (`charStart`, `charEnd`) sobre el texto normalizado canónico.
- Q: ¿Cómo genera Fase 0 la IA en textos largos? → A: **Híbrido D→A/B** — el usuario selecciona scope (documento completo, capítulo o sección) antes de Fase 0; si el scope elegido tiene &lt; ~60k caracteres → llamada única; si ≥ ~60k caracteres → map-reduce por subsecciones (headings) dentro del scope + síntesis final.
- Q: ¿Cómo se persiste la sesión Slow Mode vs RSVP? → A: **Opción A — estructura unificada por modo**: objeto `sessionsByMode` en localStorage con slots `rsvp` y `slow`; cada slot usa esquema unificado (`studyMode` + datos RSVP en raíz o sub-objeto `slow`); crear sesión nueva en un modo solo reemplaza el slot de ese modo.
- Q: ¿Comportamiento del selector de modo en pantalla de inicio? → A: **Opción D** — sin preselección de modo; elección explícita cada vez; tras elegir modo, ofrecer **continuar la última sesión guardada de ese modo** o iniciar sesión nueva; la sesión del otro modo permanece intacta.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Elegir modo en pantalla de inicio (Priority: P1)

Como estudiante, quiero elegir entre **RSVP** y **Slow Mode** al crear una sesión, para usar el pipeline adecuado según la naturaleza del texto.

**Why this priority**: Sin triage explícito, el Slow Mode no es accesible; es la puerta de entrada del feature.

**Independent Test**: Abrir pantalla de creación de sesión; seleccionar Slow Mode; verificar que el flujo posterior no exige generación de bloques RSVP.

**Acceptance Scenarios**:

1. **Given** pantalla de creación de sesión (`screenPlaceholder`), **When** la abro, **Then** veo selector de modo con RSVP y Slow Mode **sin ninguno preseleccionado**, con descripción breve de cuándo usar cada uno.
2. **Given** elijo Slow Mode y existe `sessionsByMode.slow`, **When** confirmo el modo, **Then** puedo **continuar** esa sesión o iniciar una **nueva** (la nueva reemplaza solo el slot `slow`).
3. **Given** elijo RSVP y existe `sessionsByMode.rsvp`, **When** confirmo el modo, **Then** puedo continuar esa sesión o iniciar una nueva (la nueva reemplaza solo el slot `rsvp`).
4. **Given** modo Slow Mode y sesión nueva, **When** subo un archivo, **Then** el flujo omite bloques/preguntas RSVP y entra al pipeline Slow Mode.
5. **Given** modo RSVP, **When** creo sesión, **Then** el comportamiento actual (generación de bloques) se mantiene sin regresiones.
6. **Given** una sesión Slow guardada y otra RSVP guardada, **When** alterno entre modos en visitas sucesivas, **Then** cada modo restaura su propia última sesión sin borrar la del otro.

---

### User Story 2 - Fase 0: orientación previa (Priority: P1)

Como lector de textos densos, quiero una orientación estructural (tesis, mapa argumental, conceptos clave, pregunta guía) antes de leer, para activar el schema relevante.

**Why this priority**: Base empírica fuerte (advance organizers); sin Fase 0 el modo pierde diferenciación frente a lectura libre.

**Independent Test**: Abrir texto en Slow Mode; verificar los 4 bloques de Fase 0 antes del documento; en segunda lectura del mismo texto, Fase 0 colapsable.

**Acceptance Scenarios**:

1. **Given** primera lectura de un texto en Slow Mode, **When** inicio sesión, **Then** selecciono scope de lectura (documento completo, capítulo o sección) y la IA genera Fase 0 (tesis, mapa argumental, 3–5 conceptos, pregunta guía) solo sobre ese scope, antes de mostrar el documento.
2. **Given** scope elegido &lt; ~60k caracteres, **When** Fase 0 se genera, **Then** usa una llamada IA única sobre el texto del scope.
3. **Given** scope elegido ≥ ~60k caracteres, **When** Fase 0 se genera, **Then** usa map-reduce por subsecciones (headings) dentro del scope y una llamada final de síntesis.
4. **Given** Fase 0 visible, **When** confirmo o colapso, **Then** paso a Fase 1 sin bloquear indefinidamente; Fase 1 muestra solo el texto del scope elegido.
5. **Given** lectura posterior del mismo texto y scope, **When** inicio sesión, **Then** Fase 0 aparece colapsada por defecto pero expandible.
6. **Given** Modo Crítico activo, **When** se genera Fase 0, **Then** incluye bloque adicional de puntos a examinar críticamente.

---

### User Story 3 - Fase 1: lectura activa paginada (Priority: P1)

Como lector, quiero leer el texto a mi ritmo con paginación, anotaciones tipadas y IA bajo demanda, sin interrupciones mid-párrafo.

**Why this priority**: Núcleo del Slow Mode; sin esto no hay producto usable.

**Independent Test**: Leer 3 páginas; crear anotaciones de tipos primarios; invocar IA; navegar hacia atrás; verificar persistencia de posición y anotaciones.

**Acceptance Scenarios**:

1. **Given** Fase 1, **When** leo, **Then** el texto se presenta paginado (no scroll infinito), con tipografía ajustable y barra de progreso discreta.
2. **Given** selección de fragmento, **When** elijo tipo de anotación, **Then** registro texto propio anclado por offset de caracteres (`charStart`, `charEnd`) en el documento normalizado; la marca aparece en margen, no inline.
3. **Given** sidebar de IA, **When** pregunto sobre contenido ya leído, **Then** la IA responde brevemente sin spoilers de páginas no alcanzadas.
4. **Given** Fase 1, **When** activo focus mode, **Then** solo texto + barra de progreso permanecen visibles.
5. **Given** swipe o controles de página, **When** retrocedo, **Then** accedo a cualquier página anterior sin restricción.

---

### User Story 4 - Fase 2: checkpoints de sección (Priority: P2)

Como lector que quiere consolidar por sección, quiero un checkpoint opcional al final de cada sección, dismissable, con una pregunta de integración.

**Acceptance Scenarios**:

1. **Given** fin de sección detectada, **When** transcurren ~10s tras la última página de la sección, **Then** aparece chip `[≡ CHECKPOINT · 30 seg]` dismissable.
2. **Given** checkpoint activo, **When** respondo en texto libre, **Then** la respuesta se guarda como anotación `→ Auto-explicación`.
3. **Given** checkpoint visible, **When** hago swipe para descartar, **Then** continúo lectura sin bloqueo.

---

### User Story 5 - Fase 3: consolidación post-lectura (Priority: P2)

Como lector que terminó el texto, quiero revisión argumental, preguntas de retrieval desde mis anotaciones e integración al grafo, para retención a largo plazo.

**Acceptance Scenarios**:

1. **Given** lectura completa, **When** entro Fase 3, **Then** puedo elegir módulos: revisión argumental (mapa Fase 0 vs anotaciones), preguntas desde anotaciones, integración al grafo.
2. **Given** anotaciones críticas (`⊘`, `↯`, `⚠`), **When** Fase 3 en Modo Crítico, **Then** incluye preguntas "abogado del diablo inverso".
3. **Given** anotaciones `→` o `≈`, **When** elijo convertir, **Then** puedo generar flashcards para spaced repetition.

---

### User Story 6 - Modo Crítico (Priority: P1)

Como lector de filosofía, quiero activar Modo Crítico al iniciar sesión para priorizar anotaciones críticas y steel-manning.

**Acceptance Scenarios**:

1. **Given** inicio de sesión Slow Mode, **When** activo toggle Lectura crítica, **Then** tipos críticos (`⊘`, `↯`, `⚠`, `★`, `⇑`) están en menú primario de anotación.
2. **Given** anotación `⇑`, **When** la confirmo, **Then** la IA ofrece steel man del argumento sin evaluar validez.
3. **Given** Modo Crítico, **When** completo Fase 3, **Then** el módulo "abogado del diablo inverso" está activo por defecto.

---

### User Story 7 - Gamificación y depth score (Priority: P2)

Como lector motivado intrínsecamente, quiero feedback de calidad de procesamiento sin presión competitiva, para reforzar anotaciones generativas.

**Acceptance Scenarios**:

1. **Given** Fase 1 sin modo mapa rellenable, **When** encuentro un concepto de Fase 0, **Then** el hallazgo se registra silenciosamente y se revela en Fase 3 (no interrumpe lectura).
2. **Given** modo mapa rellenable activo en Fase 0, **When** encuentro un concepto durante lectura, **Then** aparece confirmación discreta `✦ HALLAZGO`.
3. **Given** Fase 3, **When** reviso depth score, **Then** veo puntuación privada por tipo de anotación; feedback de calidad baja solo aquí, no en tiempo real.
4. **Given** sesión Slow Mode completada (Fases 1 y 3), **When** termino, **Then** se desbloquea vista de grafo enriquecida con anotaciones integradas.

---

### Edge Cases

- Scope muy largo (≥ ~60k chars): Fase 0 usa map-reduce automáticamente; UI muestra progreso de generación por subsecciones.
- Usuario elige scope mayor que un capítulo razonable: permitido; sin límite duro de páginas en v1, solo estrategia IA adaptativa.
- Sin conexión / sin API key durante Fase 0: pendiente de planificación (ver Deferred).
- Mismo archivo en RSVP y Slow: **estado independiente** por modo; slots `sessionsByMode` separados.
- PDF con layout complejo (columnas, notas al pie): se **normaliza** vía pipeline existente; no se preserva layout nativo del PDF.
- Cambio de tipografía/tamaño: los offsets de caracteres se mantienen; el índice de página viewport puede recalcularse sin perder anclas.
- Sesión interrumpida: reanudar posición de página y anotaciones parciales.
- Cambio de modo con material ya cargado: **no permitido** mid-sesión; volver a pantalla de inicio, elegir modo explícitamente y continuar o crear sesión nueva en ese modo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE ofrecer selector RSVP / Slow Mode en la pantalla de creación de sesión **sin preselección**; tras elegir modo, ofrecer continuar la última sesión de ese modo o crear sesión nueva.
- **FR-002**: El modo elegido DEBE determinar el pipeline completo de la sesión (RSVP con bloques vs Slow Mode con fases 0–3).
- **FR-003**: Slow Mode DEBE normalizar el material con la misma pipeline RSVP (`html_min` para HTML, markdown para el resto) y presentarlo **paginado por viewport** (no scroll infinito), con navegación libre adelante/atrás y recálculo de páginas al cambiar tipografía.
- **FR-004**: Slow Mode DEBE soportar anotaciones tipadas (primarios: `≈`, `?`, `→`, `⟷`, `⚑`; críticos y secundarios según modo) ancladas por **offset de caracteres** (`charStart`, `charEnd`) sobre el texto normalizado canónico, más texto generado por el usuario.
- **FR-005**: Antes de Fase 0, el usuario DEBE seleccionar scope de lectura (documento completo, capítulo o sección detectada por headings).
- **FR-005a**: Fase 0 DEBE generarse vía IA con tesis, mapa argumental, conceptos clave y pregunta guía sobre el scope elegido; en Modo Crítico, bloque adicional de puntos a examinar.
- **FR-005b**: Si el scope tiene &lt; ~60k caracteres, Fase 0 DEBE usar una llamada IA única; si ≥ ~60k caracteres, DEBE usar map-reduce por subsecciones dentro del scope + síntesis final.
- **FR-005c**: Fase 1 DEBE limitar lectura, anotaciones e IA al scope elegido; offsets de caracteres son relativos al `normalizedText` del scope.
- **FR-006**: IA en Fase 1 DEBE ser on-demand, sin spoilers, anclada a texto ya leído, dismissable.
- **FR-007**: Fase 2 DEBE ofrecer checkpoints dismissable al fin de sección con buffer ~10s y pregunta de integración única.
- **FR-008**: Fase 3 DEBE comparar mapa Fase 0 con anotaciones, generar preguntas de retrieval desde anotaciones del usuario, e integrar anotaciones al grafo de conocimiento.
- **FR-009**: El sistema DEBE reutilizar formatos de entrada de v1 existentes (`pdf`, `html`, `txt`, `md`) salvo decisión contraria.
- **FR-010**: Gamificación DEBE incluir hallazgos, depth score privado, modo mapa rellenable y desbloqueo de vista de grafo enriquecida; nunca recompensar volumen, velocidad ni comparación social (sin leaderboards, streaks ni notificaciones de hábito).
- **FR-011**: El sistema DEBE persistir `sessionsByMode` en localStorage con slots `rsvp` y `slow`; cada slot almacena la última sesión de ese modo con esquema unificado (`studyMode` + sub-objeto `slow` cuando aplique).
- **FR-011a**: Crear sesión nueva en un modo reemplaza **solo** el slot de ese modo; el slot del otro modo se conserva.
- **FR-011b**: Al elegir un modo en pantalla de inicio, el sistema DEBE ofrecer reanudar el slot correspondiente si existe.
- **FR-012**: Las anotaciones Slow Mode DEBEN poder exportarse y convertirse a flashcards del sistema de spaced repetition existente.
- **FR-013**: El sistema DEBE soportar todos los tipos de anotación del diseño (primarios, críticos y secundarios: `📌`, `⚡`, `↩`, `🔗`).
- **FR-014**: Fase 0 DEBE ofrecer modo mapa rellenable como alternativa de orientación.
- **FR-015**: Feedback de calidad de anotaciones DEBE mostrarse solo en Fase 3, nunca en tiempo real durante Fase 1.
- **FR-016**: Modo Crítico DEBE ser toggle al iniciar sesión (no activo por defecto).

### Key Entities

- **StudyMode**: `rsvp` | `slow`; elegido al crear sesión; determina pipeline.
- **ReadingScope**: rango del documento a estudiar (`full` | `chapter` | `section`); `charStart`/`charEnd` dentro del documento normalizado completo; define el subtexto activo de la sesión.
- **SessionsByMode**: `{ rsvp: ActiveSession | null, slow: ActiveSession | null }` en localStorage; reemplaza el `active_session` único actual.
- **ActiveSession** *(por slot)*: `studyMode: 'rsvp' | 'slow'`; campos RSVP en raíz; sub-objeto `slow` cuando `studyMode === 'slow'`.
- **SlowSession** *(sub-objeto `slow`)*: `normalizedText` canónico, `readingScope`, fase actual, índice de página viewport, modo crítico on/off, `phase0`, `annotations[]`, `depthScore`, `findings[]`.
- **NormalizedDocument**: texto post-pipeline (`html_min` o markdown) con longitud estable; base única para paginación, IA y offsets.
- **Phase0Orientation**: tesis, mapa argumental, conceptos clave, pregunta guía, puntos críticos opcionales.
- **Annotation**: tipo, `charStart`, `charEnd` (offsets en `normalizedText`), texto usuario, timestamp, vínculos al grafo opcionales; página viewport derivada en render, no persistida como ancla primaria.
- **SectionBoundary**: límites de sección para checkpoints (headings detectados o marcados en Fase 0).
- **DepthScore**: puntuación privada de calidad de anotaciones; calculada en Fase 3, no en tiempo real.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de entradas a creación de sesión muestran selector sin preselección; tras elegir modo, continuar o nueva sesión funciona sin cruzar datos entre modos.
- **SC-002**: Usuario puede completar Fase 0 → Fase 1 (≥3 páginas, ≥2 anotaciones) en una sesión de prueba sin bloqueos de UI.
- **SC-003**: IA en Fase 1 no revela contenido de páginas no leídas en el 100% de queries de prueba diseñadas.
- **SC-004**: Reanudar sesión Slow Mode restaura página y anotaciones (offsets intactos) en &lt;2s percibidos.
- **SC-005**: Checkpoints son 100% dismissable sin impedir avance de lectura.
- **SC-006**: Tras Fase 3, ≥1 flashcard generable desde anotaciones del usuario en flujo de prueba.
- **SC-007**: Depth score y mapa de correspondencia Fase 0 vs anotaciones visibles en Fase 3 sin exponer datos a otros usuarios.
- **SC-008**: Vista de grafo enriquecida desbloqueable tras completar Fases 1 y 3 de una sesión Slow Mode.

## Assumptions

- Slow Mode coexiste con RSVP; no reemplaza el pipeline actual.
- **v1 incluye la spec completa** (`slow_mode_spec.md`): no hay subconjunto MVP; implementación por fases internas de desarrollo, entrega funcional completa.
- Un solo usuario local (PWA); sin multi-usuario ni sync cloud en v1.
- IA usa el mismo selector de modelo (DeepSeek / Gemini) que sesiones RSVP.
- El grafo de conceptos y diccionario existentes se reutilizan; anotaciones del usuario son nodos de segunda capa (`[Pedro:]`).
- Focus mode oculta UI de la app; silenciar notificaciones OS depende de capacidades del navegador/PWA.
- Hallazgos silenciosos en Fase 1 salvo modo mapa rellenable (D1 → Opción B del diseño).
- Checkpoints opcionales dismissable, no bloquean avance (D2 → Opción B del diseño).
- Anclas de anotación: offsets de caracteres en documento normalizado; independientes del índice de página viewport.
- Fase 0: estrategia IA híbrida — scope elegido por usuario; umbral ~60k caracteres decide llamada única vs map-reduce.
- Persistencia por modo: `sessionsByMode.rsvp` y `sessionsByMode.slow`; selector sin preselección; reanudar última sesión del modo elegido.
