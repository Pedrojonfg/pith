# Spec: Todas las palancas del pipeline Pith
**Alcance**: modo estricto (`source_fidelity_mode: "strict"`), flujo RSVP  
**Problemas a resolver**: overlapping estructural de preguntas + bloques thin (poca chicha)  
**Fecha**: 2026-06-12

---

## Mapa de palancas por etapa del pipeline

```
Documento
    │
    ├─ [L1] Normalización y jerarquía documental
    │
    ▼
runConceptInventory
    ├─ [L2] Densidad del inventario (conceptos/página)
    ├─ [L3] Inventario en dos pasadas (macro + micro)
    ├─ [L4] Tipología de conceptos (principal vs secundario)
    │
    ▼
packInventoryToBlocks
    ├─ [L5] Regla Key terms: obligatoriedad y función
    ├─ [L6] Ratio bloques Key terms / bloques desarrollo
    ├─ [L7] Fusión de módulos pequeños
    │
    ▼
assignAlignedChunksSequential
    ├─ [L8] Umbral de penalización por solapamiento de chunks
    ├─ [L9] Snap a jerarquía documental (docHierarchy)
    ├─ [L10] Tamaño mínimo de chunk (words floor)
    │
    ▼
applyDeterministicDedup
    ├─ [L11] Umbral de solapamiento de firma (≥3 → configurable)
    ├─ [L12] Dedup semántico por embedding (vs string matching actual)
    │
    ▼
deepSeekGenerateBlockJson (explanation + questions + concepts[])
    ├─ [L13] Separación de llamadas: explanation vs questions
    ├─ [L14] Scope de preguntas: Key terms → solo definición
    ├─ [L15] n_test = 0 en bloques Key terms
    ├─ [L16] coverageManifest: memoria cross-bloque de claims preguntados
    ├─ [L17] Cablear deepSeekAuditBlockOverlap
    ├─ [L18] Instrucción explícita anti-reteaching en preguntas
    ├─ [L19] Pregunta de conexión: tipo y posición
    │
    ▼
validateBlockFidelity
    ├─ [L20] Umbral Jaccard explanation↔chunk
    ├─ [L21] Validación de claims cubiertos (claim coverage)
    │
    ▼
deepSeekRegenerateBlockQuestions (regen de preguntas)
    ├─ [L22] Regen con coverageManifest como input
    ├─ [L23] Regen forzado si overlap detectado por L17
    │
    ▼
buildRsvpMaterialGraph
    ├─ [L24] Nodos grises (conceptos presentes en doc pero no en inventario)
    ├─ [L25] Aristas de prerequisite entre bloques no-adyacentes
```

---

## L1 — Normalización y jerarquía documental

**Problema que resuelve**: si `docHierarchy` no se genera o está incompleta, el snap de chunks a secciones no funciona y el alineador no puede respetar los límites naturales del documento.

**Cambio**:
- Asegurar que el parser del documento (HTML, PDF, etc.) siempre produce un `docHierarchy` con offsets de sección.
- Para HTML: extraer `❖`, `➔`, `➢` y headers como delimitadores de sección además de `<h1>`-`<h6>`.
- Para el documento de ejemplo (apuntes de ética): los delimitadores son `❖` (sección) y `➔` (subsección) en texto plano — esto debe detectarse en la normalización.

**Impacto**: medio. Mejora la calidad del chunk sin cambiar la lógica downstream.  
**Esfuerzo**: bajo-medio (parser específico por tipo de delimitador).  
**Interacción**: L9 depende de esto.

---

## L2 — Densidad del inventario (conceptos/página)

**Problema que resuelve**: inventario escaso → bloques thin → preguntas repetitivas dentro de poco material. En el documento de 60 páginas, 30 conceptos = 0.5/página. La densidad real del material académico denso debería ser 1.5-2.5 conceptos/página.

**Cambio**:
```
// En runConceptInventory, antes de la llamada al LLM:
const estimatedConceptTarget = Math.max(
  30,
  Math.round(wordCount / 300) * 2  // ~2 conceptos cada 300 palabras
);
// Pasar estimatedConceptTarget al prompt como target dinámico
```

El prompt de inventario debería decir `"Identify approximately ${target} concepts"` en vez de un número fijo, o `"Identify ALL pedagogically significant concepts; expect ${target} for a document of this length"`.

**Thresholds sugeridos por tipo de documento**:
- Texto académico denso (filosofía, derecho, ciencia): 1.5–2 conceptos/página
- Manual técnico: 1–1.5 conceptos/página
- Narrativa/ensayo: 0.5–1 conceptos/página

El tipo puede inferirse del propio inventario (si el LLM detecta estructura académica, ajustar).

**Impacto**: alto. Es la principal causa de "poca chicha". Resolver esto resuelve el ~60% del problema de contenido thin.  
**Esfuerzo**: bajo (cambio de prompt + cálculo dinámico del target).  
**Riesgo**: inventarios muy grandes aumentan el coste de tokens y pueden perder coherencia. Cap razonable: 120 conceptos máximo; si el documento necesita más, usar L3.

---

## L3 — Inventario en dos pasadas (macro + micro)

**Problema que resuelve**: el LLM en una sola pasada sobre 60 páginas tiende a capturar los conceptos principales y obviar excursos, sub-argumentos y ejemplos clave. Los 79 gaps identificados son en su mayoría de este tipo.

**Cambio** — flujo de dos fases:

```
Fase 1 (macro): LLM lee documento completo → conceptos de nivel 1
                (misma lógica actual, densidad mínima)

Fase 2 (micro):  Para cada sección del docHierarchy:
                 LLM lee solo esa sección + lista de conceptos ya identificados
                 → conceptos de nivel 2 NO presentes en fase 1
                 prompt: "Identify sub-concepts, examples, critical distinctions,
                 and named arguments in this section that are NOT already in
                 the following list: [concepts_phase_1]"
```

**Output**: inventario fusionado con campo `level: 1 | 2`. Los conceptos nivel 2 se marcan como `secondary: true` en el pack y pueden: (a) fusionarse al bloque de desarrollo del módulo correspondiente como `secondary_concept_ids`, o (b) generar bloques propios si hay suficientes.

**Impacto**: muy alto para documentos académicos densos.  
**Esfuerzo**: medio (nueva función, N llamadas adicionales donde N = número de secciones).  
**Coste de tokens**: ~2-3× el inventario actual. Aceptable para documentos de alta densidad.

---

## L4 — Tipología de conceptos en el inventario

**Problema que resuelve**: actualmente todos los conceptos tienen el mismo peso. Pero hay conceptos que son definiciones (deben estar en Key terms), conceptos que son argumentos (deben estar en bloques de desarrollo), y conceptos que son ejemplos (deben anclarse al bloque del argumento que ilustran).

**Cambio** — añadir campo `concept_type` al inventario:

```json
{
  "id": "c42",
  "title": "Argumento de la pendiente resbaladiza (Singer)",
  "concept_type": "argument",   // definition | argument | example | distinction | excursus
  "module": "Utilitarismo",
  "source_phrase": "pendiente resbaladiza",
  "prerequisite_ids": ["c28", "c29"]
}
```

**Uso downstream**:
- `definition` → elegible para Key terms
- `argument`, `distinction`, `excursus` → bloques de desarrollo o secondary_concept_ids
- `example` → forzar asignación al bloque del concepto padre

**Impacto**: medio-alto. Mejora tanto la estructura del grafo como la asignación de chunks.  
**Esfuerzo**: medio (prompt de inventario + lógica de pack que lee el tipo).

---

## L5 — Regla Key terms: obligatoriedad y función

**Problema que resuelve**: la regla actual crea overlap estructural garantizado. Para cada módulo hay un bloque Key terms y al menos un bloque de desarrollo sobre el mismo texto.

**Opciones** (mutuamente excluyentes, elegir una):

### L5-A: Key terms como pre-activación sin preguntas
El bloque existe y tiene `explanation` (vocabulario), pero `n_test = 0` forzado por tipo.  
- Sin cambio en pack ni inventario.  
- Cambio en `resolveBlockQuestionConfig`: si `blockTitle.match(/^Key terms:/i)`, devolver `{n_test: 0, n_socratic: 0}`.  
- **Impacto**: elimina ~30% del overlapping de preguntas. Esfuerzo: mínimo (1 condición).

### L5-B: Key terms con preguntas solo de reconocimiento
Key terms genera preguntas exclusivamente del tipo "¿qué es X?", "¿a qué categoría pertenece X?". Los bloques de desarrollo nunca repiten definiciones de lo cubierto en Key terms previo.  
- Requiere dos instrucciones de scope: una para Key terms ("solo definición/clasificación"), otra para desarrollo ("no preguntar definiciones del Key terms anterior").  
- **Impacto**: medio. Esfuerzo: bajo-medio (dos variantes de prompt de preguntas).

### L5-C: Eliminar Key terms como tipo obligatorio
La regla 2 del prompt de pack desaparece. El vocabulario del módulo se integra al inicio del primer bloque de desarrollo.  
- Más limpio estructuralmente.  
- Pierde la función pedagógica de pre-activación de vocabulario antes de la lectura.  
- **Impacto**: alto en reducción de bloques (puede reducir el total ~30%). Esfuerzo: bajo (cambio de prompt de pack).

### L5-D: Key terms como bloque de glosario separado, no en la secuencia de estudio
El bloque Key terms existe en el grafo y en el material, pero no aparece en la secuencia lineal de sesión. Es accesible como referencia lateral (barra de términos, click-on-term).  
- Requiere flag `study_sequence: false` en el bloque.  
- **Impacto**: soluciona el overlapping sin eliminar la utilidad del glosario. Esfuerzo: medio (cambio en sesión player para excluirlo del flow linear).

**Recomendación**: L5-A como solución inmediata. L5-D como solución de arquitectura a mediano plazo.

---

## L6 — Ratio bloques Key terms / bloques desarrollo por módulo

**Problema que resuelve**: módulos pequeños (2-3 conceptos) no justifican un bloque Key terms propio.

**Cambio**: en la regla del prompt de pack, añadir condición:
```
Create a "Key terms" block for a module ONLY if the module has ≥ 4 concepts.
For modules with 1-3 concepts, embed vocabulary in the first development block.
```

O en el `packInventoryDeterministic` fallback: umbral mínimo de conceptos por módulo para crear Key terms.

**Impacto**: bajo-medio. Reduce bloques para módulos pequeños (Weber, excurso metodológico).  
**Esfuerzo**: mínimo (condición en prompt).

---

## L7 — Fusión de módulos pequeños

**Problema que resuelve**: módulos de 1-2 conceptos generan overhead de estructura sin añadir valor de organización.

**Cambio**: en `packInventoryToBlocks`, si un módulo tiene < N conceptos (sugerido N=3), proponer al LLM de pack que lo fusione con el módulo adyacente más relacionado temáticamente.

O en el `packInventoryDeterministic`: umbral de fusión de módulos pequeños en el módulo más cercano por `prerequisite_ids`.

**Impacto**: bajo-medio. Simplifica la estructura para documentos con muchos módulos pequeños.  
**Esfuerzo**: bajo.

---

## L8 — Umbral de penalización por solapamiento de chunks

**Problema que resuelve**: el solapamiento residual de chunks entre bloques Key terms y bloques de desarrollo del mismo módulo no es detectado por el dedup (firmas distintas, ≤2 términos compartidos).

**Cambio** en `assignAlignedChunksSequential`:

```javascript
// Actualmente: penaliza si hay solapamiento de word ranges
// Propuesta: penalizar también por similitud de términos del inventario
// si dos bloques comparten > umbral% de source_phrases asignadas

const OVERLAP_PENALTY_TERM_THRESHOLD = 0.4; // 40% de términos compartidos
// Si el chunk candidato contiene ≥40% de los source_phrases
// de un bloque ya asignado → penalización adicional score *= 0.3
```

**Impacto**: medio. Reduce solapamiento de chunks sin eliminar bloques.  
**Esfuerzo**: bajo-medio (nueva métrica de penalización en el scorer).

---

## L9 — Snap a jerarquía documental (docHierarchy)

**Problema que resuelve**: sin snap a secciones, los chunks pueden cortarse en mitad de un argumento. El snap solo funciona si `docHierarchy` está disponible y bien formado (depende de L1).

**Cambio**:
- Hacer el snap **obligatorio** cuando existe `docHierarchy`, no opcional.
- Añadir validación: si un bloque de desarrollo recibe un chunk que cruza más de 2 secciones del documento, forzar re-split en sección más relevante.
- Para Key terms: su chunk debería comenzar siempre en la primera sección del módulo correspondiente.

**Impacto**: medio. Mejora la coherencia argumental de los chunks.  
**Esfuerzo**: bajo (cambiar flag opcional a obligatorio + validación de secciones cruzadas).

---

## L10 — Tamaño mínimo de chunk (words floor)

**Problema que resuelve**: chunks demasiado pequeños producen bloques thin aunque el inventario sea denso.

**Cambio**:
```javascript
const MIN_CHUNK_WORDS = 400;  // sugerido; ajustar por tipo de documento
// Si el chunk asignado < MIN_CHUNK_WORDS, expandir al siguiente límite de sección
// Si aun así < MIN_CHUNK_WORDS, fusionar bloque con el adyacente en el pack step
```

El tamaño mínimo puede ser dinámico: `Math.max(400, documentWords / (nBlocks * 2))`.

**Impacto**: medio. Previene bloques vacíos por mala alineación.  
**Esfuerzo**: bajo.

---

## L11 — Umbral de solapamiento de firma en dedup (configurable)

**Problema que resuelve**: el umbral actual de ≥3 términos compartidos en firma puede ser demasiado alto para módulos con vocabulario especializado donde 2 términos compartidos ya indican solapamiento real.

**Cambio**:
```javascript
// En applyDeterministicDedup, hacer el umbral configurable:
const SIGNATURE_OVERLAP_THRESHOLD = config.dedupSignatureOverlapThreshold ?? 3;
// Para modo estricto + documentos académicos: probar con 2
```

También añadir una segunda condición: si dos bloques comparten ≥1 `concept_id` Y ≥2 términos de firma → merge.

**Impacto**: bajo-medio. Reduce algunos duplicados residuales.  
**Esfuerzo**: mínimo.

---

## L12 — Dedup semántico por embedding

**Problema que resuelve**: el dedup actual (string matching normalizado) no detecta solapamiento entre "buena voluntad" y "integridad moral" aunque sean el mismo concepto con distinto término.

**Cambio**:
- Tras el dedup determinista, run opcional de embedding similarity entre pares de bloques.
- Si cosine similarity(explanation_A, explanation_B) > 0.85 → flag para revisión manual o merge automático.
- Usar embeddings ligeros (text-embedding-3-small o equivalente) sobre los `summary` de bloque, no sobre explicaciones completas.

**Cuándo activar**: solo cuando el nBlocks generado excede en >20% el nBlocks esperado para el tamaño del documento.

**Impacto**: bajo en producción actual (el dedup determinista cubre la mayoría); alto para documentos con vocabulario rico donde el mismo concepto aparece con distintos nombres.  
**Esfuerzo**: medio (integración de embedding + umbral de similitud).

---

## L13 — Separación de llamadas: explanation vs questions

**Problema que resuelve**: al co-generar explanation + questions en una sola llamada, el LLM optimiza ambas en conjunto. Las preguntas tienden a reflejar lo que *él mismo* acaba de explicar, creando preguntas sobre lo que el bloque tiene + ignorando lo que el chunk tiene pero la explanation no capturó.

**Cambio** — flujo en dos pasos:
```
Paso 1: deepSeekGenerateBlockExplanation(chunk, claims, blockTitle, blocksList)
        → explanation, concepts[]

Paso 2: deepSeekGenerateBlockQuestions(chunk, explanation, coverageManifest, blockTitle)
        → questions[]
```

**Ventajas**:
- Las preguntas pueden cubrir material del chunk que la explanation resumió brevemente.
- `coverageManifest` puede pasarse solo al paso 2, reduciendo el tamaño del prompt del paso 1.
- Los questions pueden regenerarse sin regenerar la explanation (ya existe `deepSeekRegenerateBlockQuestions`).

**Desventaja**: +1 llamada por bloque = coste adicional.

**Impacto**: medio-alto. Mejora la cobertura de preguntas respecto al material real.  
**Esfuerzo**: medio (refactor de la llamada principal, pasando de 1 a 2 LLM calls por bloque).

---

## L14 — Scope de preguntas diferenciado por tipo de bloque

**Problema que resuelve**: los bloques Key terms y los bloques de desarrollo generan preguntas del mismo tipo, causando solapamiento.

**Cambio** — tabla de scopes:

| Tipo de bloque | Preguntas permitidas | Preguntas prohibidas |
|---|---|---|
| Key terms | Definición, clasificación, etimología, contraste de términos | Aplicación, análisis de argumento, consecuencias |
| Overview | Ninguna (n_test = 0) o solo orientación | Definición, detalle |
| Desarrollo | Aplicación, contraste, argumento, consecuencia, ejemplo | Definición de términos ya cubiertos en Key terms previo del mismo módulo |
| Excurso | Conexión con concepto principal, implicación | No |

**Implementación**: en el prompt de generación de preguntas, añadir sección:
```
QUESTION TYPE RESTRICTION for this block type ("${blockType}"):
- ALLOWED: [lista según tabla]
- FORBIDDEN: [lista según tabla]
If this is a development block, do NOT ask "what is X?" for any term X
defined in the preceding Key terms block: ${precedingKeyTermsSignature}
```

**Impacto**: alto. Resuelve el overlapping de preguntas sin cambiar la estructura de bloques.  
**Esfuerzo**: bajo-medio (detectar tipo de bloque + construir la restricción contextual).

---

## L15 — n_test = 0 en bloques Key terms (solución inmediata)

**Problema que resuelve**: overlapping de preguntas entre Key terms y bloques de desarrollo.

**Cambio** en `resolveBlockQuestionConfig`:
```javascript
function resolveBlockQuestionConfig(blockTitle, sessionConfig) {
  if (/^Key terms:/i.test(blockTitle)) {
    return { n_test: 0, n_socratic: 0 };
  }
  if (/^Overview:/i.test(blockTitle) || /^Course map:/i.test(blockTitle)) {
    return { n_test: 0, n_socratic: 0 };
  }
  return sessionConfig.defaultQuestionConfig;
}
```

**Impacto**: alto para el overlapping. Inmediato, sin cambios en pipeline.  
**Esfuerzo**: mínimo (~5 líneas).  
**Efecto secundario positivo**: Overview tampoco debería tener preguntas — si el usuario no ha visto nada aún, no puede responder.

---

## L16 — coverageManifest: memoria cross-bloque de claims preguntados

**Problema que resuelve**: actualmente no hay memoria de qué claims ya se han preguntado en bloques anteriores. El LLM puede regenerar preguntas semánticamente equivalentes en bloques distintos.

**Cambio** — implementar `coverageManifest` como estructura activa:

```typescript
interface CoveredClaim {
  blockId: number;
  claimType: "definition" | "argument" | "example" | "contrast";
  keyTerms: string[];       // términos principales del claim
  questionAsked: string;    // resumen de 1 línea de la pregunta hecha
}

// En session state:
coverageManifest: CoveredClaim[]

// Al generar preguntas del bloque N:
// 1. Pasar coverageManifest al generador
// 2. Prompt: "Do NOT create questions about claims already covered:
//    ${JSON.stringify(coverageManifest.slice(-20))}"  // últimos 20 claims
// 3. Al completar el bloque, extraer los claims preguntados y añadir a manifest
```

**Extracción de claims de preguntas**: llamada lightweight post-generación:
```
deepSeekExtractQuestionClaims(questions[]) → CoveredClaim[]
```
O heurística local: key terms de la pregunta + tipo de pregunta inferido del verbo ("¿qué es?" → definition, "¿por qué?" → argument).

**Impacto**: alto. Resuelve el overlapping residual que queda después de L15 y L14.  
**Esfuerzo**: medio-alto (nueva estructura en session state + extracción de claims + integración en prompt).

---

## L17 — Cablear deepSeekAuditBlockOverlap

**Problema que resuelve**: el audit LLM que compara explanation vs 2 bloques previos ya está implementado pero no se llama. Detectaría overlaps que los mecanismos locales no capturan.

**Cambio** en `ensureBlockGenerated`:
```javascript
// Después de validateBlockFidelity y antes de marcar el bloque como done:
if (blockIndex > 1) {
  const prevBlocks = getPreviousBlocks(blockIndex, 2); // 2 bloques previos
  const overlapReport = await deepSeekAuditBlockOverlap(
    generatedBlock.explanation,
    prevBlocks.map(b => b.explanation),
    blockTitle
  );
  
  if (overlapReport.hasSignificantOverlap) {
    // Regenerar con instrucción explícita de evitar el overlap detectado
    const regenerated = await deepSeekGenerateBlockJson({
      ...params,
      avoidOverlapWith: overlapReport.overlappingConcepts
    });
    return regenerated;
  }
}
```

**Cuándo activar**: solo para bloques de desarrollo (no Key terms, que ya tienen n_test=0 via L15). Opcional: solo cuando el bloque es el primero de desarrollo después de un Key terms del mismo módulo.

**Coste**: +1 llamada LLM por bloque auditado. Puede limitarse a los N primeros bloques de cada módulo.

**Impacto**: medio-alto. Safety net para el overlapping que escapa a L14-L16.  
**Esfuerzo**: bajo (el código existe, solo falta la llamada y el retry).

---

## L18 — Instrucción explícita anti-reteaching en preguntas (mejorar la actual)

**Problema que resuelve**: la instrucción actual "ALREADY TAUGHT" afecta a la *explicación* pero no tiene instrucción paralela para *preguntas*.

**Cambio**: añadir sección dedicada al prompt de preguntas (separada del prompt de explicación):

```
ALREADY QUESTIONED in previous blocks:
${alreadyQuestionedTerms.join(", ")}

Rules:
1. Do NOT ask "what is X?" or "define X" for any term in ALREADY QUESTIONED.
2. You MAY ask about relationships, contrasts, or implications involving those terms.
3. At least ${Math.ceil(n_test * 0.4)} questions must cover material NOT in ALREADY QUESTIONED.
```

`alreadyQuestionedTerms` se construye localmente desde los títulos de preguntas anteriores + sus opciones → no requiere LLM.

**Impacto**: medio. Complementa L14 y L16 con bajo coste.  
**Esfuerzo**: bajo.

---

## L19 — Pregunta de conexión: tipo y posición

**Problema que resuelve**: la pregunta de conexión obligatoria (bloque > 1) tiende a ser superficial ("¿qué tiene en común X con lo visto en el bloque anterior?") cuando debería forzar transferencia de conocimiento real.

**Cambio**: tipificar la pregunta de conexión con mayor restricción:

```
REQUIRED CONNECTION QUESTION (1st question only):
- It must reference a SPECIFIC claim from block N-1 or N-2 (listed below).
- It must show how the current block MODIFIES, EXTENDS, CONTRADICTS, or 
  APPLIES that prior claim.
- It must NOT be answerable without having studied the referenced prior block.
- Format hint: "Given that [claim from prior block], how does [current topic]...?"

Prior block claims available for reference:
${prevBlockSummaryForConnection}
```

**Impacto**: bajo-medio. Mejora la calidad pedagógica de las conexiones.  
**Esfuerzo**: bajo (refinamiento del prompt existente).

---

## L20 — Umbral Jaccard explanation↔chunk en fidelity

**Problema que resuelve**: el umbral actual puede ser demasiado permisivo, dejando pasar explicaciones que introducen material fuera del chunk (especialmente en modo no-estricto).

**Cambio**:
```javascript
const JACCARD_THRESHOLD = {
  strict: 0.35,    // explanation debe tener ≥35% de términos del chunk
  normal: 0.20
};

// Añadir métrica complementaria: chunk_coverage
// = qué % de los key terms del chunk aparecen en la explanation
// Si chunk_coverage < 0.50 en modo strict → warning + retry sugerido
```

El `chunk_coverage` bajo es más informativo que el Jaccard bajo: indica que la explanation ignoró material del chunk (= bloque thin) en vez de que añadió material de fuera.

**Impacto**: medio. Detecta proactivamente bloques thin.  
**Esfuerzo**: bajo (añadir métrica en validateBlockFidelity).

---

## L21 — Validación de claims cubiertos (claim coverage)

**Problema que resuelve**: `validateBlockFidelity` comprueba fidelidad (no inventar) pero no completitud (no omitir). Un bloque puede ser fiel al chunk pero haber ignorado el 60% del material disponible.

**Cambio**:
```javascript
// Tras deepSeekExtractSourceClaims (ya existente):
const totalClaims = extractedClaims.length;
const coveredClaims = countClaimsCoveredInExplanation(
  explanation,
  extractedClaims  // match por key terms de cada claim
);
const claimCoverageRatio = coveredClaims / totalClaims;

if (claimCoverageRatio < 0.6) {  // threshold configurable
  // Retry con: "The following claims from the source were not covered:
  //            ${uncoveredClaims.map(c => c.source_phrase).join(', ')}
  //            Include them in your explanation."
}
```

**Impacto**: alto. Directamente ataca el problema de "poca chicha" — fuerza al LLM a cubrir el material disponible.  
**Esfuerzo**: medio (función de match claims→explanation + retry logic).

---

## L22 — Regen de preguntas con coverageManifest como input

**Problema que resuelve**: la función `deepSeekRegenerateBlockQuestions` no recibe `coverageManifest`, por lo que en regeners puede repetir lo ya preguntado en bloques anteriores.

**Cambio**: añadir `coverageManifest` como parámetro a `deepSeekRegenerateBlockQuestions` y al prompt correspondiente.

```javascript
async function deepSeekRegenerateBlockQuestions(
  explanation,
  chunk,
  blockConfig,
  sessionConfig,
  coverageManifest  // ← nuevo parámetro
) { ... }
```

**Impacto**: bajo-medio (solo aplica en sesiones donde se hace regen).  
**Esfuerzo**: mínimo (añadir parámetro + pasarlo al prompt).

---

## L23 — Regen forzado si L17 detecta overlap

**Problema que resuelve**: si `deepSeekAuditBlockOverlap` detecta overlap pero no hay retry automático, el overlap persiste.

**Cambio**: el retry de L17 debe pasar los conceptos solapados como `avoidOverlapWith` tanto al generador de explanation como al de preguntas.

```javascript
// En prompt de explanation cuando hay overlap detectado:
"AVOID OVERLAP: The following concepts are already covered in prior blocks.
Do NOT re-explain them. You may REFERENCE them briefly when necessary:
${overlapReport.overlappingConcepts.join(', ')}
Focus instead on: ${newConceptsForThisBlock.join(', ')}"
```

**Impacto**: medio. Cierra el loop de L17.  
**Esfuerzo**: bajo (parte de L17).

---

## L24 — Nodos grises en el grafo (conceptos ausentes del inventario)

**Problema que resuelve**: los 79 gaps identificados no tienen representación en el grafo. El usuario del grafo (si navega por él) no puede ver que hay material que el sistema no está cubriendo.

**Cambio** en `buildRsvpMaterialGraph`:
- Tras construir el grafo con el inventario conocido, hacer un pase adicional sobre el documento buscando `source_phrases` significativas sin nodo correspondiente.
- Crear nodos tipo `grey` (sin bloque asignado) para esos conceptos.
- Conectarlos al nodo más cercano por módulo con arista `related`.

**Input**: lista de términos del documento (extractable localmente con TF-IDF o pasada LLM ligera).

**Beneficio secundario**: los nodos grises son candidatos directos para L2/L3 en futuras sesiones con el mismo documento.

**Impacto**: bajo en calidad de sesión; alto en visibilidad de gaps para debugging del sistema.  
**Esfuerzo**: medio (extracción de términos + lógica de creación de nodos grises).

---

## L25 — Aristas de prerequisite entre bloques no-adyacentes

**Problema que resuelve**: actualmente el grafo tiene aristas `requires` entre conceptos del inventario (`prerequisite_ids`), pero no se usan para ordenar la sesión ni para warnings de "este bloque depende de material no estudiado".

**Cambio**:
- En `buildRsvpMaterialGraph`, añadir aristas `prerequisite` entre bloques (no solo conceptos) derivadas de los `prerequisite_ids` del inventario.
- En el session player: si el usuario navega a un bloque cuyo prerequisite no ha sido estudiado, mostrar warning.
- En la generación de preguntas: el LLM puede recibir los `prerequisite` cumplidos para calibrar el nivel de la pregunta de conexión (L19).

**Impacto**: bajo en overlapping; medio en coherencia pedagógica de la sesión.  
**Esfuerzo**: bajo-medio.

---

## Tabla resumen de prioridades

| Palanca | Problema principal | Impacto | Esfuerzo | Prioridad |
|---|---|---|---|---|
| L15 | Overlapping preguntas | Alto | Mínimo | **P0** |
| L2 | Poca chicha | Alto | Bajo | **P0** |
| L14 | Overlapping preguntas | Alto | Bajo-medio | **P1** |
| L21 | Poca chicha (claim coverage) | Alto | Medio | **P1** |
| L16 | Overlapping residual | Alto | Medio-alto | **P1** |
| L17 | Overlapping safety net | Medio-alto | Bajo | **P2** |
| L13 | Cobertura de preguntas | Medio-alto | Medio | **P2** |
| L1 | Chunk quality | Medio | Bajo-medio | **P2** |
| L3 | Poca chicha (micro) | Muy alto | Medio | **P2** |
| L9 | Chunk coherencia argumental | Medio | Bajo | **P2** |
| L8 | Solapamiento de chunks | Medio | Bajo-medio | **P3** |
| L18 | Overlapping en preguntas | Medio | Bajo | **P3** |
| L5-D | Estructura Key terms | Alto | Medio | **P3** |
| L4 | Tipología inventario | Medio-alto | Medio | **P3** |
| L20 | Fidelity completitud | Medio | Bajo | **P3** |
| L19 | Calidad conexiones | Bajo-medio | Bajo | **P4** |
| L10 | Chunk size floor | Bajo-medio | Bajo | **P4** |
| L11 | Dedup threshold | Bajo-medio | Mínimo | **P4** |
| L22 | Regen con manifest | Bajo-medio | Mínimo | **P4** |
| L23 | Retry tras audit | Medio | Bajo | **P4** |
| L6 | Ratio Key terms | Bajo-medio | Mínimo | **P4** |
| L7 | Fusión módulos pequeños | Bajo | Bajo | **P4** |
| L24 | Visibilidad gaps grafo | Bajo (debug) | Medio | **P5** |
| L25 | Prerequisites en sesión | Bajo-medio | Bajo-medio | **P5** |
| L12 | Dedup semántico | Bajo | Medio | **P5** |

---

## Secuencia de implementación recomendada

### Sprint 0 (< 1 día, sin riesgo)
- **L15**: `n_test = 0` en bloques Key terms y Overview
- **L11**: umbral dedup configurable, bajar a 2 en modo estricto
- **L22**: pasar `coverageManifest` a regen (aunque sea vacío ahora)

### Sprint 1 (2-3 días)
- **L2**: densidad dinámica del inventario
- **L14**: scope de preguntas diferenciado por tipo de bloque
- **L18**: instrucción anti-reteaching en preguntas (mejora la actual)
- **L17**: cablear `deepSeekAuditBlockOverlap` + L23

### Sprint 2 (3-5 días)
- **L21**: claim coverage en fidelity
- **L16**: `coverageManifest` activo
- **L1**: parser de jerarquía documental para tipos de delimitador no-HTML
- **L9**: snap a sección obligatorio

### Sprint 3 (1 semana)
- **L3**: inventario en dos pasadas
- **L13**: separación explanation vs questions
- **L5-D**: Key terms como referencia lateral (no en flow linear)

### Sprint 4 (largo plazo)
- **L4**: tipología de conceptos en inventario
- **L24**: nodos grises en grafo
- **L12**: dedup semántico por embedding
