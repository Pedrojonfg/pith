### 1. Qué construimos

Refactorizamos el subsistema de grafos de Pith (RSVP + Slow Mode) en un stack modular bajo `src/js/graph/`. Separámos la **generación pura** del grafo de la **lectura de sesión**, mejoramos el **enlace anotación → mapa argumental** con proximidad por caracteres y fallback semántico ligero (overlap de tokens), simplificamos el **layout SVG** a columnas fijas, y corregimos bugs de contrato: desbloqueo del grafo enriquecido solo al terminar Fase 3, caché de `_meta.material_graph` sin grafo derivado, y constante `LITERATURE_TERM_ID`. Eliminamos el shim legacy `slow/graph-view.js`.

### 2. Decisiones de diseño

- **Tres capas: `build.js` (puro) + `adapters.js` (I/O) + `proximity.js` (heurísticas)**  
  Elegimos inyectar inputs explícitos en `buildSlowEnrichedGraphFromInputs()` y resolver sesión solo en `adapters.js`.  
  Alternativa: seguir leyendo `dictionary`, `reader` y `phase3` desde `build.js`; se descartó porque cada test nuevo obligaba a mockear media app.  
  Trade-off: más archivos y una indirección al llamar desde producción; a cambio, tests unitarios baratos y frontera clara entre dominio y persistencia.

- **Eliminar force-lite y quedarnos con columnas fijas (#5)**  
  Elegimos layout determinista por capa (`concept → block → text/arg/term → user`).  
  Alternativa A: force simulation real sin columnas; alternativa B: híbrido actual (columnas + 48 iteraciones). Ambas se descartaron: A es más compleja; B no movía nodos en X y era coste sin beneficio visible.  
  Trade-off: aristas largas entre columnas lejanas; predecible y testeable.

- **Proximidad en dos fases: chars + token overlap (#8), no embeddings**  
  Elegimos `findNearestArgumentMapNode()` con (1) distancia ≤200 chars al ancla del nodo argumental y (2) Jaccard sobre tokens si falla la fase 1.  
  Alternativa: embeddings/cosine similarity; se descartó por coste, latencia y dependencia de API/modelo en cliente.  
  Trade-off: sigue fallando en PDFs multicolumna y argumentos muy dispersos; mejor que solo offset lineal cuando el usuario escribe palabras del argumento en la nota.

- **`resolveArgumentMapNodeAnchor` centralizado en `proximity.js`**  
  Elegimos una sola implementación compartida por grafo enriquecido y Fase 3 (`comparePhase0ToAnnotations`).  
  Alternativa: duplicar en `phase3.js`; se descartó por drift inevitable.  
  Trade-off: `phase3.js` importa desde `graph/` (acoplamiento slow→graph); aceptable porque la heurística es del dominio grafo.

- **`graphEnrichedUnlocked` solo en Finish session (#1)**  
  Elegimos activar el flag al pulsar «Finish session», no al montar Fase 3.  
  Alternativa: desbloquear al entrar en Fase 3; se descartó porque persistía/exportaba grafo parcial si el usuario abandonaba.  
  Trade-off: durante Fase 3 el grafo sigue visible vía `mode: "slow_enriched"` explícito, pero auto-export y `persistEnrichedGraph` esperan al cierre.

- **`_meta.material_graph` solo inputs (#2)**  
  Elegimos persistir `{ blockIndex, conceptInventory }` y reconstruir con `buildRsvpMaterialGraph` al montar.  
  Alternativa: cachear el objeto `graph` derivado; se descartó por invalidación silenciosa al editar bloques.  
  Trade-off: rebuild en cada vista; coste negligible frente a LLM split.

- **Eliminar `slow/graph-view.js` (#6)**  
  Elegimos un único punto de export en `graph/view.js`.  
  Alternativa: mantener re-exports indefinidamente; se descartó por deuda documentada que ya no aportaba.  
  Trade-off: cualquier import externo antiguo rompe; mitigado con tests de boot e imports en `study.js`.

- **Módulo C con botón al grafo interactivo (#7)**  
  Elegimos CTA dentro del módulo «Grafo» además del botón flotante en `#slowPhase3GraphActions`.  
  Alternativa: solo lista textual; se descartó porque satisface la expectativa sin mostrar el SVG.  
  Trade-off: duplicación de entry points; UX de descubrimiento gana.

### 3. Conceptos aplicados

- **Separación dominio / adaptador (Hexagonal / Ports & Adapters)** — `build.js` no conoce sesión; `adapters.js` traduce `session.slow`, `getScopeText`, `getSortedSessionConcepts` a DTOs planos. Aparece en `resolveEnrichedGraphInputs()` → `buildSlowEnrichedGraphFromInputs()`.

- **Inyección de dependencias vía parámetros** — Tests pasan `enrichedInputs` a `buildSessionGraph(null, { mode: "slow_enriched", enrichedInputs })` sin mocks. Aparece en `adapters.js` y `cursor-tests/20260607_t14-graph-refactor.mjs`.

- **Grafo como ADT inmutable en construcción** — `createGraphBuilder()` con `addNode`/`addEdge`, deduplicación por `Set` de ids y claves `from|to|type`. Aparece en `build.js`.

- **Layout jerárquico por capas** — Asignación a columnas discretas (`layerColumn`) en lugar de simulación física. Aparece en `canvas.js` `layoutGraph()`.

- **Heurística greedy de nearest neighbor** — Para cada anotación, el mejor nodo argumental por distancia mínima bajo umbral. Aparece en `findNearestArgumentMapNode()` fase char.

- **Similaridad de Jaccard sobre bags of tokens** — Proxy semántico barato: `|A∩B|/|A∪B|` con tokens ≥3 chars. Aparece en `textOverlapScore()` / `tokenizeForOverlap()` en `proximity.js`.

- **Cadena de resolución con fallback** — Ancla de nodo: fillable blank → búsqueda literal → keyword; match anotación: char → text overlap. Aparece en `resolveArgumentMapNodeAnchor()` y `findNearestArgumentMapNode()`.

- **Constantes de dominio nombradas** — `LITERATURE_TERM_ID`, `CHAR_PROXIMITY_CHARS`, `MIN_TEXT_OVERLAP_SCORE` evitan magic strings. Aparece en `ids.js` y `proximity.js`.

- **State machine / feature flag** — `graphEnrichedUnlocked` gobierna auto-selección en `buildSessionGraph(mode: "auto")` y persistencia en `persistEnrichedGraph`. Aparece en `study.js` (Finish) y `view.js`.

- **Observer / event delegation** — Handlers de grafo en `wireMaterialGraphHandlers` con `#slowPhase3ModuleCGraphBtn`. Aparece en `study.js`.

### 4. Deuda técnica y mejoras

**Bien hecho**
- Frontera testeable entre pure build y session adapters.
- Layout predecible; tests de determinismo en columnas.
- Proximidad con fallback de texto mejora casos reales sin LLM.
- Eliminación del shim `graph-view.js` y suite de ~319 tests pasando.

**Chapuza funcional**
- `graphTermSlug` en `ids.js` duplica lógica de `slugGraphTermId` en `phase0.js`; conviene unificar.
- `onResolveMiss` hace `console.warn` en producción sin telemetría estructurada; difícil auditar grafos incompletos en campo.
- Módulo C y `#slowPhase3GraphActions` abren el mismo grafo por dos caminos; podría extraerse un helper `openEnrichedGraphFromPhase3()`.

**No escalaría**
- Token overlap como “semántica” colapsa con sinónimos, otro idioma, o notas muy cortas (“no”).
- `CHAR_PROXIMITY_CHARS = 200` sigue siendo arbitrario; textos con mucho padding HTML o columnas PDF seguirán fallando hasta embeddings o anclas explícitas (`graphLinks` hacia `arg:P1`).
- `buildClozeEpistemicGraph` sigue leyendo `session.cloze` directamente en `build.js` mientras Slow/RSVP ya están desacoplados; inconsistencia arquitectónica.
- `resolveEnrichedGraphInputs(null, overrides)` funciona para tests pero la API admite estados raros; un tipo/validación explícita reduciría errores.

**Próximo paso obvio (#8 fase 2)**  
Embedding offline o en servidor del snippet de anotación vs texto de nodos argumentales, con `graphLinks` explícitos como override absoluto.

### 5. Preguntas de consolidación

1. Si el usuario edita `blockIndex` después de confirmar bloques, ¿qué caminos de código reconstruyen el grafo RSVP y cuáles podrían seguir sirviendo datos obsoletos de `state.materialGraphContext`?

2. ¿En qué orden se resuelve un enlace anotación→argumento cuando hay `graphLinks` explícitos, proximidad char ≤200, y overlap de tokens alto pero en un nodo distinto al más cercano en el texto?

3. ¿Qué comportamientos quedan gated por `graphEnrichedUnlocked` frente a los que solo requieren `mode: "slow_enriched"` explícito (persistencia, export automático, dispatcher `auto`)?

### 6. Actualización sugerida para .cursorrules

1. **Grafos:** Toda lógica de construcción de nodos/aristas va en `src/js/graph/build.js` (pura). Lectura de sesión/diccionario/reader solo en `graph/adapters.js`. No reintroducir imports de app en `build.js`.

2. **Persistencia de sesión:** En `_meta.*` guardar solo inputs serializables (p. ej. `blockIndex`, `conceptInventory`), nunca estructuras derivadas como `graph` precomputado.

3. **Feature flags Slow Mode:** Flags de desbloqueo (`graphEnrichedUnlocked`, etc.) se activan en transiciones de fase completadas (p. ej. Finish), no al montar pantallas intermedias — salvo vista explícita con `mode` forzado.
