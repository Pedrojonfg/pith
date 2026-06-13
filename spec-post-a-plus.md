# Global Knowledge Vault — Post A+ Roadmap

**Spec:** `20260613-knowledge-vault-post-a-plus`  
**Estado:** Deuda técnica planificada — no implementar hasta validar A+  
**Dependencias:** `20260613-knowledge-vault-a-plus` completado y validado con uso real

---

## Premisa

Este documento recoge todo lo que A+ deja fuera por complejidad o por no ser necesario para validar la hipótesis central. Antes de atacar cualquier bloque de aquí, la pregunta es: ¿el andamiaje cognitivo de A+ está mejorando el aprendizaje de forma medible? Si sí, aquí están las siguientes capas. Si no, hay que entender por qué antes de seguir construyendo.

Las secciones están ordenadas de menor a mayor complejidad, no por prioridad de negocio (esa depende de datos de uso real).

---

## Bloque 1 — Edición manual del vault (MVP de gestión)

**Qué es:** Permitir al usuario ver y editar su bóveda directamente, no solo vía sesiones de estudio.

**Por qué no está en A+:** Es UI pura, no afecta al modelo, pero requiere tiempo de frontend que hoy es mejor invertir en que el modelo funcione.

**Funcionalidad:**

- Editar `canonicalTitle` de una entrada
- Fusionar dos entradas manualmente (elegir cuál es el canonical, la otra pasa a alias)
- Eliminar entradas individuales
- Añadir conceptos manualmente (con topic, título, mastery inicial)
- Ver y editar prerrequisitos de una entrada (lista editable)

**Complejidad:** Baja-media. Todo es UI sobre el vault-store que A+ ya tiene. El único riesgo es la fusión manual — hay que reasignar observations, sources, prerequisites y dependents de la entrada eliminada a la que queda.

**Cuándo tiene sentido implementarlo:** Cuando el usuario empiece a querer añadir cosas de fuentes externas (libros físicos, clases presenciales). Antes de eso, no hay urgencia.

---

## Bloque 2 — Import desde fuentes externas

**Qué es:** Poder decirle a la app "sé estas cosas" sin haber estudiado un documento en la app.

**Casos de uso:**
- "Ya estudié este tema el semestre pasado en otra app"
- "Sé Python desde hace 5 años, no me expliques qué es una variable"
- "Leí este libro fuera de la app"

**Opciones de implementación:**

**2a. Import por texto libre (LLM):** El usuario pega un texto describiendo lo que sabe → LLM extrae conceptos → se añaden al vault con mastery inicial configurable (0.7 por defecto para imports manuales).

**2b. Import por documento sin sesión:** Subir un documento y marcarlo como "ya lo sé" → se extraen conceptos al vault con mastery alto sin crear sesión de estudio.

**2c. Import CSV/JSON:** Para usuarios power que quieren control total sobre su vault.

**Complejidad:** Media. 2a y 2b son extensiones naturales de infraestructura existente. 2c es trabajo de UI y parsing.

---

## Bloque 3 — Detección de concepciones erróneas

**Qué es:** Distinguir entre "no sabe" (mastery bajo) y "sabe algo pero de forma sistemáticamente incorrecta" (patrón de errores específico). La literatura científica — recogida en el documento de investigación que motiva este sistema — identifica esto como especialmente importante: el conocimiento previo erróneo es más dañino que no tener conocimiento.

**Cómo detectarlo:**

Un patrón de error sistemático tiene estas características:
- El usuario falla consistentemente en preguntas sobre el mismo concepto
- Los errores no son aleatorios: hay un distractor específico que elige con frecuencia
- O bien: la explicación socrática revela una misconception articulada

**Implementación:**

```typescript
interface VaultObservation {
  // Añadir a A+:
  wrongAnswer?: string;     // qué eligió en MCQ
  wrongAnswerPattern?: string; // etiqueta de patrón si el LLM lo detecta
}

interface KnowledgeVaultEntry {
  // Añadir a post-A+:
  misconceptions: Misconception[];
}

interface Misconception {
  description: string;        // "Confunde X con Y"
  confidence: number;         // 0–1
  observations: string[];     // IDs de observaciones que la evidencian
  detectedAt: number;
  resolved: boolean;
}
```

**Prompt de detección:** Al cerrar sesión, si hay ≥ 3 observaciones negativas en el mismo concepto, llamada LLM con los wrong answers y el concepto → `detectMisconceptionPattern()`.

**Uso en andamiaje:** Cuando el LLM genera un bloque sobre un concepto con misconception activa, se inyecta: *"User has a known misconception: [description]. Design the explanation to directly address this contrast."*

**Complejidad:** Media. El modelo de datos es sencillo, el valor es alto, pero requiere suficientes observaciones negativas para ser fiable — por eso no está en A+.

---

## Bloque 4 — Refinamiento del modelo de mastery

### 4a. Diferenciación declarativo vs procedimental

La literatura muestra que el conocimiento procedimental (saber aplicar) predice mejor el rendimiento futuro que el declarativo (saber definir). El vault de A+ no los distingue.

**Señales para inferir el tipo:**
- MCQ con opciones textuales → evidencia declarativa
- MCQ con cálculo o aplicación → evidencia procedimental  
- Socrático con problema a resolver → evidencia procedimental
- Cloze sobre definición → evidencia declarativa

**Implementación:**
```typescript
interface KnowledgeVaultEntry {
  masteryDeclarative: number;
  masteryProcedural: number;
  // mastery = weighted avg (0.4 * declarative + 0.6 * procedural)
}
```

Requiere etiquetar las observaciones con el tipo de tarea en `ensureBlockGenerated`.

### 4b. Bayesian Knowledge Tracing

**Cuándo tiene sentido:** Cuando haya suficientes datos de un único usuario (>15 observaciones por concepto en promedio) o cuando haya suficientes usuarios para calibrar parámetros por concepto.

**Parámetros BKT:**
- P(L0): probabilidad de que el usuario ya sabía el concepto antes de verlo
- P(T): probabilidad de aprender en cada intento
- P(G): probabilidad de adivinar correctamente sin saber
- P(S): probabilidad de error a pesar de saber

**Por qué esperar:** Con < 15 observaciones por concepto (lo habitual en uso individual), los parámetros no convergen y BKT es estadísticamente peor que la media ponderada de A+. Implementar BKT sin datos suficientes da una falsa sensación de precisión.

**Complejidad cuando el momento es el correcto:** Media. Las fórmulas son simples; el trabajo es el pipeline de calibración de parámetros.

---

## Bloque 5 — Grafo de prerrequisitos mejorado

### 5a. Resolución de ciclos

A+ puede crear ciclos en el grafo prerrequisito (doc A: X→Y, doc B: Y→X). Post-A+ añade resolución:

- Detectar ciclos al persistir (`hasCycle()` en topological sort)
- Si hay ciclo: marcar ambas relaciones como `bidirectional` (co-prerrequisitos) en lugar de eliminar una
- Usar esa información en andamiaje: "estos conceptos se refuerzan mutuamente, enseñar juntos"

### 5b. Inferencia de prerrequisitos por LLM

A+ eleva prerrequisitos del grafo RSVP existente. Post-A+ añade inferencia explícita entre conceptos del vault que nunca han aparecido en el mismo documento:

```
Vault entries: [lista de conceptos con topics]
Task: identify prerequisite relationships between these concepts
Output: [{ from: vaultId, to: vaultId, confidence: 0–1 }]
```

Una llamada periódica (por ejemplo, tras añadir el 5º documento de un mismo topic) que enriquece el grafo con relaciones que ningún documento individual declara explícitamente.

### 5c. Importancia topológica

Calcular grado de centralidad de cada nodo en el grafo (cuántos dependientes tiene). Usar esto para priorizar qué conceptos revisar con mayor frecuencia en Review. Un concepto con muchos dependientes y mastery inestable es el candidato más urgente de repasar.

---

## Bloque 6 — UI grafo navegable

**Qué es:** La visualización tipo Obsidian — grafo interactivo de la bóveda completa.

**Por qué no está en A+:** Es la parte con peor ratio valor/esfuerzo para un sistema que aún no ha validado si el modelo funciona. Bonita, pero no necesaria para que el andamiaje funcione.

**Cuando sí tiene sentido:**
- El vault tiene >50 conceptos y el usuario necesita navegar para entender su propio estado
- Hay suficiente estructura de prerrequisitos para que el grafo sea informativo

**Implementación:** Reutilizar `graph/view.js` + `canvas.js` existentes con un adaptador para el vault. Ya hay infraestructura de renderizado de grafos en el proyecto — esto es principalmente un adaptador de datos.

```javascript
// graph/adapters.js — añadir:
function buildVaultGraph(vault) {
  return {
    nodes: vault.entries.map(e => ({
      id: e.id,
      label: e.canonicalTitle,
      type: 'vault_concept',
      mastery: getCurrentMastery(e),
    })),
    edges: vault.entries.flatMap(e =>
      e.prerequisites.map(prereqId => ({
        from: prereqId,
        to: e.id,
        type: 'prerequisite',
      }))
    ),
  };
}
```

---

## Bloque 7 — Repaso espaciado guiado por vault

**Qué es:** El vault actual en A+ informa el andamiaje del nuevo aprendizaje. Post-A+ lo usa también para programar repasos.

**Integración con `shared.smItems` existente:**

El sistema SM ya existe en la app (integración parcial v1). Post-A+ lo conecta al vault:

- Los conceptos del vault con mastery decayendo hacia `partial` (<0.5) se añaden automáticamente al pool de Review
- La frecuencia de revisión proporcional a la importancia topológica del concepto (ver Bloque 5c)
- Los conceptos centrales del grafo con dominio inestable aparecen más frecuentemente

**Complejidad:** Media-alta, porque requiere que el SM esté robusto (actualmente "integración parcial v1").

---

## Bloque 8 — Multi-dispositivo y backup

**Qué es:** Actualmente el vault vive solo en localStorage de un dispositivo. Si el usuario estudia en móvil y ordenador, tiene dos vaults separados.

**Solución:** Requiere backend. El vault se serializa y sincroniza con la cuenta del usuario. Los conflictos se resuelven con last-write-wins por entrada (no por vault entero).

**Complejidad:** Alta, porque implica introducir backend, auth, y sync — que son cambios arquitectónicos mayores al proyecto completo, no solo al vault.

**Cuándo:** Cuando se introduzca backend para eliminar la API key del usuario (que ya estaba en el roadmap general para fase 2 del proyecto).

---

## Bloque 9 — Collaborative filtering

**Qué es:** Usar los patrones de mastery de múltiples usuarios para mejorar las estimaciones individuales. "Usuarios que sabían X e Y pero fallaban Z en este documento" → calibrar mejor el mastery inicial de Z para usuarios similares.

**Complejidad:** Alta. Requiere backend, privacidad de datos, suficiente masa de usuarios.

**Cuándo:** MVP con usuarios reales, no antes.

---

## Priorización sugerida post-A+

| Bloque | Impacto esperado | Complejidad | Cuándo |
|--------|-----------------|-------------|--------|
| 1 — Edición manual | Alto (UX) | Baja | Cuando el vault tenga errores que el usuario quiera corregir |
| 3 — Misconceptions | Alto (pedagógico) | Media | Cuando haya ≥2 semanas de datos |
| 2 — Import externo | Medio-alto | Media | Cuando el usuario quiera añadir fuentes externas |
| 4a — Declarativo/Procedimental | Medio | Media | Tras validar que el mastery básico es útil |
| 5a/5b — Grafo mejorado | Medio | Media | Cuando haya >3 docs del mismo tema |
| 7 — Repaso espaciado | Alto (retención) | Media-alta | Cuando SM esté robusto |
| 6 — UI grafo | Bajo-medio (UX) | Media | Cuando haya >50 conceptos |
| 4b — BKT | Medio | Media | Con >15 obs/concepto de media |
| 8 — Multi-dispositivo | Alto (adopción) | Alta | Con backend general |
| 9 — Collaborative | Alto (escala) | Muy alta | Con base de usuarios |

---

## Señales que indican que A+ está listo para extender

- El vault tiene >30 conceptos tras 1 semana de uso normal
- La pantalla de debug no muestra duplicados obvios (normalización funciona)
- El packing de documentos repetidos genera un número de bloques notablemente menor
- El mastery de conceptos estudiados hace >1 semana ha decaído pero no a cero
- El usuario nota subjetivamente que la app "ya sabe lo que sé"

Si alguna de estas señales falla, hay que arreglar A+ antes de añadir capas encima.
