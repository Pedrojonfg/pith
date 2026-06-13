# Global Knowledge Vault — Phase A+

**Spec:** `20260613-knowledge-vault-a-plus`  
**Estado:** Ready to implement  
**Dependencias:** `20260609-unified-session`, `20260611-rsvp-assessment-reposition`, `20260613-source-fidelity`

---

## 1. Qué es y por qué

El problema actual: la IA parte de cero en cada documento. El assessment pre-packing detecta lo que sabes *del documento actual*, pero no sabe que ya estudiaste derivadas la semana pasada, que llevas tres documentos trabajando termodinámica, o que sistemáticamente fallas en regla de la cadena.

El Global Knowledge Vault (GKV) es un store persistente, cross-document, que modela el estado de conocimiento del usuario a lo largo del tiempo. No reemplaza el assessment por documento — lo complementa con una capa de contexto histórico que el LLM puede usar para:

- Omitir andamiaje en conceptos ya consolidados
- Reforzar prerrequisitos inestables antes de conceptos nuevos
- Personalizar la profundidad de explicaciones
- Detectar patrones de error recurrentes

**Principio rector:** el vault es una herramienta de calibración, no de verificación. No tiene que ser perfecto; tiene que ser más útil que no tenerlo.

---

## 2. Data model

### 2.1 `KnowledgeVaultEntry`

```typescript
interface KnowledgeVaultEntry {
  id: string;                    // UUID generado al crear la entrada
  canonicalTitle: string;        // Nombre normalizado ("Regla de la cadena")
  aliases: string[];             // Nombres alternativos vistos ("chain rule", "derivación compuesta")
  topic: string;                 // Dominio temático ("Cálculo diferencial")
  mastery: number;               // 0–1, calculado en el momento de leer
  masteryBase: number;           // Valor guardado tras la última observación
  masteryLastUpdated: number;    // timestamp Unix ms de la última observación
  lastSeen: number;              // timestamp de la última aparición en cualquier sesión
  sources: VaultSource[];        // De qué docs viene este concepto
  prerequisites: string[];       // IDs de entradas del vault que son prerrequisito
  dependents: string[];          // IDs de entradas que dependen de esta
  observations: VaultObservation[];
}

interface VaultSource {
  docId: string;
  conceptId: string;             // ID original en conceptInventory del doc
  addedAt: number;
}

interface VaultObservation {
  type: ObservationType;
  rawSignal: number;             // Valor crudo antes de ponderar (-1 a +1)
  timestamp: number;
  docId: string;
}

type ObservationType =
  | 'mcq_correct'
  | 'mcq_wrong'
  | 'socratic_passed'
  | 'socratic_partial'
  | 'cloze_correct'
  | 'cloze_wrong'
  | 'assessment_mastered'   // del pre-packing assessment
  | 'assessment_partial'
  | 'assessment_unknown';
```

### 2.2 `GlobalKnowledgeVault`

```typescript
interface GlobalKnowledgeVault {
  schemaVersion: 1;
  entries: KnowledgeVaultEntry[];
  lastUpdated: number;
}
```

### 2.3 Persistencia

```
localStorage['pith_knowledge_vault'] → GlobalKnowledgeVault
```

Si el vault supera ~300KB (aprox. 800–1000 conceptos), migrar a `pith_knowledge_vault_data` y guardar solo metadata en la key principal (mismo patrón que las sesiones grandes).

---

## 3. Modelo de mastery

### 3.1 Pesos por tipo de observación

| Tipo | rawSignal |
|------|-----------|
| `cloze_correct` | +1.0 |
| `socratic_passed` | +0.85 |
| `assessment_mastered` | +0.75 |
| `mcq_correct` | +0.6 |
| `socratic_partial` | +0.2 |
| `assessment_partial` | +0.1 |
| `mcq_wrong` | -0.3 |
| `cloze_wrong` | -0.5 |
| `assessment_unknown` | -0.1 |

Justificación del ranking: cloze > socrático > MCQ porque requieren mayor esfuerzo de recuperación activa. Assessment vale menos porque es autoevaluación, no rendimiento real.

### 3.2 Actualización tras cada observación

```javascript
const ALPHA = 0.3;       // learning rate
const LAMBDA = 0.05;     // decay diario

function updateMastery(entry, observation) {
  const daysSinceLastUpdate =
    (observation.timestamp - entry.masteryLastUpdated) / (1000 * 60 * 60 * 24);

  // 1. Aplicar decaimiento temporal desde última observación
  const decayed = entry.masteryBase * Math.exp(-LAMBDA * daysSinceLastUpdate);

  // 2. Actualizar con nueva señal
  const signal = observation.rawSignal; // ya está en [-1, +1]
  const updated = decayed + ALPHA * signal;

  // 3. Clamp a [0, 1]
  entry.masteryBase = Math.max(0, Math.min(1, updated));
  entry.masteryLastUpdated = observation.timestamp;
}
```

### 3.3 Lectura del mastery actual

El mastery que se expone al exterior siempre aplica decaimiento desde la última actualización:

```javascript
function getCurrentMastery(entry) {
  const now = Date.now();
  const daysSinceUpdate =
    (now - entry.masteryLastUpdated) / (1000 * 60 * 60 * 24);
  return entry.masteryBase * Math.exp(-LAMBDA * daysSinceUpdate);
}
```

El campo `mastery` en el objeto en memoria se recalcula en cada lectura. No se persiste — se recalcula desde `masteryBase` + `masteryLastUpdated`.

### 3.4 Interpretación de rangos

| Rango | Etiqueta interna |
|-------|-----------------|
| 0.0 – 0.29 | `unknown` |
| 0.30 – 0.59 | `partial` |
| 0.60 – 0.79 | `acquired` |
| 0.80 – 1.0 | `mastered` |

---

## 4. Pipeline de población del vault

### 4.1 Cuándo se ejecuta

Al **cerrar una sesión de estudio** (usuario sale de la pantalla de estudio o cierra la app con estado guardable). No en tiempo real durante el estudio — eso añade latencia innecesaria.

Trigger: `onSessionClose(docId, mode)` → `updateVaultFromSession(session, mode)`.

### 4.2 Flujo

```
shared.conceptInventory (doc completo)
  ↓
filterNewConcepts()          ← conceptos no vistos antes en ninguna sesión
  ↓
getDocTopics(session)        ← session.shared.docTopics (ver §5)
  ↓
getExistingEntriesByTopic()  ← vault entries del mismo tema
  ↓
[LLM] normalizeConceptsCall()  ← ver §4.3
  ↓
mergeNormalizationResult()   ← actualizar aliases, unir entradas, crear nuevas
  ↓
collectObservations()        ← desde shared.assessmentSignals + blocks respondidos
  ↓
applyObservations()          ← actualizar mastery de cada entrada
  ↓
elevatePrerequisiteRelations()  ← ver §6
  ↓
persistVault()
```

### 4.3 Llamada LLM de normalización

**Objetivo:** evitar duplicados entre documentos.

**Input:**
```
Existing vault entries (same topic):
[{ id, canonicalTitle, aliases }]   ← solo metadata, no mastery

New concepts from this document:
[{ id, title, type }]
```

**Prompt (en api.js → `normalizeConceptsToVault()`):**
```
You are normalizing learning concepts into a knowledge vault.

Existing vault entries for topic "{topic}":
{existing_entries_json}

New concepts extracted from a document on "{topic}":
{new_concepts_json}

For each new concept, determine:
- "merge": it's the same concept as an existing entry (provide the entry id)
- "alias": it's a variant name for an existing concept (provide the entry id)
- "new": it doesn't match any existing entry

Respond ONLY with JSON:
{
  "mappings": [
    { "conceptId": "...", "action": "merge"|"alias"|"new", "vaultEntryId": "..." | null }
  ]
}
```

**Cost:** una sola llamada por sesión, con input acotado al mismo topic. Típicamente < 50 entradas existentes + < 30 conceptos nuevos.

---

## 5. Topic tagging de documentos

Para poder filtrar el vault durante normalización.

### 5.1 Dónde vive

`DocumentSession.shared.docTopics: string[]` — array de 2–5 tags temáticos.

### 5.2 Cómo se genera

Se añade al prompt existente de `buildDocumentHierarchy()` en `api.js`:

```
// Añadir al output JSON de buildDocumentHierarchy:
"topics": ["string"] // 2–5 thematic tags in the document's language, e.g. ["Calculus", "Differentiation"]
```

Sin llamada LLM extra — se obtiene de la llamada de jerarquía que ya existe.

### 5.3 Matching para filtrado

Al normalizar, se buscan entradas del vault cuyo `topic` coincida con alguno de los `docTopics`. El matching es flexible: si el vault tiene "Cálculo diferencial" y el doc tiene topic "Cálculo", se incluye. Implementar como `topic.toLowerCase().includes(docTopic.toLowerCase()) || docTopic.toLowerCase().includes(topic.toLowerCase())`. Falsos positivos son aceptables — peor es no comparar.

---

## 6. Prerrequisitos cross-documento

### 6.1 Fuente de datos

El grafo RSVP ya extrae `prerequisite_ids` por concepto en `conceptInventory`. Cuando esos conceptos se mapean al vault, las relaciones se elevan:

```javascript
function elevatePrerequisiteRelations(session, normalizationMap) {
  // normalizationMap: conceptId → vaultEntryId
  for (const concept of session.shared.conceptInventory) {
    const vaultId = normalizationMap[concept.id];
    if (!vaultId) continue;

    for (const prereqConceptId of (concept.prerequisite_ids || [])) {
      const prereqVaultId = normalizationMap[prereqConceptId];
      if (!prereqVaultId || prereqVaultId === vaultId) continue;

      // Añadir si no existe ya
      addPrerequisiteRelation(vaultId, prereqVaultId);
    }
  }
}
```

### 6.2 Resultado

Con esto, tras estudiar dos documentos que comparten conceptos base, el vault tiene un grafo de prerrequisitos cross-documento sin ninguna llamada LLM adicional. Los conceptos base (muy reutilizados) aparecerán como prerrequisito de muchos otros, lo que refleja correctamente su importancia estructural.

### 6.3 Conflictos

Si doc A dice que "X requiere Y" y doc B dice que "Y requiere X": ambas relaciones se añaden. El grafo puede tener ciclos. En A+ no se resuelven — se dejan y se tratan en la inyección de prompts ignorando ciclos obvios. La resolución de ciclos es deuda técnica para post-A+.

---

## 7. Integración con assessment existente

El vault **no reemplaza** el pre-packing assessment. Son capas complementarias:

| Capa | Qué aporta |
|------|-----------|
| **Assessment por doc** | Qué sé de *este documento específico* hoy |
| **GKV** | Historial acumulado cross-documento y cross-tiempo |

### 7.1 GKV → assessment pre-packing

Antes de mostrar el quiz, pre-cargar las entradas del vault relevantes al documento. Conceptos con `mastery >= 0.7` se marcan como `presumed_known` en el UI del assessment (icono de check, pero el usuario puede contradecirlo). Esto hace el quiz más corto y focalizado en lo realmente incierto.

Función: `getVaultContextForDoc(docTopics): VaultEntry[]`.

### 7.2 GKV → `packInventoryToBlocks`

Al llamar al LLM de packing, se inyecta un bloque adicional al prompt:

```javascript
function buildVaultContextBlock(vaultEntries) {
  const mastered = vaultEntries.filter(e => getCurrentMastery(e) >= 0.7);
  const partial = vaultEntries.filter(e => {
    const m = getCurrentMastery(e);
    return m >= 0.3 && m < 0.7;
  });
  const unstablePrereqs = vaultEntries.filter(e =>
    e.dependents.length > 0 && getCurrentMastery(e) < 0.5
  );

  return `
GLOBAL KNOWLEDGE CONTEXT (from user's cross-document study history):
Mastered concepts (skip or compress): ${mastered.map(e => e.canonicalTitle).join(', ')}
Partial concepts (brief review recommended): ${partial.map(e => e.canonicalTitle).join(', ')}
Unstable prerequisites (reinforce before dependents): ${unstablePrereqs.map(e => e.canonicalTitle).join(', ')}
  `.trim();
}
```

Este bloque se añade como sección adicional en `buildConceptPackPrompt()` en `api.js`.

### 7.3 GKV → `ensureBlockGenerated`

Al generar explicación de un bloque, se añade contexto del vault sobre los conceptos que cubre ese bloque:

```javascript
// En buildBlockGenerationContext():
const blockConcepts = block.concept_ids
  .map(id => vaultEntries.find(e => e.sources.some(s => s.conceptId === id)))
  .filter(Boolean);

const vaultHint = blockConcepts.length
  ? `User's mastery on concepts in this block: ${
      blockConcepts.map(e => `${e.canonicalTitle} (${getMasteryLabel(e)})`).join(', ')
    }. Calibrate depth accordingly.`
  : '';
```

---

## 8. Debug UI (validación)

Sin esta UI es imposible verificar que el sistema funciona. Es la única interfaz de A+.

### 8.1 Dónde

Nueva sección en settings (pantalla existente de configuración API key). Botón "Knowledge Vault" → pantalla modal o inline expandible.

### 8.2 Qué muestra

```
[Knowledge Vault — N concepts]

Filter by topic: [dropdown con todos los topics]

| Concept              | Topic    | Mastery  | Last seen | Sources |
|----------------------|----------|----------|-----------|---------|
| Regla de la cadena   | Cálculo  | ████░ 72%| 2d ago    | 2 docs  |
| Termodinámica 2ª ley | Física   | ██░░░ 38%| 8d ago    | 1 doc   |
| ...                  |          |          |           |         |

[Clear vault] [Export JSON]
```

### 8.3 Acciones disponibles en A+

- **Ver detalle de concepto:** aliases, prerequisites, observaciones recientes
- **Clear vault:** elimina todo (confirmación requerida)
- **Export JSON:** dump crudo del vault para debug

Sin edición manual en A+ — eso es post-A+.

---

## 9. Nuevos módulos y archivos

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/js/vault/vault-store.js` | CRUD del GKV en localStorage |
| `src/js/vault/mastery-model.js` | `updateMastery()`, `getCurrentMastery()`, `getMasteryLabel()` |
| `src/js/vault/normalization.js` | `normalizeConceptsToVault()` — llamada LLM + merge |
| `src/js/vault/prerequisites.js` | `elevatePrerequisiteRelations()` |
| `src/js/vault/session-close.js` | `updateVaultFromSession()` — orquesta el pipeline completo |
| `src/js/vault/prompt-injection.js` | `buildVaultContextBlock()`, `getVaultContextForDoc()` |
| `src/js/vault/debug-ui.js` | Lógica de la pantalla de debug |

Modificaciones en archivos existentes:

| Archivo | Cambio |
|---------|--------|
| `src/js/api.js` | Añadir `normalizeConceptsToVault()`, extender `buildDocumentHierarchy` prompt (topics), extender `buildConceptPackPrompt` (vault context), extender `buildBlockGenerationContext` (vault hint) |
| `src/js/study.js` | Llamar `updateVaultFromSession()` en `onSessionClose` / exit handlers |
| `src/js/session-types.js` | Añadir `docTopics: string[]` a `shared` |
| `index.html` | Pantalla debug vault |
| `src/css/` | Estilos tabla debug |

---

## 10. Lo que NO hace A+

Para no desviarse:

- ❌ Edición manual de conceptos en vault (post-A+)
- ❌ Grafo visual navegable (post-A+)
- ❌ BKT probabilístico (post-A+)
- ❌ Resolución de ciclos en grafo prerrequisitos (post-A+)
- ❌ Import desde fuentes externas (post-A+)
- ❌ Sync entre dispositivos (requiere backend)
- ❌ Estimación de tipo de conocimiento declarativo vs procedimental (post-A+)

---

## 11. Orden de implementación recomendado

1. `vault-store.js` + `mastery-model.js` — la base, sin LLM
2. `session-close.js` con colección de observaciones (sin normalización aún) — el vault empieza a llenarse de conceptos con nombre exacto del doc
3. Debug UI — verificar que se llena
4. `normalization.js` — añadir la llamada LLM de dedup
5. `prompt-injection.js` + modificaciones en `api.js` — el vault empieza a influir en generación
6. `prerequisites.js` — elevación de relaciones del grafo RSVP
7. Topic tagging en `buildDocumentHierarchy`
8. Pre-fill del assessment con vault context

Este orden permite validar cada capa antes de añadir la siguiente, y el sistema es útil desde el paso 3 aunque no sea perfecto.

---

## 12. Contrato de calidad mínima

El vault se considera funcional en A+ si:

- [ ] Después de estudiar 2 documentos del mismo tema, la pantalla de debug muestra conceptos compartidos como una sola entrada (no duplicados)
- [ ] El mastery de un concepto baja si no se ve en 7+ días
- [ ] El packing de un tercer documento del mismo tema genera menos bloques para conceptos marcados como mastered
- [ ] La llamada de normalización LLM no falla si el vault está vacío
- [ ] El vault no supera 5KB tras el primer documento
