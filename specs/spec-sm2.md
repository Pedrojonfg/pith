# SM-2 Priority Queue — Spec

**Spec:** `20260613-sm2-priority-queue`  
**Estado:** Ready to implement  
**Dependencias:** `20260609-unified-session`, `20260613-knowledge-vault-a-plus`  
**Scope de este spec:** Lógica central del algoritmo + modelo de datos + entrada de datos desde modos existentes. UI mínima (botón Review en screenModeSelect). Rediseño de UI queda fuera de scope.

---

## 1. Qué es

Un sistema de repetición espaciada basado en SM-2 donde **el tiempo actúa como ordenador, no como bloqueador**.

En SM-2 clásico, un ítem con `due_date = mañana` no se puede repasar hoy. En este sistema, ese ítem aparece en la cola ordenado después de los que tocan hoy — pero si llegas hasta él, puedes repasarlo. El resultado es una **tabla infinita** donde siempre hay algo que hacer: primero lo urgente, luego lo próximo, luego lo lejano.

La clave algorítmica: **el siguiente intervalo solo crece cuando has superado el umbral temporal del intervalo actual**. Si lo repasas antes, el sistema registra la observación (útil para el modelo bayesiano futuro) pero no adelanta el siguiente escalón.

---

## 2. Modelo de datos

### 2a. SmItem (actualización del schema existente)

Los `smItems` ya existen en `shared` como integración parcial. Este spec los formaliza:

```typescript
interface SmItem {
  id: string;                    // UUID — identifica el ítem de repaso
  sourceType: 'rsvp_block'       // de dónde viene
            | 'cloze_item'
            | 'slow_flashcard'
            | 'vault_concept';   // concepto del GKV directamente
  sourceId: string;              // blockId / clozeItemId / vaultEntryId
  docId: string;                 // DocumentSession de origen
  
  // --- SM-2 core ---
  interval: number;              // días hasta próximo repaso (empieza en 1)
  easeFactor: number;            // multiplicador SM-2 (empieza en 2.5)
  repetitions: number;           // nº de repasos con respuesta ≥ 3
  
  // --- Scheduling ---
  scheduledDue: number;          // timestamp — cuando SM-2 dice que toca
  lastReviewed: number | null;   // timestamp del último repaso real
  
  // --- Observaciones (para BKT futuro) ---
  observations: SmObservation[]; // historial completo de respuestas
  
  // --- Meta ---
  createdAt: number;
  title: string;                 // texto corto para mostrar en UI
  contentPreview: string;        // primeras palabras del concepto/pregunta
}

interface SmObservation {
  timestamp: number;
  quality: 0 | 1 | 2 | 3 | 4 | 5;  // escala SM-2 estándar
  wasEarly: boolean;                  // se repasó antes de scheduledDue
  intervalAtTime: number;             // intervalo vigente cuando se repasó
  daysEarly: number;                  // cuántos días antes de scheduledDue (0 si a tiempo)
}
```

### 2b. Dónde vive

```
DocumentSession.shared.smItems: SmItem[]
```

Sin cambios en el schema de sesión — ya existe el campo. Este spec lo puebla con estructura real.

**Nota migración Supabase:** `smItems` es un array JSON dentro del blob `shared`. La migración es `UPDATE sessions SET shared = jsonb_set(shared, '{smItems}', $1)`. Cero cambios en lógica.

---

## 3. El algoritmo: SM-2 con umbral temporal

### 3a. SM-2 estándar (referencia)

```
Si quality < 3:
  repetitions = 0
  interval = 1

Si quality ≥ 3:
  Si repetitions == 0: interval = 1
  Si repetitions == 1: interval = 6
  Si repetitions > 1:  interval = interval_anterior * easeFactor

easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
easeFactor = max(1.3, easeFactor)
repetitions += 1

scheduledDue = now + interval * 86400000  // en ms
```

### 3b. Umbral temporal (la innovación)

Antes de aplicar SM-2, se calcula si el repaso es "a tiempo" o "adelantado":

```typescript
const THRESHOLD_RATIO = 0.7; // repasar en el último 30% del intervalo = "a tiempo"

function isOnTime(item: SmItem, now: number): boolean {
  if (item.lastReviewed === null) return true; // primer repaso siempre cuenta
  const intervalMs = item.interval * 86400000;
  const thresholdMs = intervalMs * THRESHOLD_RATIO;
  const dueMs = item.scheduledDue;
  return now >= dueMs - (intervalMs - thresholdMs);
  // equivalente: now >= lastReviewed + (interval * THRESHOLD_RATIO * 86400000)
}
```

**Lógica de update:**

```typescript
function updateSmItem(item: SmItem, quality: number, now: number): SmItem {
  const early = !isOnTime(item, now);
  const daysEarly = early 
    ? Math.max(0, (item.scheduledDue - now) / 86400000) 
    : 0;

  // Registrar observación siempre
  const observation: SmObservation = {
    timestamp: now,
    quality,
    wasEarly: early,
    intervalAtTime: item.interval,
    daysEarly,
  };

  if (early) {
    // Repaso adelantado: no modificar SM-2, solo registrar
    return {
      ...item,
      lastReviewed: now,
      observations: [...item.observations, observation],
    };
  }

  // Repaso a tiempo: SM-2 normal
  let { interval, easeFactor, repetitions } = item;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  }

  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  return {
    ...item,
    interval,
    easeFactor,
    repetitions,
    scheduledDue: now + interval * 86400000,
    lastReviewed: now,
    observations: [...item.observations, observation],
  };
}
```

### 3c. Priority queue (ordenación)

```typescript
function buildReviewQueue(items: SmItem[], now: number): SmItem[] {
  return [...items].sort((a, b) => a.scheduledDue - b.scheduledDue);
}
```

Así de simple. Los que tocan hoy van primero. Los que tocan mañana, después. Los que tocan en 10 días, al final — pero están ahí si el usuario quiere llegar.

**Lo que el usuario ve:**
- Items con `scheduledDue <= now` → badge "AHORA" (o sin badge)
- Items con `scheduledDue` en las próximas 24h → badge "HOY"
- Items con `scheduledDue` en 2–7 días → badge "PRÓXIMO"
- Items con `scheduledDue > 7 días` → badge "FUTURO"

---

## 4. Cómo se crean los SmItems (fuentes de entrada)

### 4a. Desde RSVP / Questions

Al terminar un bloque y registrar respuestas en `assessmentSignals`, crear un `SmItem` si no existe ya uno para ese `blockId`:

```typescript
// En study.js, tras registrar respuesta en bloque
function registerRsvpBlockAnswer(blockId: string, quality: number, docId: string) {
  const session = sessionStore.getActive();
  const block = session.modes.rsvp.blocks.find(b => b.id === blockId);
  
  let item = session.shared.smItems.find(
    i => i.sourceType === 'rsvp_block' && i.sourceId === blockId
  );
  
  if (!item) {
    item = createSmItem({
      sourceType: 'rsvp_block',
      sourceId: blockId,
      docId,
      title: block.title,
      contentPreview: block.conceptIds.slice(0, 3).join(', '),
    });
  }
  
  const updated = updateSmItem(item, quality, Date.now());
  upsertSmItem(session, updated);
  sessionStore.save(session);
}
```

**Mapping de respuestas a quality:**
- MCQ correcto a primera → 5
- MCQ correcto tras dudar → 4  
- MCQ correcto con hint → 3
- MCQ incorrecto → 1
- No responder / skip → 2

### 4b. Desde Cloze

Al registrar respuesta en `screenClozeStudy`, el ítem cloze ya tiene su propia mecánica interna. Este spec añade la escritura paralela en `smItems`:

```typescript
// En cloze/study.js, tras cada respuesta
const quality = mapClozeResultToQuality(result); // EASY→5, MEDIUM→4, HARD→3, FAIL→1
registerOrUpdateSmItem('cloze_item', clozeItemId, quality, docId, item.sentence);
```

### 4c. Desde Slow Mode flashcards

Las flashcards de `slow/phase3.js` ya van a Review. Conectarlas a `smItems`:

```typescript
// En slow/phase3.js al crear flashcard
createSmItem({
  sourceType: 'slow_flashcard',
  sourceId: flashcardId,
  docId,
  title: flashcard.front,
  contentPreview: flashcard.back.slice(0, 80),
});
```

### 4d. Desde el GKV directamente (vault_concept)

Cuando el vault tiene un concepto con mastery inestable (< 0.5) que no tiene un SmItem asociado por ninguna fuente, crear uno sintético:

```typescript
// En knowledge-vault.js, tras actualizar mastery
if (entry.currentMastery < 0.5 && !hasSmItem('vault_concept', entry.id)) {
  createSmItem({
    sourceType: 'vault_concept',
    sourceId: entry.id,
    docId: entry.lastSeenDocId,
    title: entry.canonicalTitle,
    contentPreview: entry.definition?.slice(0, 80) ?? entry.aliases[0] ?? '',
  });
}
```

---

## 5. Módulo: `sm2.js`

Fichero nuevo en `src/js/sm2.js`. Funciones puras exportadas — cero side effects, fácil de testear.

```typescript
// src/js/sm2.js

export const SM2_DEFAULTS = {
  interval: 1,
  easeFactor: 2.5,
  repetitions: 0,
  scheduledDue: Date.now(), // inmediatamente repasable
  lastReviewed: null,
  observations: [],
};

export function createSmItem(params: Omit<SmItem, keyof typeof SM2_DEFAULTS | 'id' | 'createdAt'>): SmItem {
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    ...SM2_DEFAULTS,
    ...params,
  };
}

export function isOnTime(item: SmItem, now = Date.now()): boolean { ... }

export function updateSmItem(item: SmItem, quality: number, now = Date.now()): SmItem { ... }

export function buildReviewQueue(items: SmItem[], now = Date.now()): SmItem[] { ... }

export function getQueueStats(items: SmItem[], now = Date.now()) {
  return {
    dueNow: items.filter(i => i.scheduledDue <= now).length,
    dueToday: items.filter(i => i.scheduledDue <= now + 86400000).length,
    total: items.length,
  };
}
```

---

## 6. UI mínima (este sprint)

**Objetivo:** botón Review funcional en `screenModeSelect` sin rediseño de UI.

### 6a. Badge en el botón Review existente

```html
<!-- En screenModeSelect, botón de Review -->
<button id="btnReview">
  Review
  <span id="reviewBadge" class="review-badge hidden">0</span>
</button>
```

```javascript
// Al cargar screenModeSelect
const stats = getQueueStats(session.shared.smItems);
if (stats.dueNow > 0) {
  reviewBadge.textContent = stats.dueNow;
  reviewBadge.classList.remove('hidden');
}
```

### 6b. Pantalla de Review actualizada

`screenReview` existente muestra los ítems en orden de priority queue. Para cada ítem:

1. Mostrar contenido (título + preview del concepto/bloque)
2. Usuario responde (botones de calidad: "Fácil / Bien / Difícil / No lo sabía")
3. Mapping a quality (5/4/3/1)
4. `updateSmItem` → guardar → siguiente ítem

**Mapping visual de quality:**

| Botón | Quality | SM-2 result |
|-------|---------|-------------|
| Lo sabía perfectamente | 5 | Intervalo × easeFactor, EF sube |
| Lo sabía | 4 | Intervalo × easeFactor |
| Con esfuerzo | 3 | Intervalo × easeFactor, EF baja |
| No lo sabía | 1 | Reset a intervalo 1 |

### 6c. Indicador visual de "adelantado"

Cuando `!isOnTime(item)`, mostrar un chip sutil: `⚡ Repaso anticipado` — el usuario sabe que está "adelantando" y que el intervalo no crecerá. Sin bloqueo, solo información.

---

## 7. Helper: upsertSmItem

```typescript
// src/js/session-store.js — añadir
export function upsertSmItem(session: DocumentSession, item: SmItem): void {
  const idx = session.shared.smItems.findIndex(i => i.id === item.id);
  if (idx >= 0) {
    session.shared.smItems[idx] = item;
  } else {
    session.shared.smItems.push(item);
  }
}
```

---

## 8. Tests

```javascript
// cursor-tests/sm2.test.mjs
import { createSmItem, updateSmItem, isOnTime, buildReviewQueue } from '../src/js/sm2.js';

// Test 1: primer repaso siempre cuenta
// Test 2: repaso adelantado no modifica interval
// Test 3: repaso a tiempo aumenta interval
// Test 4: quality < 3 resetea a interval 1 (incluso a tiempo)
// Test 5: priority queue ordena por scheduledDue
// Test 6: ease factor no baja de 1.3
// Test 7: observación siempre se registra (incluso en repaso adelantado)
```

---

## 9. Migración a Supabase (referencia futura)

Cuando llegue Supabase, `smItems` vive en `shared` que es un JSONB column:

```sql
-- Lectura
SELECT shared->'smItems' FROM sessions WHERE id = $1;

-- Update (upsert un item)
UPDATE sessions 
SET shared = jsonb_set(shared, '{smItems}', $1::jsonb)
WHERE id = $2;
```

Cero cambios en `sm2.js`, `study.js`, ni en ningún módulo de modo. Solo `session-store.js` cambia su backend de persistencia. La lógica es completamente agnóstica.

---

## 10. Fuera de scope (este spec)

- Rediseño visual de Review
- Vista de historial / estadísticas de mastery
- BKT / modelo bayesiano (necesita ≥15 obs/concepto)
- Configuración de THRESHOLD_RATIO por usuario
- Algoritmo alternativo (FSRS, SuperMemo 18)
- Sincronización cross-device (Supabase)
- Items desde el grafo de prerrequisitos (GKV Bloque 5)

---

*Spec generado: junio 2026. Actualizar `20260609-unified-session` si se cambia el schema de `smItems`.*
