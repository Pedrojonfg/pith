# Feature Specification: Document Hierarchy Pre-Index

**Feature Branch**: `20260609-doc-hierarchy-index`

**Created**: 2026-06-09

**Status**: Draft

**Input**: Pre-indexación jerárquica del documento. Tras normalizar a markdown canónico, generar un árbol de secciones (determinístico, trivial o LLM) con offsets exactos en `normalizedTextFull`, persistido como `session.docHierarchy` y consumido por scope picker, paginación Slow Mode y map-reduce de Fase 0.

**Depende de**: `20260532-markdown-canonical` (texto en markdown antes de llegar aquí)

**Alimenta**: `20260534-section-detection-impr`, scope picker, paginación Slow Mode, Fase 0 map-reduce

**Prioridad**: Media — infraestructura compartida

## User Scenarios & Testing

### User Story 1 — Paper sin headings (Priority: P1)

Como estudiante que sube un paper filosófico sin `#`/`##`, quiero que el sistema infiera la estructura real del texto una sola vez al subirlo, para elegir un capítulo en el scope picker sin heurísticas rotas.

**Why this priority**: Caso de uso principal de Slow Mode; sin esto el scope picker falla en textos sin estructura explícita.

**Independent Test**: Subir TXT ≥3000 chars sin headings; verificar `session.docHierarchy.method === 'llm'` y árbol con offsets válidos.

**Acceptance Scenarios**:

1. **Given** markdown ≥3000 chars sin headings y API key configurada, **When** termina la normalización, **Then** `docHierarchy.tree` tiene ≥1 nodo y `text.slice(startOffset, endOffset)` coincide con el título inferido.
2. **Given** el mismo documento subido de nuevo, **When** el hash coincide con cache, **Then** no hay segunda llamada LLM.

---

### User Story 2 — Documento con headings (Priority: P1)

Como estudiante con un libro ya estructurado en markdown, quiero indexación instantánea sin coste LLM.

**Acceptance**: Markdown con `#`/`##` → `method: 'deterministic'`; sin llamada LLM; árbol parseado de headings.

---

### User Story 3 — Fase 0 map-reduce respeta secciones (Priority: P2)

Como sistema, debo partir documentos ≥60k chars en chunks alineados a fronteras de sección para mejorar el mapa argumental.

**Acceptance**: `getChunksFromHierarchy` cubre el texto completo sin solapamiento; chunks ≤ `PHASE0_MAX_CHUNK_CHARS`.

---

### User Story 4 — Paginación no corta argumentos (Priority: P2)

Como lector en Fase 1, quiero que los cortes de página prefieran inicios de sección cuando están cerca del límite del viewport.

**Acceptance**: Con documento de secciones conocidas, cortes de página dentro de ±200 chars de `startOffset` de sección.

---

### Edge Cases

- Markdown < 3000 chars → árbol trivial de una sola sección (`method: 'trivial'`)
- Sin API key → `docHierarchy = null`; módulos downstream usan fallbacks actuales
- LLM devuelve offsets inválidos → fallback a `buildDeterministicHierarchy`
- Sesiones antiguas sin `docHierarchy` → campo `null`; comportamiento actual intacto
- PDF multicolumna → offsets son del markdown normalizado, no del PDF original

## Requirements

### Functional Requirements

- **FR-001**: Tras normalización a markdown, el sistema MUST generar `session.docHierarchy` con `{ generatedAt, method, textHash, tree }`
- **FR-002**: Si markdown tiene headings `#`/`##`, MUST usar modo determinístico sin LLM
- **FR-003**: Si markdown ≥3000 chars sin headings y LLM disponible, MUST usar una llamada LLM (temp 0, max 2000 tokens)
- **FR-004**: Si markdown <3000 chars, MUST usar modo trivial (un solo nodo raíz)
- **FR-005**: `validateHierarchy` MUST rechazar árboles con offsets fuera de `[0, textLength]`, hermanos solapados o árbol vacío
- **FR-006**: Tras fallo de validación LLM, MUST fallback a modo determinístico
- **FR-007**: Cache MUST persistir por `textHash` en localStorage (TTL 7 días, máx 20 entradas LRU)
- **FR-008**: Scope picker MUST usar `flattenHierarchy(tree)` niveles 1–2 cuando `docHierarchy` existe
- **FR-009**: Paginación MUST preferir `startOffset` de sección dentro de ±200 chars del corte natural
- **FR-010**: Map-reduce Fase 0 MUST usar `getChunksFromHierarchy` en lugar de chunks arbitrarios por caracteres
- **FR-011**: Prompt Fase 0 MUST recibir el árbol completo como contexto estructural

### Key Entities

- **HierarchyNode**: `{ title, level, startOffset, endOffset, summary?, children[] }`
- **DocHierarchy**: `{ generatedAt, method: 'llm'|'deterministic'|'trivial', textHash, tree: HierarchyNode[] }`
- **HierarchyChunk**: `{ title, text, startOffset, endOffset }` — salida de `getChunksFromHierarchy`

### Out of Scope

- No reemplaza el grafo epistémico de Fase 0
- No modifica PDF→markdown (`structure-inference`)
- No afecta RSVP ni Cloze
- No embeddings ni búsqueda vectorial

## Success Criteria

### Measurable Outcomes

- **SC-001**: Paper filosófico ~40 págs sin headings → loading 1–3s, scope picker muestra estructura inferida
- **SC-002**: Documento con headings → indexación síncrona, cero llamadas LLM
- **SC-003**: Segunda subida del mismo documento → carga desde cache sin LLM
- **SC-004**: `getChunksFromHierarchy`: suma de chunks = longitud del texto, sin solapamiento
- **SC-005**: Paginación: secciones no cortadas a mitad en fixture de regresión
- **SC-006**: Fase 0 map-reduce recibe títulos de sección en cada chunk

## Assumptions

- Markdown canónico ya disponible en sesión tras `normalizeStudyMaterial`
- Modelo LLM = el configurado por el usuario (DeepSeek/Gemini vía `llm.js`)
- `summary` en nodos solo si documento ≥8000 chars
- Máximo `level` 3 en árbol LLM
- Scope picker actual vive en `slow/headings.js` (`buildScopeOptions`), no archivo `scope.js` separado
