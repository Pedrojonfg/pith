# Feature Specification: Markdown Canonical Normalization

**Feature Branch**: `20260532-markdown-canonical`

**Created**: 2026-06-08

**Status**: Draft

**Input**: Unificar la normalización de material de estudio: todos los formatos de entrada (`pdf`, `html`, `txt`, `md`) producen **markdown** como único formato canónico. Eliminar la bifurcación `html_min` vs `markdown` introducida en FR-013, manteniendo la extracción rica de HTML (structure inference) antes de emitir.

## Clarifications

### Session 2026-06-08

- Q: ¿Eliminar `html_min` por completo o mantener compatibilidad de lectura? → A: **Emitir solo markdown** en normalización nueva; **leer** `html_min` en sesiones guardadas vía migración/compat en `parseHeadings` y `scopeTextForPhase0IA` hasta v2.
- Q: ¿Qué hacer con tablas/enlaces HTML? → A: Convertir a markdown GFM cuando sea posible; tablas complejas → texto plano con warning `html_structure_simplified`.
- Q: ¿Romper export/import? → A: Export siempre markdown; import acepta legacy `html_min` en sesiones antiguas.
- Q: ¿Slow reader sigue con textContent? → A: Sí en v1; markdown sin tags visibles mejora UX sin cambiar renderer.
- Q: ¿Mantener `toMinimalHtml`? → A: Deprecar en pipeline de upload; conservar función interna solo si otra ruta la necesita, sin exponerla como salida de `normalizeStudyMaterial`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - HTML Word export unificado (Priority: P1)

Como estudiante que sube `.html` exportado de Word, quiero que el material normalizado sea markdown con `#`/`##`, igual que PDF o TXT, para leer en Slow Mode sin ver tags `<h1>` en pantalla.

**Why this priority**: Corrige UX rota actual (reader usa `textContent` y muestra tags HTML literales).

**Independent Test**: Subir HTML con `<p class="Heading1">Capítulo 1</p>` → `normalized_format === "markdown"` y contenido incluye `# Capítulo 1`.

**Acceptance Scenarios**:

1. **Given** HTML con clase `Heading1`, **When** normalizo, **Then** `normalized_format` es `markdown` y hay heading `#` o `##`.
2. **Given** HTML con `<h2>` nativo, **When** normalizo, **Then** se emite `## Título` en markdown.
3. **Given** HTML con párrafos, **When** normalizo, **Then** no quedan tags HTML en `normalized_content`.

---

### User Story 2 - Un solo camino en headings y scope (Priority: P1)

Como desarrollador, quiero un único parser de headings (`#{1,6}`) para todos los uploads, para reducir bugs y duplicación.

**Why this priority**: Simplifica `headings.js`, checkpoints, Phase 0 y tests.

**Independent Test**: `buildScopeOptions` devuelve mismas opciones para HTML-upload y TXT-upload equivalentes.

**Acceptance Scenarios**:

1. **Given** material HTML normalizado, **When** abro scope picker Slow, **Then** detecta capítulos vía regex markdown.
2. **Given** sesión legacy con `normalizedFormat: "html_min"`, **When** cargo sesión, **Then** scope picker sigue funcionando (compat).

---

### User Story 3 - IA y RSVP reciben texto limpio (Priority: P2)

Como sistema, quiero que el texto enviado a LLM no contenga tags HTML sueltos, para ahorrar tokens y evitar confusión del modelo.

**Why this priority**: Hoy `readAndCleanMaterialText` pasa `html_min` crudo a RSVP sin `htmlMinToPlainText`.

**Independent Test**: Tras upload HTML, `cleanedText` no contiene `<p>` ni `<h1>`.

**Acceptance Scenarios**:

1. **Given** upload HTML, **When** genero bloques RSVP, **Then** el texto de split no incluye tags HTML.
2. **Given** upload HTML, **When** Phase 0 IA, **Then** no requiere rama especial `htmlMinToPlainText` para contenido nuevo.

---

### User Story 4 - Migración sesiones existentes (Priority: P2)

Como usuario con sesiones Slow/Cloze guardadas en `html_min`, quiero que sigan abriendo sin error tras la actualización.

**Independent Test**: Fixture de sesión con `normalizedFormat: "html_min"` carga y scope picker funciona.

**Acceptance Scenarios**:

1. **Given** sesión guardada pre-migración, **When** la abro, **Then** no crash; headings parseables.
2. **Given** nueva sesión tras update, **When** guardo y recargo, **Then** `normalizedFormat === "markdown"`.

---

### Edge Cases

- Tabla HTML simple → markdown GFM; tabla anidada/rota → filas como texto + warning.
- Enlaces `<a href>` → `[label](url)`; imágenes → `![alt](src)` o texto alt si sin src.
- Listas anidadas `<ul><li>` → `-` con indentación.
- MD con HTML embebido → `cleanupMarkdown` sin reintroducir bifurcación.
- Cloze export/import: campo `normalizedFormat` siempre `markdown` en exports nuevos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `normalizeStudyMaterial` DEBE devolver `normalized_format: "markdown"` para **todos** los formatos v1 (`pdf`, `html`, `txt`, `md`).
- **FR-002**: El pipeline `normalizeDocumentStructure` DEBE usar `emit-markdown` para HTML; `emit-html-min` queda fuera del camino activo.
- **FR-003**: La extracción HTML (`extract-html-blocks.js`) DEBE ejecutarse **antes** de emisión (sin cambio respecto a structure-inference).
- **FR-004**: `parseHeadings` DEBE usar regex markdown como camino principal; compat `html_min` solo para sesiones legacy.
- **FR-005**: `scopeTextForPhase0IA` DEBE ser identidad para contenido nuevo (markdown); mantener rama legacy para `html_min` guardado.
- **FR-006**: Migración al cargar sesión: si `normalizedFormat === "html_min"`, opcionalmente convertir a markdown en memoria o parsear dual hasta re-guardado.
- **FR-007**: Warnings nuevos: `html_structure_simplified` cuando tablas/listas no se convierten fielmente.
- **FR-008**: Tests `cursor-tests/` DEBEN cubrir HTML→markdown, regresión t18, structure-inference, scope picker, sesión legacy.
- **FR-009**: Contrato `input-normalization.md` v1 se **sustituye** por v3 (markdown-only); documentar breaking change controlado.
- **FR-010**: Sin nuevas dependencias npm; conversión HTML→MD determinística en módulo propio.

### Key Entities

- **NormalizationResult**: `normalized_format` siempre `"markdown"` en v3; `normalized_content` string markdown.
- **LegacySessionCompat**: flag o migración para sesiones con `html_min`.
- **HtmlToMarkdownBlock**: bloque intermedio reutilizando `TextBlock[]` + `HeadingCandidate[]`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% de uploads v1 nuevos producen `normalized_format === "markdown"`.
- **SC-002**: 0 ocurrencias de tags `<h[1-6]>` o `<p>` en `normalized_content` de uploads HTML de prueba.
- **SC-003**: Regresión `20260527_t18` y `20260608_t01-structure-inference` pasan sin modificar expectativas de headings.
- **SC-004**: Sesiones legacy `html_min` en fixtures cargan con ≥1 scope option cuando tenían headings.
- **SC-005**: LOC neto del pipeline baja (eliminar `emit-html-min` del camino activo + simplificar `headings.js`).

## Assumptions

- Structure inference (`20260531`) ya desplegado en rama o mergeado.
- Slow reader no renderiza markdown rich en v1 (solo texto plano); markdown sigue siendo mejor que HTML crudo.
- Tablas complejas son raras en material de estudio; degradación aceptable con warning.
