# SPEC: `20260609-doc-hierarchy-index`

**Feature**: Pre-indexación jerárquica del documento  
**Estado**: Draft  
**Prioridad**: Media — mejora infraestructura compartida  
**Depende de**: `20260532-markdown-canonical` (el texto ya está en markdown antes de llegar aquí)  
**Alimenta**: `20260534-section-detection-impr`, scope picker, paginación Slow Mode, Fase 0 map-reduce

---

## El problema

La normalización actual convierte el documento a markdown lineal, y a partir de ahí cada módulo intenta adivinar la estructura por su cuenta:

- El **scope picker** de Slow Mode usa heurísticas de headings (`#`, `##`) y font size del PDF
- La **paginación** de Fase 1 corta por viewport sin respetar fronteras argumentales
- El **chunking de Fase 0** (map-reduce en docs ≥60k chars) divide el texto en trozos arbitrarios de N caracteres, sin saber si está cortando a mitad de un argumento
- El **grafo de Fase 0** genera nodos `arg:P1/P2/C` sin anclaje estructural al documento

En textos filosóficos o papers sin headings claros (que son exactamente el caso de uso de Slow Mode), todo esto falla o es impreciso.

---

## La solución: una sola llamada LLM barata al inicio

Después de normalizar el documento a markdown, y **antes** de que el usuario elija modo, hacer **una única llamada LLM ligera** que devuelva el árbol jerárquico del documento: secciones, subsecciones, sus posiciones exactas en el texto, y un resumen de 1 frase por sección.

Este árbol se guarda en sesión como `docHierarchy` y todos los módulos lo consumen. Nadie vuelve a inferir estructura por su cuenta.

### Analogía

Antes de estudiar un libro, haces un índice en el margen. No con heurísticas — lo lees y lo escribes. Todos tus marcadores, esquemas y resúmenes posteriores apuntan a ese índice. Eso es exactamente esto.

---

## Schema del árbol (`HierarchyNode`)

```json
{
  "title": "La voluntad de poder como crítica al nihilismo",
  "level": 1,
  "startOffset": 0,
  "endOffset": 4821,
  "summary": "Nietzsche introduce la voluntad de poder como respuesta a la crisis de valores del siglo XIX.",
  "children": [
    {
      "title": "El diagnóstico: nihilismo reactivo",
      "level": 2,
      "startOffset": 412,
      "endOffset": 1830,
      "summary": "Distinción entre nihilismo activo y pasivo.",
      "children": []
    }
  ]
}
```

**Campos obligatorios**: `title`, `level`, `startOffset`, `endOffset`  
**Campos opcionales**: `summary` (solo si doc ≥ 8k chars), `children`

`startOffset` y `endOffset` son posiciones en caracteres en el **markdown canónico** almacenado en sesión. El texto de cualquier sección es exactamente `markdownText.slice(startOffset, endOffset)`.

### Schema raíz en sesión

```js
session.docHierarchy = {
  generatedAt: Date.now(),
  method: 'llm' | 'deterministic' | 'trivial',
  textHash: 'xxxx',    // hash del markdown, para cache
  tree: HierarchyNode[]
}
```

---

## Cuándo ejecutar (y cuándo no)

| Condición | Comportamiento |
|-----------|----------------|
| Markdown tiene headings `#`/`##` | Modo **determinístico**: parsear sin LLM |
| Markdown ≥ 3000 chars, sin headings | Modo **LLM**: una llamada al inicio |
| Markdown < 3000 chars | Modo **trivial**: árbol de una sola sección |
| LLM no disponible (sin API key) | Fallback a heurísticas actuales |
| Hash del texto ya en cache | No llama al LLM, usa cache |

El modo determinístico es O(n) y síncrono. El modo LLM añade ~1-3s de latencia — se gestiona con loading state en el scope picker, no bloqueando la UI.

---

## Prompt LLM (diseño)

**Modelo**: el mismo configurado por el usuario (Gemini/DeepSeek)  
**Temperatura**: 0 (queremos estructura, no creatividad)  
**Max tokens**: 2000 (el árbol en JSON es compacto)

```
Eres un analizador estructural de textos académicos.
Dado el siguiente texto en markdown, genera un árbol jerárquico de sus secciones.

REGLAS ESTRICTAS:
- Responde SOLO con JSON válido, sin markdown, sin explicaciones.
- startOffset y endOffset son posiciones en caracteres del texto original.
  startOffset del primer nodo raíz = 0.
  endOffset del último nodo raíz = longitud total del texto.
- Los rangos de nodos hermanos no se solapan y son contiguos.
- level 1 = sección principal, level 2 = subsección, máximo level 3.
- Si el texto no tiene estructura clara, devuelve un solo nodo raíz con el título inferido del contenido.
- summary: 1 frase, máx 15 palabras, en el idioma del texto.

TEXTO (longitud: {N} chars):
{texto}

RESPUESTA (solo JSON):
```

### Validación post-LLM obligatoria

Antes de guardar en sesión, validar:
1. `startOffset` y `endOffset` son números enteros dentro de `[0, textLength]`
2. Los rangos de hermanos no se solapan
3. El árbol tiene al menos un nodo
4. Si falla cualquier validación → fallback a modo determinístico

---

## Módulos afectados

### NUEVO: `src/js/normalization/hierarchy.js`

Función pura, sin efectos secundarios, sin acceso a sesión.

```js
// Exports principales:
export async function buildDocumentHierarchy(markdownText, llmFn, options = {})
// → HierarchyNode[]

export function buildDeterministicHierarchy(markdownText)
// → HierarchyNode[]  (parsea headings # sin LLM)

export function buildTrivialHierarchy(markdownText)
// → HierarchyNode[]  (una sola sección)

export function validateHierarchy(tree, textLength)
// → { valid: boolean, errors: string[] }

export function flattenHierarchy(tree)
// → HierarchyNode[]  (BFS, útil para scope picker y chunks)

export function getChunksFromHierarchy(tree, maxChunkSize = 12000)
// → { title, text, startOffset, endOffset }[]
// Fusiona secciones pequeñas, divide secciones enormes — preservando fronteras
```

### NUEVO: `src/js/normalization/hierarchy-cache.js`

```js
export function hashText(text)
// → string (hash ligero, no criptográfico)

export function getCachedHierarchy(textHash)
// → HierarchyNode[] | null

export function setCachedHierarchy(textHash, tree)
// Guarda en localStorage['pith_hierarchy_{hash}']
// TTL: 7 días
// Límite: máx 20 entradas (LRU eviction)
```

### MODIFICADO: `src/js/input-normalization.js`

Añadir paso final en el pipeline de normalización:

```js
// Al terminar normalización a markdown:
const hierarchy = await buildDocumentHierarchy(markdownText, llm, { useCache: true })
session.docHierarchy = hierarchy
```

Si LLM no disponible en este punto, marcar `session.docHierarchy = null` y los módulos downstream usan sus fallbacks actuales.

### MODIFICADO: `src/js/slow/scope.js` (scope picker)

**Antes**: lista de secciones inferida por heurísticas de headings  
**Después**: lista de secciones desde `session.docHierarchy.tree` (flattenHierarchy nivel 1 y 2)

El scope picker muestra el árbol real. El usuario ve exactamente la estructura del documento.

Si `session.docHierarchy === null` → comportamiento actual (fallback).

### MODIFICADO: Paginación Slow Mode (`src/js/slow/reader.js` o equivalente)

Al calcular cortes de página, **preferir** `startOffset` de secciones del árbol como puntos de corte naturales, en lugar de cortar al llegar al límite del viewport.

Regla: si hay un `startOffset` de sección dentro de ±200 chars del corte natural → usar ese offset como corte.

### MODIFICADO: Map-reduce Fase 0 (`src/js/slow/phase0.js`)

**Antes**: chunks de N chars arbitrarios  
**Después**: `getChunksFromHierarchy(tree, maxChunkSize)` — chunks que respetan fronteras de sección

Esto mejora la calidad del mapa argumental generado en Fase 0 porque el LLM recibe "Sección: Epistemología kantiana (pp. 3-8)" en lugar de un blob de texto sin contexto.

El prompt de Fase 0 recibe además el árbol completo como contexto: el LLM ya sabe qué estructura tiene el documento antes de analizarlo.

### MODIFICADO: `src/js/session.js`

Añadir `docHierarchy` al schema de sesión con valor por defecto `null`. Compatible hacia atrás (sesiones antiguas sin este campo funcionan igual).

---

## ROADMAP

### T01 — `hierarchy.js`: funciones puras

Implementar `buildDeterministicHierarchy`, `buildTrivialHierarchy`, `validateHierarchy`, `flattenHierarchy`, `getChunksFromHierarchy`.

Sin LLM todavía. Tests primero.

**Criterio de done**: tests pasando para los 3 modos (determinístico, trivial, validación).

---

### T02 — Prompt y llamada LLM

Implementar `buildDocumentHierarchy` completa con la llamada LLM:
- Prompt del diseño anterior
- Parsing del JSON de respuesta (con strip de backticks)
- Validación post-LLM con `validateHierarchy`
- Fallback automático a `buildDeterministicHierarchy` si falla

**Criterio de done**: dado un paper sin headings, devuelve árbol con offsets correctos (verificable con `text.slice(node.startOffset, node.endOffset)`).

---

### T03 — Cache

Implementar `hierarchy-cache.js`. Integrar en `buildDocumentHierarchy` con flag `useCache`.

**Criterio de done**: segunda llamada con mismo texto no hace llamada LLM (verificable mockeando el LLM).

---

### T04 — Integración en `input-normalization.js`

Llamar a `buildDocumentHierarchy` al final del pipeline. Guardar en sesión. Loading state en UI mientras se genera.

**Criterio de done**: `session.docHierarchy` existe y es válido después de subir cualquier documento ≥ 3000 chars.

---

### T05 — Scope picker usa árbol

Reemplazar heurísticas del scope picker por `flattenHierarchy(session.docHierarchy.tree)`.

Mantener fallback a comportamiento actual si `session.docHierarchy === null`.

**Criterio de done**: subir un paper sin headings y ver el árbol correcto en el scope picker.

---

### T06 — Paginación respeta fronteras

Modificar lógica de corte de página para preferir `startOffset` de secciones como puntos de corte.

**Criterio de done**: al paginar, las secciones no se cortan a mitad (test con documento de secciones conocidas).

---

### T07 — Chunks de Fase 0 desde árbol

Reemplazar chunking arbitrario de map-reduce por `getChunksFromHierarchy`. Pasar árbol completo como contexto al prompt de Fase 0.

**Criterio de done**: chunks generados son contiguos, no se solapan, cubren el texto completo.

---

### T08 — Tests de integración

Casos a cubrir:
- Documento con headings → modo determinístico, sin llamada LLM
- Documento sin headings ≥ 3k chars → modo LLM, árbol válido
- Documento < 3k chars → modo trivial, una sola sección
- Cache: segunda llamada con mismo hash → sin LLM
- Validación: árbol con offsets fuera de rango → falla con error descriptivo
- `getChunksFromHierarchy`: suma de chunks = texto completo (sin pérdida ni solapamiento)
- Scope picker: secciones mostradas = árbol de jerarquía
- Paginación: cortes en fronteras de sección, no a mitad

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| LLM da offsets incorrectos | Media | `validateHierarchy` estricta + fallback determinístico |
| Latencia añadida (~1-3s) | Alta | Loading state explícito; ejecución en paralelo con render de UI |
| Coste LLM extra por documento | Baja | Cache de 7 días por hash; modo determinístico para docs con headings |
| PDF multicolumna con offsets rotos | Media | El offset es del markdown normalizado, no del PDF original — el PDF ya se procesó |
| Secciones filosóficas sin título claro | Media | El LLM infiere un título del contenido; caso de una sola sección raíz es válido |

---

## Lo que NO hace esta feature

- No reemplaza el grafo epistémico (son capas distintas: este es estructura, el grafo es semántica)
- No modifica la normalización PDF→markdown (eso es `structure-inference`)
- No afecta a RSVP ni Cloze (no tienen scope picker ni paginación argumental)
- No añade embeddings ni búsqueda vectorial

---

## Estimación

| Tarea | Tiempo estimado |
|-------|----------------|
| T01–T02 (funciones puras + LLM) | 1 día |
| T03 (cache) | 2h |
| T04 (integración normalización) | 2h |
| T05 (scope picker) | 3h |
| T06–T07 (paginación + chunks Fase 0) | 1 día |
| T08 (tests integración) | 3h |
| **Total** | **~2.5 días** |

---

## Criterio global de done

Dado un paper filosófico de 40 páginas sin headings explícitos:
1. Al subirlo, aparece un loading state de 1-3s
2. El scope picker muestra la estructura real del texto (no heurísticas)
3. La Fase 1 no corta argumentos a mitad de página
4. La Fase 0 genera un mapa argumental más preciso porque sus chunks coinciden con secciones reales
5. Segunda subida del mismo documento: carga instantánea (cache)