# Spec: Mejoras en detección de secciones y normalización de documentos

**Módulos afectados:** `input-normalization.js`, `extract-pdf-blocks.js`, `strip-artifacts.js`,
`infer-headings.js`, `pdf-outline.js`, `emit-markdown.js`, `slow/headings.js`
**Prioridad global:** P0 (el scope picker produce resultados incorrectos en PDFs reales)
**Motivación:** Test con *Primates y Filósofos* (De Waal) reveló 5 clases de fallos en capas distintas.

---

## Índice

1. [Root cause analysis](#1-root-cause-analysis)
2. [FIX-01 · Normalización de texto en `matchOutlineToBlocks`](#fix-01--normalización-de-texto-en-matchoutlinetoblocks)
3. [FIX-02 · Detección y skip de front matter](#fix-02--detección-y-skip-de-front-matter)
4. [FIX-03 · Short-circuit cuando outline cubre ≥ 80 % del documento](#fix-03--short-circuit-cuando-outline-cubre--80--del-documento)
5. [FIX-04 · Filtro de secciones mínimas en `buildScopeOptions`](#fix-04--filtro-de-secciones-mínimas-en-buildscopeoptions)
6. [FIX-05 · Artefactos no capturados en `strip-artifacts.js`](#fix-05--artefactos-no-capturados-en-strip-artifactsjs)
7. [FIX-06 · Detección de layout multi-columna](#fix-06--detección-de-layout-multi-columna)
8. [FIX-07 · Dehiphenation post-extracción](#fix-07--dehiphenation-post-extracción)
9. [FIX-08 · Scope picker jerárquico (UX)](#fix-08--scope-picker-jerárquico-ux)
10. [FIX-09 · Feedback manual desde el scope picker](#fix-09--feedback-manual-desde-el-scope-picker)
11. [FIX-10 · Warning `low_heading_confidence` accionable](#fix-10--warning-low_heading_confidence-accionable)
12. [Tabla de cambios por archivo](#tabla-de-cambios-por-archivo)
13. [Criterios de aceptación de regresión](#criterios-de-aceptación-de-regresión)

---

## 1. Root cause analysis

El test reveló el siguiente árbol de fallos causales. Los nodos más profundos son los que hay que corregir.

```
Scope picker muestra secciones incorrectas
├── (A) Outline existe pero matchOutlineToBlocks falla
│   └── pdf.js extrae "Introducci6n"; outline tiene "Introducción"
│       └── comparación de texto no normaliza diacríticos ni encoding
│
├── (B) Páginas de front matter (1–9) generan headings falsos
│   ├── "ATE" (12 chars) — fragmento de portada
│   ├── "~II~" (14 chars) — ornamento tipográfico
│   └── strip-artifacts no cubre ornamentos ni texto muy corto sin contenido
│
├── (C) Sin short-circuit: heurística corre aunque outline matchee todo
│   └── produce headings duplicados / degradados después de outline entries
│
├── (D) buildScopeOptions no filtra secciones de < N chars
│   └── usuario ve opciones de 12 chars en el selector
│
├── (E) Layout bicolumna en páginas de créditos/TOC
│   └── pdf.js agrupa glyphs por Y → mezcla columnas → texto incoherente
│
└── (F) Palabras partidas con guión (menor, no afecta scope detection)
    └── "intrinseca-\nmente" queda roto en texto normalizado
```

La causa raíz dominante es **(A)**: el PDF tiene una estructura de bookmarks perfecta (nivel 1/2, 19 entradas, páginas exactas), pero el fallo silencioso en el match hace que todo caiga a heurística de scoring sobre texto con encoding corrupto.

---

## FIX-01 · Normalización de texto en `matchOutlineToBlocks`

**Archivo:** `pdf-outline.js`
**Severidad:** P0 — bloquea el flujo principal para PDFs con Custom encoding

### Problema

El outline del PDF contiene títulos con Unicode correcto: `"Introducción"`.
pdf.js extrae el mismo bloque como `"Introducci6n"` (ó → 6, Custom font encoding).

La función de similitud compara strings distintos; si cae por debajo del umbral 50, el outline entry queda sin match y se descarta silenciosamente.

### Cambio requerido

Añadir una función `normalizeForComparison(str)` que se aplique a **ambos lados** de la comparación antes del cálculo de score:

```js
// pdf-outline.js

/**
 * Normaliza un string para comparación tolerante:
 * - lowercase
 * - NFD + elimina diacríticos
 * - colapsa espacios
 * - elimina puntuación final
 * - sustituye dígitos ambiguos por sus diacríticos más comunes
 */
function normalizeForComparison(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')       // quita combining marks
    .replace(/[^\w\s]/g, ' ')              // puntuación → espacio
    .replace(/\s+/g, ' ')
    .trim();
}

// Tabla de sustituciones para encoding corruption conocida
const ENCODING_FIXUPS = {
  '6': ['o', 'ó'],   // ó → 6 es el caso documentado
  '0': ['o', 'ó'],
  '1': ['i', 'l'],
};

function applyEncodingFixups(str) {
  // Genera candidatos con los dígitos reemplazados
  // Solo si el string contiene dígitos en posición de vocal
  return str.replace(/[016]/g, ch => ENCODING_FIXUPS[ch]?.[0] ?? ch);
}

function matchScore(outlineTitle, blockText) {
  const normOutline = normalizeForComparison(outlineTitle);
  const normBlock   = normalizeForComparison(applyEncodingFixups(blockText));
  return similarity(normOutline, normBlock); // función existente
}
```

Adicionalmente, si `matchScore` sigue < 50 tras la normalización completa, intentar una comparación de prefijo de 15 chars (útil cuando el bloque contiene solo el inicio del título porque el resto está en la siguiente línea):

```js
function matchScoreFallback(outlineTitle, blockText) {
  const prefix = normalizeForComparison(outlineTitle).slice(0, 15);
  const norm   = normalizeForComparison(applyEncodingFixups(blockText));
  return norm.startsWith(prefix) ? 60 : 0;
}
```

### Criterio de aceptación

Con *Primates y Filósofos*:
- Todas las 19 entradas del outline deben matchear con `source: "outline"`.
- `normalizedTextFull` no debe contener ningún heading con texto `"6n"` o `"0n"` donde debería haber `"ón"`.

---

## FIX-02 · Detección y skip de front matter

**Archivo:** `extract-pdf-blocks.js` + nuevo `front-matter-detector.js`
**Severidad:** P0 — fuente directa de secciones basura en el scope picker

### Problema

Las páginas 1–N de front matter (portada, contraportada, créditos, tabla de contenidos) generan bloques con texto muy corto, ornamentos tipográficos y fragmentos de layout que superan el umbral de scoring heurístico y aparecen como secciones.

### Cambio requerido

**Estrategia A (si hay outline):** trivial — las páginas anteriores al `pageNumber` de la primera entrada de outline con `level === 1` y sin `kind: "preliminary"` (Agradecimientos, Introducción) se marcan como `isFrontMatter: true`. Ningún bloque de esas páginas entra en la inferencia.

```js
// infer-headings.js

function getFrontMatterPageRange(outline) {
  const SKIP_TITLES = /cubierta|portada|datos|sumario|contracubierta/i;
  const firstContentPage = outline
    .filter(e => !SKIP_TITLES.test(e.title))
    .sort((a, b) => a.page - b.page)[0]?.page ?? 0;
  return { skip: firstContentPage - 1 }; // páginas 0-indexed a ignorar
}
```

**Estrategia B (si no hay outline):** heurística basada en densidad de texto.
Un `FrontMatterDetector` analiza las primeras 15 páginas del PDF y marca como front matter aquellas donde:
- `totalChars / pageArea < 0.05` (página casi vacía o solo título)
- O la proporción de bloques cortos (< 20 chars) supera el 60 %

```js
// front-matter-detector.js
export function detectFrontMatterPages(blocks, totalPages) {
  const pageStats = groupByPage(blocks).map(page => ({
    pageIndex: page.index,
    totalChars: page.blocks.reduce((s, b) => s + b.text.length, 0),
    shortBlockRatio: page.blocks.filter(b => b.text.length < 20).length
                     / Math.max(page.blocks.length, 1),
  }));

  // Solo mirar las primeras 15 páginas como candidatas
  const candidates = pageStats.slice(0, 15);
  let lastFrontMatterPage = -1;

  for (const p of candidates) {
    const isSparse = p.totalChars < 300 || p.shortBlockRatio > 0.6;
    if (isSparse) lastFrontMatterPage = p.pageIndex;
    else break; // en cuanto aparece una página densa, paramos
  }

  return lastFrontMatterPage; // inclusive
}
```

**Integración:**

```js
// infer-headings.js — al inicio del pipeline
const frontMatterEnd = outline.length > 0
  ? getFrontMatterPageRange(outline).skip
  : detectFrontMatterPages(blocks, totalPages);

const contentBlocks = blocks.filter(b => b.pageIndex > frontMatterEnd);
```

### Criterio de aceptación

- Ningún bloque de páginas 1–9 de *Primates y Filósofos* debe aparecer como heading.
- El scope picker no debe mostrar opciones "ATE", "~II~", "PAIDOS", ni ninguna sección < 100 chars proveniente de front matter.

---

## FIX-03 · Short-circuit cuando outline cubre ≥ 80 % del documento

**Archivo:** `infer-headings.js`
**Severidad:** P1 — produce headings duplicados y degrada la jerarquía

### Problema

Cuando el outline matchea todas sus entradas, `scoreBlock()` sigue ejecutándose sobre todos los bloques restantes. Esto puede:
- Crear headings espurios en el cuerpo del texto (citas en mayúsculas, nombres propios en negrita).
- Generar duplicados si un bloque outline también puntúa > 35 en la heurística.

### Cambio requerido

Calcular cobertura de outline tras `matchOutlineToBlocks`:

```js
// infer-headings.js

const outlineMatches = matchOutlineToBlocks(outline, blocks);
const outlineCoverage = outlineMatches.length / outline.length;

let headings;
if (outlineCoverage >= 0.8) {
  // Outline cubre el documento — solo pulir jerarquía, no scoring heurístico
  headings = outlineMatches.map(m => ({
    ...m,
    source: 'outline',
    level: m.outlineLevel,
  }));
  // Aun así correr validateHeadingHierarchy
} else {
  // Outline parcial o ausente — heurística completa
  headings = scoreAllBlocks(blocks, outlineMatches);
}
```

Para PDFs sin outline, la heurística sigue igual. Para PDFs con outline parcial (cobertura 40–79 %), se puede opcionalmente deshabilitar la heurística en páginas que ya tienen un outline match, evitando duplicados locales.

### Criterio de aceptación

- Con outline coverage = 100 %, `infer-headings.js` no debe generar ningún heading con `source: "heuristic"`.
- `normalizedTextFull` para *Primates y Filósofos* debe contener exactamente 19 headings, sin más.

---

## FIX-04 · Filtro de secciones mínimas en `buildScopeOptions`

**Archivo:** `slow/headings.js`
**Severidad:** P1 — UX directamente rota

### Problema

`buildScopeOptions` crea una opción por cada heading sin importar cuánto contenido hay entre él y el siguiente. El usuario ve opciones de 12 o 18 chars que no tienen contenido útil.

### Cambio requerido

```js
// slow/headings.js

const MIN_SCOPE_CHARS = 200; // umbral mínimo para aparecer en el selector

export function buildScopeOptions(headings, fullText) {
  const options = [{ label: 'Full document', start: 0, end: fullText.length }];

  for (let i = 0; i < headings.length; i++) {
    const h      = headings[i];
    const end    = headings[i + 1]?.charStart ?? fullText.length;
    const length = end - h.charStart;

    if (length < MIN_SCOPE_CHARS) continue; // ← nuevo filtro

    options.push({
      label:    h.label,
      level:    h.level,
      start:    h.charStart,
      end,
      charCount: length,
    });
  }

  return options;
}
```

`MIN_SCOPE_CHARS` debe ser configurable por tipo de documento (libros: 500, papers: 200).

### Criterio de aceptación

- Ninguna opción del scope picker tiene `charCount < MIN_SCOPE_CHARS`.
- "Full document" siempre aparece como primera opción independientemente del filtro.

---

## FIX-05 · Artefactos no capturados en `strip-artifacts.js`

**Archivo:** `strip-artifacts.js`
**Severidad:** P1

### Problema

Los patrones actuales no cubren:

| Artefacto | Ejemplo | Por qué escapa |
|-----------|---------|----------------|
| Ornamentos tipográficos | `~II~`, `• • •`, `— — —` | No son número de página ni marca editorial |
| Texto de portada/contraportada | `PAIDOS`, `Barcelona` | Sin zona header/footer en PDF de portada (ocupa toda la página) |
| Líneas de separación | `•• ••` | No encajan en regex existentes |

### Cambio requerido

Añadir a `strip-artifacts.js`:

```js
// Ornamentos: líneas compuestas solo de símbolos no alfanuméricos
const ORNAMENT_PATTERN = /^[\s\W]{1,20}$/u;

// Texto de una sola palabra en mayúsculas sin contexto de heading
// (solo se elimina si pageIndex <= frontMatterEnd)
const ISOLATED_ALLCAPS = /^[A-ZÁÉÍÓÚÑÜ]{3,15}$/;

function isArtifact(block, frontMatterEnd) {
  if (ORNAMENT_PATTERN.test(block.text)) return true;
  if (block.pageIndex <= frontMatterEnd && ISOLATED_ALLCAPS.test(block.text.trim())) return true;
  return false;
}
```

Integrar en el loop existente antes del scoring:

```js
if (isArtifact(block, frontMatterEnd)) {
  block.kind = 'artifact';
  continue;
}
```

### Criterio de aceptación

Los bloques `~II~`, `•• ••`, `PAIDOS`, `ATE` deben tener `kind: "artifact"` tras `strip-artifacts.js` y no aparecer en `normalizedTextFull`.

---

## FIX-06 · Detección de layout multi-columna

**Archivo:** `extract-pdf-blocks.js`
**Severidad:** P2 — afecta calidad del texto, no solo headings

### Problema

`extract-pdf-blocks.js` agrupa glyphs por Y con tolerancia 2px. En un layout bicolumna, glyphs de la columna izquierda y derecha que comparten la misma coordenada Y se concatenan en el mismo bloque, produciendo texto incoherente como:

```
"Quedan rigurosamente prohibidas Agradecimientos . . . . . . 9"
```

### Cambio requerido

Detectar distribución bimodal de X-coords antes de agrupar:

```js
// extract-pdf-blocks.js

function detectColumnLayout(items) {
  const xMids = items.map(i => i.transform[4] + i.width / 2);
  const sorted = [...xMids].sort((a, b) => a - b);
  const pageWidth = Math.max(...items.map(i => i.transform[4] + i.width));

  // Buscar gap de > 8% del ancho de página en la zona central (40–60%)
  const center = pageWidth / 2;
  const centralGap = sorted.find((x, i) =>
    x > pageWidth * 0.4 &&
    x < pageWidth * 0.6 &&
    sorted[i + 1] - x > pageWidth * 0.08
  );

  return centralGap != null ? { columns: 2, splitX: centralGap } : { columns: 1 };
}

function groupGlyphsIntoLines(items, pageWidth) {
  const layout = detectColumnLayout(items);

  if (layout.columns === 2) {
    const leftItems  = items.filter(i => i.transform[4] < layout.splitX);
    const rightItems = items.filter(i => i.transform[4] >= layout.splitX);
    return [
      ...groupByY(leftItems),
      ...groupByY(rightItems),
    ].sort((a, b) => b.y - a.y); // reordenar por Y descendente
  }

  return groupByY(items);
}
```

Para páginas de front matter (ya descartadas por FIX-02), este fix es irrelevante pero no causa daño. El impacto real es en PDFs académicos con cuerpo bicolumna.

### Criterio de aceptación

- En páginas con layout bicolumna, cada columna genera bloques separados y ordenados correctamente de arriba a abajo.
- El texto de la columna izquierda no contiene palabras de la columna derecha intercaladas.

---

## FIX-07 · Dehiphenation post-extracción

**Archivo:** `input-normalization.js` (fase de post-proceso)
**Severidad:** P2 — afecta calidad del texto para estudio

### Problema

pdf.js preserva saltos de línea incluyendo guiones de silabeo. Palabras como `"intrinseca-\nmente"` quedan partidas en `normalizedTextFull`, lo que afecta búsqueda, cloze deletion y AI context.

### Cambio requerido

Post-proceso después de `emitMarkdown`, antes de guardar `normalizedTextFull`:

```js
// emit-markdown.js o input-normalization.js

function dehyphenate(text) {
  // Caso 1: guión al final de línea, continúa en siguiente con minúscula
  text = text.replace(/(\w)-\n([a-záéíóúüñ])/gu, '$1$2');

  // Caso 2: guión al final de línea, continúa con mayúscula (nombre propio partido — mantener guión)
  // No tocar: "Korsgaard-\nMueller" → no dehiphenar

  // Caso 3: dos newlines seguidos → párrafo, no tocar
  // Ya manejado por la regex anterior (solo afecta \n simple)

  return text;
}
```

**Importante:** solo aplicar a saltos de línea simples (`\n`), no a párrafos (`\n\n`). Ejecutar como última fase antes de `session.slow.normalizedTextFull = result`.

### Criterio de aceptación

El texto normalizado de *Primates y Filósofos* no contiene el patrón `/\w-\n[a-z]/u`.

---

## FIX-08 · Scope picker jerárquico (UX)

**Archivo:** `slow/headings.js` + `study.js` (`renderSlowScopeScreen`)
**Severidad:** P2

### Problema

`buildScopeOptions` produce una lista plana de headings. Para documentos con jerarquía L1/L2 (como libros con partes y apéndices), el selector no refleja la relación padre-hijo. El usuario ve 19 opciones al mismo nivel cuando la estructura real es 6 capítulos padre con sub-secciones.

### Cambio requerido

**En `buildScopeOptions`:** añadir `parentLabel` a cada opción:

```js
options.push({
  label,
  level: h.level,
  parentLabel: findParent(headings, i)?.label ?? null,
  start: h.charStart,
  end,
  charCount: length,
});
```

**En `renderSlowScopeScreen`:** agrupar visualmente por nivel 1, colapsando nivel 2+ por defecto:

```
◉ Full document (417k chars)
▶ Primera Parte — Seres moralmente evolucionados  (66k)
    Apéndice A — Antropomorfismo y antroponegación (9k)
    Apéndice B — ¿Tienen los simios una teoría...? (5k)
    Apéndice C — Los derechos de los animales (6k)
▶ Segunda Parte — Comentarios  (86k)
    Robert Wright — Los usos del antropomorfismo (15k)
    Christine M. Korsgaard — La moralidad y la...  (22k)
    Philip Kitcher — Ética y evolución  (24k)
    Peter Singer — Moralidad, razón y derechos (25k)
▶ Tercera Parte — Respuestas a los comentarios (24k)
```

El nivel 1 es seleccionable directamente (toca selecciona la parte completa con todas sus sub-secciones). Expand toggle muestra las L2.

**Formato de charCount:** en lugar de `(417.406 chars)`, mostrar `(~420k)` o `(~65 págs estimadas)` para reducir carga cognitiva.

### Criterio de aceptación

- El scope picker muestra secciones L1 agrupando sus L2 subordinadas.
- Seleccionar una L1 cubre su rango completo incluyendo las L2 hijas.
- El tamaño se muestra en formato legible (K, M), no en chars exactos.

---

## FIX-09 · Feedback manual desde el scope picker

**Archivo:** `slow/headings.js` + `study.js`
**Severidad:** P3 — calidad de vida, no bloqueante

### Problema

Cuando la detección automática produce resultados incorrectos (incluso después de los fixes anteriores), el usuario no tiene mecanismo para corregirlos sin editar `normalizedTextFull` manualmente.

### Cambio requerido

Añadir modo de edición al scope picker (activable con un botón "Editar secciones"):

- **Renombrar** cualquier sección (edita el label del heading en `normalizedTextFull`).
- **Eliminar** una sección del selector (no del texto).
- **Dividir** una sección grande: el usuario introduce el texto exacto del punto de corte y se inserta un nuevo heading `##` en `normalizedTextFull`.
- **Fusionar** dos secciones consecutivas.

Las ediciones se guardan en `session.slow.headingOverrides: HeadingOverride[]` y se aplican sobre los headings parseados antes de renderizar el picker, sin modificar `normalizedTextFull` (que sería una operación destructiva).

```ts
interface HeadingOverride {
  originalCharStart: number;
  action: 'rename' | 'remove' | 'split' | 'merge';
  newLabel?: string;
  splitAt?: number; // charOffset relativo al charStart
}
```

### Criterio de aceptación

- El usuario puede renombrar y eliminar secciones desde la UI sin tocar el texto normalizado.
- Los overrides persisten en la sesión y se aplican correctamente en Fase 0 y checkpoints.

---

## FIX-10 · Warning `low_heading_confidence` accionable

**Archivo:** `infer-headings.js` + `study.js`
**Severidad:** P3

### Problema actual

Cuando `low_heading_confidence` se emite (0 headings en doc > 5k chars), el usuario solo ve un warning genérico. No puede hacer nada útil con esa información.

### Cambio requerido

Cuando `low_heading_confidence`:

1. Mostrar en la UI: *"No se detectaron secciones automáticamente. Puedes añadir divisiones manualmente o estudiar el documento completo."*
2. Activar automáticamente el modo de edición del FIX-09 para que el usuario pueda dividir el texto.
3. Opcionalmente, ofrecer *"Dividir automáticamente por longitud"*: crea N secciones de ~5k chars cada una con labels genéricos ("Sección 1", "Sección 2"…) como fallback de último recurso.

```js
if (result.warnings.includes('low_heading_confidence')) {
  result.fallbackSections = buildEqualLengthSections(
    normalizedText,
    { targetChunkSize: 5000, labelPrefix: 'Sección' }
  );
}
```

### Criterio de aceptación

- En docs con `low_heading_confidence`, el scope picker no queda vacío: muestra al menos "Full document" + secciones fallback.
- El usuario ve un mensaje explicativo, no un estado roto.

---

## Tabla de cambios por archivo

| Archivo | FIX | Tipo de cambio |
|---------|-----|----------------|
| `pdf-outline.js` | 01 | Nueva función `normalizeForComparison` + `applyEncodingFixups` + fallback por prefijo |
| `infer-headings.js` | 02, 03, 05 | `getFrontMatterPageRange`, short-circuit outline, integrar `isArtifact` |
| `front-matter-detector.js` | 02 | Nuevo módulo |
| `extract-pdf-blocks.js` | 06 | `detectColumnLayout` + `groupGlyphsIntoLines` |
| `strip-artifacts.js` | 05 | Nuevos patterns: ornamentos, isolated allcaps en front matter |
| `emit-markdown.js` | 07 | `dehyphenate` como última fase |
| `slow/headings.js` | 04, 08, 09 | `MIN_SCOPE_CHARS`, `parentLabel`, `headingOverrides` |
| `study.js` | 08, 09, 10 | Scope picker jerárquico, modo edición, fallback secciones |

---

## Criterios de aceptación de regresión

Los siguientes fixtures deben pasar tras todos los cambios:

### Fixture 1 — PDF con outline completo (*Primates y Filósofos*)
- [ ] `parseHeadings(normalizedTextFull)` devuelve exactamente 19 headings.
- [ ] Ningún heading tiene `label` que contenga el patrón `/\d{1,2}n/` (artefacto de encoding).
- [ ] Ningún heading tiene `charEnd - charStart < 200`.
- [ ] Todos los headings tienen `source: "outline"`.
- [ ] El scope picker muestra exactamente las secciones de contenido (sin portada, sumario, créditos).

### Fixture 2 — PDF sin outline pero con tipografía clara (paper académico)
- [ ] Los headings detectados tienen `source: "heuristic"` y coinciden con los títulos de sección del paper.
- [ ] `low_heading_confidence` no se emite si hay ≥ 3 secciones detectadas.

### Fixture 3 — TXT plano sin estructura
- [ ] `low_heading_confidence` se emite.
- [ ] El scope picker muestra "Full document" + secciones fallback de ~5k chars.
- [ ] No se lanza ninguna excepción en el pipeline.

### Fixture 4 — HTML con `<h1>`–`<h3>` semánticos
- [ ] Todos los headings tienen `source: "html_tag"`.
- [ ] La jerarquía no tiene saltos (H1 → H3 se corrige a H1 → H2).

### No regresión
- [ ] El flujo de migración `html_min` → markdown sigue funcionando sin cambios.
- [ ] `buildMapReduceChunks` para scopes > 60k no se ve afectado.
- [ ] Los checkpoints en Fase 1 siguen disparándose correctamente en el límite de secciones.