# Feature Specification: Study Source Fidelity (RSVP & Guide)

**Feature Branch**: `20260613-source-fidelity`

**Created**: 2026-06-13

**Status**: Draft

**Input**: El LLM ignora el archivo subido al generar bloques RSVP, inventariar conceptos y responder preguntas del tutor: define términos técnicos (p. ej. «amoralismo») con sentidos genéricos en lugar de los del profesor, introduce contenido que no aparece en la fuente, y no respeta taxonomías/clasificaciones del material. El archivo subido es la fuente suprema de verdad; el rol del LLM es **traducir** la fuente (parafrasear en prosa legible a velocidad RSVP), no **crear** pedagogía genérica. Implementación en tres niveles entregables: **A** (reglas de fidelidad + tutor anclado), **B** (chunks alineados a conceptos + validación), **C** (pipeline extract→rewrite, modo estricto, visibilidad de discrepancias).

## Delivery Phases

| Phase | Goal | Independent value |
|-------|------|-------------------|
| **A — Fidelity rules** | Invertir instrucciones que premian invención; unificar principio «fuente primero» en generación y tutor | Mejora inmediata cuando el chunk ya contiene el pasaje relevante |
| **B — Aligned grounding** | Cada bloque recibe el trozo de fuente que corresponde a su concepto; inventario anclado; comprobaciones post-generación | Arregla la causa raíz del desajuste título↔texto |
| **C — Source-first product** | Extracción antes de reescritura, tutor con acceso documental completo, modo estricto, avisos de discrepancia | Garantías fuertes para material académico/filosófico denso |

Phases MUST ship in order **A → B → C**. Each phase is independently testable and deployable; later phases extend, not replace, earlier guarantees.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Definiciones del profesor en bloques RSVP (Priority: P1, Phase A)

Como estudiante de material académico (ética, filosofía, derecho), al generar un bloque RSVP quiero que las definiciones, clasificaciones y ejemplos reflejen **cómo el autor del PDF/MD los presenta**, no la definición de manual genérico del modelo.

**Why this priority**: Es el fallo reportado («amoralismo» y términos con sentido técnico distinto); sin esto el producto contradice su propósito de estudiar *esta* fuente.

**Independent Test**: Subir un fragmento donde el autor define un término de forma no estándar; generar bloque; la explicación RSVP debe usar la clasificación del autor y no contradecirla con la definición enciclopédica habitual.

**Acceptance Scenarios**:

1. **Given** un pasaje donde «amoralismo» se define de forma específica del curso, **When** se genera el bloque de vocabulario o conceptual que lo cubre, **Then** la explicación parafrasea esa definición y no la sustituye por la de diccionario filosófico general.
2. **Given** un bloque sobre una taxonomía del autor (p. ej. tipos de éticas no cognitivistas), **When** se genera la explicación, **Then** la lista de tipos y sus nombres coinciden con la fuente; no se añaden categorías que el texto no menciona.
3. **Given** un concepto sin ejemplo explícito en la fuente, **When** se genera la explicación, **Then** el sistema omite el ejemplo inventado o indica brevemente que el texto no lo desarrolla — no inventa un «caso real» externo.

---

### User Story 2 — Tutor lateral que no contradice la fuente (Priority: P1, Phase A)

Como estudiante, al preguntar en el chat del tutor durante una sesión RSVP quiero respuestas basadas en el material subido y en lo ya estudiado en la sesión, no en conocimiento general del modelo.

**Why this priority**: El tutor hoy puede reforzar definiciones erróneas; es el segundo canal donde el usuario detecta «inventos».

**Independent Test**: Preguntar por un término con definición idiosincrásica en la fuente; la respuesta debe alinearse con el chunk del bloque actual o con bloques ya generados, y declinar sin inventar si la fuente no lo cubre.

**Acceptance Scenarios**:

1. **Given** una pregunta sobre un término del bloque actual, **When** el tutor responde, **Then** la respuesta es coherente con el trozo de fuente asignado a ese bloque y con la explicación generada de ese bloque.
2. **Given** una pregunta sobre contenido no presente en material ni bloques vistos, **When** el tutor responde, **Then** indica en una frase que el texto subido no lo desarrolla — sin rellenar con conocimiento externo.
3. **Given** conflicto entre conocimiento general y definición del autor en la fuente, **When** el tutor responde, **Then** prevalece la definición/uso del autor.

---

### User Story 3 — Trozo de fuente que corresponde al bloque (Priority: P1, Phase B)

Como estudiante, cuando estudio el bloque titulado «X» quiero que el sistema haya usado —para generar ese bloque— el pasaje del documento donde realmente se habla de X, no una porción arbitraria del archivo por posición lineal.

**Why this priority**: Sin alineación chunk↔concepto, las reglas de fidelidad de la Fase A tienen un techo bajo: el modelo recibe texto irrelevante y rellena por título.

**Independent Test**: Material con orden pedagógico distinto al orden del PDF (reorden por prerequisitos); bloque sobre concepto del capítulo 8 debe incluir pasajes del capítulo 8, no palabras 40–45 % del documento.

**Acceptance Scenarios**:

1. **Given** inventario y empaquetado en N bloques con títulos y términos clave, **When** se asignan trozos de fuente a cada bloque, **Then** cada trozo contiene menciones de los términos/título del bloque o citas ancla del inventario.
2. **Given** estructura jerárquica del documento disponible (secciones/capítulos), **When** se asigna chunk, **Then** el sistema prefiere límites de sección sobre cortes a mitad de párrafo cuando es posible.
3. **Given** imposibilidad de localizar un concepto en el texto, **When** se asigna chunk, **Then** el sistema marca el bloque con aviso de «anclaje débil» antes o durante la generación (no silencio).

---

### User Story 4 — Inventario anclado al texto (Priority: P2, Phase B)

Como estudiante, quiero que el inventario de conceptos refleje lo que el documento enseña, con una referencia verificable al texto (cita corta o indicación de dónde aparece), para que títulos de bloque y scopes no sean ya una paráfrasis genérica.

**Why this priority**: El inventario alimenta títulos, summaries y modo Questions; si nace inventado, todo lo downstream hereda el error.

**Independent Test**: Tras inventariar, cada concepto incluye `source_phrase` (o equivalente) que aparece literal o casi literal en el material.

**Acceptance Scenarios**:

1. **Given** material sustancial, **When** corre el inventario, **Then** cada concepto incluye una cita corta (≤25 palabras) extraída del documento o una indicación inequívoca de presencia del término.
2. **Given** un concepto sin apoyo textual localizable, **When** se incluye en inventario, **Then** solo se incluye si es esencial para coherencia del mapa y queda marcado como inferido (no como citado).

---

### User Story 5 — Detección de contenido no anclado (Priority: P2, Phase B)

Como estudiante, si el modelo introduce en un bloque términos o afirmaciones sin soporte en el trozo de fuente, quiero que el sistema lo detecte y reintente o avise, en lugar de presentarlo como estudio fiable.

**Why this priority**: Cierra el ciclo de calidad sin depender solo de buena voluntad del prompt.

**Independent Test**: Bloque generado con término clave ausente del chunk y de la explicación citada → validación falla o dispara regeneración acotada.

**Acceptance Scenarios**:

1. **Given** una explicación generada, **When** corre la validación de fidelidad, **Then** los términos de dominio destacados en título/signature deben aparecer en el chunk o estar parafraseados explícitamente desde él.
2. **Given** fallo de validación recuperable, **When** se reintenta generación, **Then** el segundo intento recibe instrucción explícita de no inventar lo ausente del chunk.
3. **Given** fallo persistente, **When** se muestra el bloque, **Then** el usuario ve indicación de fidelidad reducida (no fallo silencioso).

---

### User Story 6 — Modo estricto «solo traducir» (Priority: P3, Phase C)

Como estudiante de textos densos, quiero un modo en el que el sistema primero extrae afirmaciones/definiciones citables del trozo de fuente y solo después las reescribe en formato RSVP, sin añadir capas pedagógicas no presentes en el original.

**Why this priority**: Máxima garantía para usuarios que comparan bloque con PDF línea a línea.

**Independent Test**: Activar modo estricto; la explicación final no contiene entidades nombradas ni clasificaciones ausentes del paso de extracción.

**Acceptance Scenarios**:

1. **Given** modo estricto activo, **When** se genera un bloque, **Then** existe un paso intermedio visible o auditable (extracto estructurado) del que deriva la prosa RSVP.
2. **Given** modo estricto, **When** la fuente no define un contraste o ejemplo, **Then** esos apartados del esquema pedagógico se omiten en lugar de rellenarse.
3. **Given** modo estándar (post-Fase A), **When** el usuario no activa estricto, **Then** se mantienen reglas de fidelidad pero se permite parafraseo RSVP sin paso extract explícito.

---

### User Story 7 — Tutor con alcance documental completo (Priority: P3, Phase C)

Como estudiante, al preguntar sobre cualquier parte del material ya subido (no solo el bloque actual), quiero que el tutor busque y cite el pasaje relevante del documento completo, sin inventar.

**Why this priority**: Preguntas transversales («¿cómo relaciona el autor X con Y?») requieren más que el chunk del bloque activo.

**Independent Test**: Pregunta sobre sección no estudiada aún → tutor cita o parafrasea desde el documento sin spoilear bloques futuros de forma pedagógica, o indica que aún no se ha estudiado en la sesión según política elegida.

**Acceptance Scenarios**:

1. **Given** pregunta sobre término presente en otra sección del mismo archivo, **When** el tutor responde, **Then** la respuesta se basa en el pasaje localizado en el documento completo.
2. **Given** política de no spoilers de bloques futuros, **When** la respuesta requiere texto no estudiado, **Then** el tutor lo indica sin revelar contenido de bloques posteriores, o revela solo lo necesario según configuración documentada en Assumptions.

---

### Edge Cases

- Material muy corto (un solo tema): chunks alineados pueden solaparse; el sistema permite solapamiento controlado pero no contradicciones entre bloques.
- Sin API / modo offline: reglas de fidelidad aplican a bloques precargados; sin regeneración LLM.
- Idioma de estudio distinto al del PDF: parafraseo en idioma de estudio manteniendo clasificaciones y términos técnicos del original (nombres propios y etiquetas del autor sin traducir salvo que el texto lo haga).
- Múltiples autores con definiciones enfrentadas en el mismo PDF: la explicación debe atribuir la definición al autor/sección correspondiente, no fusionar en una sola.
- Fallback de split monofásico (clásico): las reglas de Fase A y B aplican igualmente; no se exime de fidelidad.
- Modo Questions sin explicación RSVP larga: preguntas y feedback deben anclarse al trozo de fuente alineado, no solo al summary de una línea.
- Assessment pre-packing e inventario: ítems de evaluación deben ser respondibles desde la fuente, coherente con reglas de fidelidad.
- Término en título de bloque pero ausente del documento (error de inventario): aviso de anclaje débil + prohibición de definición inventada.

## Requirements *(mandatory)*

### Functional Requirements — Phase A (Fidelity rules)

- **FR-A01**: El sistema MUST tratar el material subido como **fuente suprema de verdad** para generación de explicaciones RSVP, bloques de vocabulario, preguntas, feedback, inventario de conceptos (scope) y respuestas del tutor lateral.
- **FR-A02**: Las instrucciones de generación MUST NOT pedir al modelo que priorice pedagogía genérica sobre la fuente (p. ej. «no reflejar el documento», «explicar a un adolescente genérico», «ejemplo real inventado») cuando contradigan definiciones del texto.
- **FR-A03**: Las explicaciones RSVP MUST parafrasear definiciones, clasificaciones, taxonomías y ejemplos **desde el trozo de fuente proporcionado**; MUST NOT introducir conceptos, autores, fechas o categorías no presentes en fuente + título de bloque + inventario del bloque.
- **FR-A04**: Si la fuente no proporciona ejemplo, contraste o historia del término, el sistema MUST omitir ese contenido o declarar brevemente su ausencia — MUST NOT rellenar con conocimiento externo.
- **FR-A05**: En conflicto entre definición estándar del dominio y definición del autor, **prevalece la del autor** en explicación, diccionario de conceptos y tutor.
- **FR-A06**: Las reglas de fidelidad MUST aplicarse de forma coherente en: generación de bloque RSVP, regeneración de preguntas, enriquecimiento de diccionario, assessment pre-packing (donde exista), y modo Questions.
- **FR-A07**: El tutor lateral MUST recibir el trozo de fuente del bloque activo (y contexto de bloques ya estudiados) además de explicaciones generadas, y MUST responder solo con información sustentada en ese material, con declinación explícita cuando falte soporte.
- **FR-A08**: El inventario de conceptos (fase 1) SHOULD incluir por concepto una **cita corta ancla** (`source_phrase`) extraída del documento cuando sea posible.

### Functional Requirements — Phase B (Aligned grounding)

- **FR-B01**: Tras empaquetar bloques, el sistema MUST asignar a cada bloque un trozo de fuente **alineado semánticamente** al bloque (título, términos signature, concept_ids, citas ancla del inventario), sustituyendo la asignación puramente proporcional por posición lineal como estrategia principal.
- **FR-B02**: Cuando exista jerarquía documental (secciones/capítulos), el sistema SHOULD acotar búsqueda y cortes de trozo a límites de sección.
- **FR-B03**: Si no se localiza pasaje suficiente para un bloque, el sistema MUST marcar **anclaje débil** y MUST NOT presentar el trozo como «verbatim chunk for this block only» sin esa advertencia.
- **FR-B04**: Tras generar una explicación, el sistema MUST ejecutar **validación de fidelidad** determinista: términos clave del bloque deben ser sustentables desde el trozo asignado (presencia o parafraseo trazable).
- **FR-B05**: Ante fallo de validación, el sistema MUST reintentar generación acotada con instrucción de no inventar; si persiste, MUST mostrar aviso de fidelidad reducida al usuario.
- **FR-B06**: La asignación de trozos MUST conservarse en la sesión para reutilización en tutor, regeneración de preguntas y exportación.

### Functional Requirements — Phase C (Source-first product)

- **FR-C01**: El sistema MUST ofrecer **modo estricto** (opt-in) con pipeline **extraer → reescribir**: primero claims/definiciones citables del trozo; luego prosa RSVP derivada solo de esa extracción.
- **FR-C02**: En modo estricto, MUST NOT añadir apartados pedagógicos (ejemplo, contraste, hook externo) no presentes en la extracción.
- **FR-C03**: El tutor MUST poder responder usando **búsqueda en el documento completo** subido, localizando pasajes relevantes, con reglas de spoiler documentadas (ver Assumptions).
- **FR-C04**: El sistema MUST mostrar **discrepancias o anclaje débil** de forma visible al usuario (p. ej. banner o badge en bloque) cuando validación o localización de trozo fallen.
- **FR-C05**: Modo estricto y tutor documental completo MUST respetar las mismas reglas de prevalencia del autor que Fase A.

### Non-Functional Requirements

- **NFR-001**: Sin backend obligatorio; compatible con arquitectura offline-first actual.
- **NFR-002**: Fase A no debe aumentar latencia perceptible de generación de bloque (>10 % p95 vs. baseline).
- **NFR-003**: Fase B puede añadir latencia moderada aceptable en empaquetado (≤30 s p95 en documentos típicos de estudio) a cambio de alineación.
- **NFR-004**: Fase C (extracción + búsqueda documental) puede añadir una llamada LLM adicional por bloque en modo estricto; el usuario debe poder elegir el modo.
- **NFR-005**: Reglas y validaciones deben ser testeables con material de prueba fijo (fragmentos filosóficos con definiciones no estándar).

### Key Entities

- **SourceAnchor**: Referencia verificable al texto — cita corta, rango de sección, o indicador de anclaje débil/inferido.
- **ConceptInventoryItem** (extendido): Concepto teachable con `source_phrase` o ancla equivalente además de título y scope.
- **AlignedSourceChunk**: Trozo de material asignado a un bloque con metadata de calidad de anclaje (fuerte | débil | fallback proporcional).
- **FidelityValidationResult**: Resultado de comprobación post-generación — términos no sustentados, severidad, acción (ok | retry | warn).
- **ExtractedClaims** (Fase C): Conjunto estructurado de definiciones/afirmaciones extraídas del trozo antes de reescritura RSVP.
- **SourceFidelityMode**: `standard` (A+B) | `strict` (C extract→rewrite).

### Scope

**In scope**

- RSVP (generación de bloques, vocabulario, preguntas, tutor lateral, assessment pre-packing ligado a inventario).
- Modo Questions (preguntas ancladas a trozo alineado).
- Tres fases A, B, C como se describen arriba.

**Out of scope (v1 de esta feature)**

- Reescritura completa de Slow Mode o Cloze (ya tienen patrones de anclaje distintos); alineación de principios solo donde compartan generación LLM.
- Corrección automática del PDF o normalización de OCR.
- Garantía legal de «cero alucinación»; objetivo es **minimización sistemática** y **visibilidad** de fallos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** (Phase A): En batería de ≥5 fragmentos académicos con definiciones no estándar, ≥80 % de bloques generados usan la clasificación del autor sin introducir categorías ajenas al texto (revisión manual o rúbrica documentada).
- **SC-002** (Phase A): En ≥90 % de preguntas de prueba al tutor sobre términos del bloque activo, la respuesta no contradice el trozo de fuente ni la explicación del bloque.
- **SC-003** (Phase B): En material con orden pedagógico ≠ orden del documento, ≥85 % de bloques tienen trozo asignado que contiene al menos un término clave del bloque o su `source_phrase` del inventario.
- **SC-004** (Phase B): Validación de fidelidad detecta ≥70 % de bloques sintéticos «envenenados» con término inventado en pruebas controladas.
- **SC-005** (Phase C): En modo estricto, ≥75 % de explicaciones no contienen entidades nombradas ausentes del paso de extracción (muestra de ≥10 bloques de prueba).
- **SC-006** (Overall): Usuarios que reportaron «el LLM inventa definiciones» pueden verificar en el PDF la correspondencia en la mayoría de bloques sin hallar contradicciones graves en prueba de aceptación de 30 minutos con su material real.

## Assumptions

- El usuario sube material que es la autoridad pedagógica (apuntes, artículo asignado, capítulo de manual del profesor).
- «Traducir» significa parafrasear en prosa RSVP corta preservando sentido técnico del autor, no traducción literal palabra por palabra.
- Fase A entrega valor incluso antes de Fase B; se recomienda no posponer A esperando B.
- Política de spoilers del tutor (Fase C): por defecto, el tutor puede usar todo el documento subido para **localizar** definiciones, pero al responder sobre bloques no estudiados prefiere indicar «aún no has llegado a este bloque» salvo que la pregunta sea puramente definicional del término en el PDF — detalle fino se resolverá en `/speckit-plan`.
- Términos técnicos en idioma distinto al de estudio se mantienen como en la fuente cuando son etiquetas del autor.
- La asignación proporcional lineal queda solo como **fallback** explícito (Fase B), nunca como camino silencioso principal.
- Dependencias: pipeline de inventario y empaquetado en dos fases existente; normalización de material (PDF/MD/HTML) ya operativa.

## Dependencies

- Feature `20260526-block-split-dedup` (inventario + empaquetado) — la Fase B completa la deuda de alineación chunk↔concepto identificada en su investigación.
- Jerarquía documental (`20260609-doc-hierarchy-index`) — mejora FR-B02 cuando está disponible; no bloqueante para Fase B mínima.
- Tutor lateral y generación de bloques RSVP — superficies principales de cambio en Fase A.
