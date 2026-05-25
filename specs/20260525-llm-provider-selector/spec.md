# Feature Specification: Multi-LLM Provider Selector

**Feature Branch**: `20260525-llm-provider-selector`

**Created**: 2026-05-25

**Status**: Draft

**Input**: User description: "Crear un selector para en casos como saturación de DeepSeek poder usar otros LLM. Alternativa v1: Gemini 2.5 Flash. DeepSeek por defecto. API keys de ambos desde configuración. Desplegable de modelo antes de empezar sesión."

## Clarifications

### Session 2026-05-25

- Q: ¿Alcance del catálogo v1 y dónde se elige el modelo? → A: Solo **DeepSeek** (por defecto, funciona como hoy) y **Gemini 2.5 Flash** como alternativa. En configuración inicial se pueden guardar **ambas** API keys (DeepSeek obligatoria para el flujo habitual; Gemini opcional hasta que se use). **Antes de iniciar una sesión nueva**, desplegable para elegir modelo (default DeepSeek). Sin lista amplia de proveedores, sin endpoint personalizado, sin failover automático en v1.
- Q: ¿Chat guía y review usan el mismo modelo que la sesión? → A: **Sí** — chat guía y “Review session” usan el mismo `llm_model` que la sesión de estudio activa; sin sesión activa, DeepSeek por defecto.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Guardar API keys de DeepSeek y Gemini (Priority: P1)

Como estudiante, quiero introducir y guardar la API key de DeepSeek y, si quiero respaldo, la de Gemini en la pantalla de configuración, para no tener que buscarlas cuando DeepSeek falle.

**Why this priority**: Sin ambas credenciales persistidas, el cambio de modelo en mitad de un incidente es más lento.

**Independent Test**: Abrir configuración, guardar key DeepSeek, guardar key Gemini, recargar página y verificar que ambas persisten por separado.

**Acceptance Scenarios**:

1. **Given** primera visita, **When** configuro API, **Then** veo campo para DeepSeek (comportamiento actual / migración `ds_api_key`) y campo separado para Gemini (opcional).
2. **Given** solo key DeepSeek guardada, **When** uso la app con modelo por defecto, **Then** todo funciona como hoy sin exigir Gemini.
3. **Given** ambas keys guardadas, **When** recargo la app, **Then** ninguna key sobrescribe a la otra.

---

### User Story 2 - Elegir modelo antes de iniciar sesión (Priority: P1)

Como estudiante, al crear una sesión de estudio nueva, quiero un desplegable para elegir **DeepSeek** o **Gemini 2.5 Flash** (por defecto DeepSeek), para decidir qué proveedor usará esa sesión antes de generar bloques.

**Why this priority**: Es el momento en que empiezan las llamadas API masivas; aquí se evita quedar bloqueado si DeepSeek está saturado.

**Independent Test**: En pantalla "Create a study session", elegir Gemini en el desplegable, generar bloques y verificar que las peticiones usan Gemini (p. ej. endpoint/modelo Gemini, no DeepSeek).

**Acceptance Scenarios**:

1. **Given** pantalla de creación de sesión, **When** la abro, **Then** veo desplegable de modelo con **DeepSeek** seleccionado por defecto.
2. **Given** elijo **Gemini 2.5 Flash** y tengo key Gemini guardada, **When** genero bloques, **Then** todas las llamadas API de esa sesión (split, bloques, assessment, gap synthesis, tutor, review si aplica) usan Gemini hasta nueva sesión.
3. **Given** elijo Gemini sin key Gemini guardada, **When** intento generar bloques, **Then** se bloquea con mensaje claro pidiendo configurar la key de Gemini.
4. **Given** DeepSeek saturado en sesión previa, **When** creo **nueva** sesión y elijo Gemini en el desplegable, **Then** puedo completar generación sin re-subir material de la sesión anterior.

---

### User Story 3 - Estudiar sin regresión (Priority: P2)

Como estudiante con sesión ya generada, quiero que el modelo elegido al crear la sesión no rompa RSVP, preguntas locales ni export, y que estudiar no requiera API salvo tutor/regeneración.

**Why this priority**: El respaldo sirve para generar; el estudio offline de contenido ya generado debe seguir igual.

**Independent Test**: Sesión generada con Gemini, completar RSVP y export sin nuevas llamadas obligatorias.

**Acceptance Scenarios**:

1. **Given** sesión con `llm_model` guardado en metadatos, **When** estudio bloques ya generados, **Then** datos locales intactos.
2. **Given** cambio solo keys en configuración, **When** no creo sesión nueva, **Then** la sesión activa conserva el modelo con el que se creó.

---

### User Story 4 - Recuperarse de error del proveedor (Priority: P3)

Como estudiante, quiero ver el error del proveedor (p. ej. "Service is too busy") y poder crear una nueva sesión eligiendo Gemini en el desplegable y reintentando, sin failover automático.

**Why this priority**: Acorde a v1 manual; evita lógica de reintento cruzado opaca.

**Independent Test**: Forzar error DeepSeek, mensaje visible, nueva sesión con Gemini, generación OK.

**Acceptance Scenarios**:

1. **Given** error API en generación, **When** se muestra al usuario, **Then** incluye el mensaje del proveedor activo de esa sesión.
2. **Given** fallo por saturación DeepSeek, **When** inicio nueva sesión con Gemini en desplegable, **Then** no hace falta cambiar código ni endpoint manualmente.

---

### Edge Cases

- Solo key DeepSeek → desplegable muestra Gemini pero al elegirlo sin key → bloqueo con mensaje antes de generar.
- Key Gemini inválida (401) → mensaje distinto de saturación.
- Gemini sin soporte equivalente a `response_format: json_object` en alguna operación → adaptador debe garantizar JSON parseable o mensaje de error accionable (validar en plan/quickstart).
- Reanudar sesión guardada → usa el modelo almacenado en metadatos de esa sesión; el desplegable en creación no altera sesiones ya existentes.
- Modo offline / pack offline → sin desplegable de modelo ni llamadas API.
- Cambio de modelo solo aplica a **sesión nueva**; no hay conmutación automática si DeepSeek falla mid-request.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La configuración de API MUST mostrar dos campos independientes: **DeepSeek API key** y **Gemini API key** (Gemini opcional hasta usarse).
- **FR-002**: Las keys MUST persistirse por separado en localStorage (DeepSeek: migrar/compatibilizar `ds_api_key`; Gemini: clave dedicada nueva).
- **FR-003**: DeepSeek MUST ser el modelo por defecto en toda la app para usuarios existentes sin cambios de hábito.
- **FR-004**: La pantalla **Create a study session** MUST incluir un desplegable de modelo con exactamente dos opciones: **DeepSeek** (default) y **Gemini 2.5 Flash**.
- **FR-005**: Al iniciar generación de una sesión nueva, la app MUST guardar la elección del desplegable en metadatos de sesión (p. ej. `_meta.llm_model`) y usarla en todas las llamadas API de esa sesión.
- **FR-006**: Si el usuario elige Gemini sin key Gemini guardada, la app MUST bloquear el envío del formulario de creación con mensaje explícito.
- **FR-007**: Todas las funciones API existentes (split, block JSON, assessment, gap synthesis, socratic tutor, review) MUST enrutarse según el modelo de la sesión activa mediante un adaptador (DeepSeek: OpenAI-compatible actual; Gemini: API Google documentada para `gemini-2.5-flash`).
- **FR-008**: La app MUST NOT implementar failover automático DeepSeek→Gemini en v1; el usuario cambia modelo creando sesión nueva o eligiendo Gemini antes de generar.
- **FR-009**: Errores HTTP y `error.message` del proveedor MUST mostrarse sin ocultar (p. ej. saturación DeepSeek).
- **FR-010**: Cambiar keys en configuración o crear sesión con otro modelo MUST NOT borrar sesiones guardadas ni regenerar bloques existentes automáticamente.
- **FR-011**: La app MUST NOT añadir en v1 otros proveedores, OpenRouter, ni endpoint personalizado.
- **FR-012**: El chat guía y el flujo “Review session” MUST usar el mismo `llm_model` que la sesión activa; sin sesión activa, DeepSeek por defecto.

### Key Entities

- **LLMModelOption**: `deepseek` | `gemini-2.5-flash` (id, displayName, provider, defaultModel id técnico).
- **ProviderCredentials**: `deepseekApiKey`, `geminiApiKey` (localStorage separados).
- **SessionLLMChoice**: `llm_model` en metadatos de sesión, fijado al crear sesión nueva.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras error de saturación DeepSeek, el usuario puede generar una sesión nueva con Gemini en ≤3 minutos (guardar key si falta + elegir en desplegable + generar), sin reimplementar flujo.
- **SC-002**: Los flujos API listados en FR-007 funcionan con DeepSeek y con Gemini 2.5 Flash en prueba manual documentada (quickstart).
- **SC-003**: Sesión guardada y export .md permanecen válidos; metadatos incluyen modelo usado.
- **SC-004**: Usuario con solo `ds_api_key` abre la app, ve DeepSeek por defecto en desplegable y genera sin configurar Gemini.

## Assumptions

- **Gemini 2.5 Flash** es el único respaldo v1; se usa el identificador de modelo publicado por Google (`gemini-2.5-flash` o equivalente documentado en plan).
- El desplegable vive en la pantalla de creación de sesión (`Create a study session`), visible antes de "Generate blocks".
- Reanudar sesión usa el `llm_model` ya guardado; el desplegable no se muestra de nuevo en resume salvo nueva sesión.
- Sin key Gemini, la opción Gemini en desplegable puede mostrarse pero no permitir generar.
- Calidad/coste de Gemini 2.5 Flash se considera aceptable como respaldo cercano a DeepSeek para JSON y texto largo (validación empírica en T08/quickstart).

## Out of Scope (v1)

- Failover automático al detectar "Service is too busy".
- Catálogo con Groq, Mistral, OpenRouter, endpoints personalizados.
- Selector de modelo en mitad de sesión (cambiar proveedor sin nueva sesión).
- Facturación unificada o comparador de precios en UI.
- Backend propio para ocultar keys.
