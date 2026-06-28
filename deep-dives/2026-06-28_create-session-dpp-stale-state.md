# Deep Dive: Create Session Continue + DPP Stale State

**Date:** 2026-06-28  
**Feature:** `20260629-fix-dpp-prep-ui` (symptom fix) + architectural notes on persistence model  
**Files touched:** `src/js/study.js`, `src/js/document-preparation.js`, `src/js/sw-update.js`, `index.html`

---

## 1. Qué construimos

Arreglamos el bloqueo de **Continue** en la pantalla “Create a new session”. El botón quedaba deshabilitado o el click no avanzaba cuando había un archivo nuevo en staging pero la app seguía mirando una **sesión persistida anterior** (mismo contenido o puntero activo) con DPP incompleto.

Los cambios concretos: (a) si hay archivos en staging, Continue solo exige nombre; (b) el handler procesa el upload antes de consultar la sesión activa; (c) `startDocumentPreparation` y `ensureTier1Preparation` ya no hacen early return solo porque existe inventario válido — solo cuando `isTier1PreparationComplete()` es verdadero (inventario + block recommendation + mode recommendation).

---

## 2. Decisiones de diseño

### Staging gana sobre sesión activa (fix inmediato)

**Elegido:** `createSessionStagedFiles.length > 0` desacopla el gate del botón y del handler respecto a `getActiveSession()`.

**Alternativas:**
- Limpiar `pith_active_doc_id` al entrar en create screen.
- Forzar `forceRerun: true` en cada upload.

**Descartadas porque:**
- Limpiar el puntero rompe resume legítimo (“volví a create pero ya tenía doc preparándose”).
- `forceRerun` en cada upload re-ejecutaría LLM caro aunque el doc ya estuviera bien.

**Trade-off:** Si el usuario tiene archivos staged *y* una sesión activa completa, Continue siempre re-procesa el upload. Es lo correcto para “quiero subir esto”; el caso raro es re-staging accidental.

### `isTier1PreparationComplete` como único criterio de skip en DPP

**Elegido:** Eliminar `isConceptInventoryValid()` como guard de salida en `startDocumentPreparation` / `ensureTier1Preparation`.

**Alternativa:** Ampliar `isTier1PreparationComplete` para que inventario solo ≡ tier-1 listo.

**Descartada:** Tier-1 incluye T1.4 (blocks) y T1.5 (mode flow). Conflarlos reintroduce el bug de “ready en UI pero bloqueado en gate”.

**Trade-off:** Dos predicates siguen coexistiendo (`isConceptInventoryValid` para guards de inventario, `isTier1PreparationComplete` para gate de create/mode-select). Hay que saber cuál usar.

### Modelo de persistencia actual vs. caché global por documento (no implementado — visión del producto)

**Hoy:**
| Capa | Clave | Alcance |
|------|-------|---------|
| `docId` | SHA-1 del markdown normalizado (12 hex) | **Global por contenido** — mismo texto → mismo ID para todos |
| `document_sessions` (Supabase) | `(id=docId, user_id)` | **Por usuario** — cada user tiene su fila |
| Markdown storage | `{userId}/{docId}.md` | **Por usuario** |
| `pith_active_doc_id` (localStorage) | puntero | **Por dispositivo/navegador** |
| DPP artifacts | dentro de `session.shared` | **Por usuario** — no hay tabla compartida cross-user |

**Tu intuición es correcta en dos puntos y necesita matiz en uno:**

1. ✅ **“Se cachea cosas cuando no terminó bien”** — Sí. `persistCheckpoint` escribe tras T1.1/T1.2 y al completar todas las fases tier-1 del grafo; `finalizeAndPersist` siempre corre en `finally`. `resolveFinalStatus` marca `ready`/`partial` si hay inventario (`tier1Complete` = `inventory.length > 0`), **sin** exigir block/mode rec. Estados zombie van a Supabase mientras desarrollabas.

2. ✅ **“No debería haber botón de borrar caché para el usuario”** — De acuerdo. La higiene es: no persistir basura + GC de runs incompletos + dev wipe manual. El usuario final no debería gestionar artefactos DPP.

3. ⚠️ **“Cachear por documento, no por usuario”** — El **ID** ya es por documento (content-addressed). Lo que falta es una **capa de artefactos DPP compartida** (p.ej. tabla `document_preparation_cache` keyed solo por `content_fingerprint` o `docId`, con RLS read-only para usuarios autenticados). Hoy no existe: el usuario B repite todo el pipeline aunque el hash sea idéntico.

**Arquitectura objetivo (propuesta):**

```
Upload → normalize → docId (hash)
       → lookup shared_prep_cache[docId + pipeline_version]
       → if HIT and tier1_complete: hydrate user session, skip LLM
       → if MISS: run DPP in ephemeral/working copy
       → on isTier1PreparationComplete ONLY: write to shared_prep_cache
       → always write user session row (progress, smItems, modes — per user)
```

**Qué NO cachear cross-user:** progreso de estudio, SM-2, anotaciones, vault personal, título inferido, projectId.

**Trade-off cross-user cache:** privacidad (¿el markdown es idéntico byte a byte?), invalidación cuando cambia `pipeline_version`/flags, y coste de storage centralizado vs. ahorro LLM.

---

## 3. Conceptos aplicados

| Concepto | Qué es | Dónde en nuestro código |
|----------|--------|-------------------------|
| **Content-addressed identity** | ID derivado del contenido, no del nombre de archivo | `computeDocId()` en `session-store.js` — SHA-1 de markdown normalizado |
| **Stale state / pointer invalidation** | Datos viejos en storage tratados como verdad actual | `getActiveSession()` + `updateCreateSessionContinueState(doc)` antes del fix |
| **Intent override** | La acción del usuario (staging) prima sobre estado implícito | `createSessionStagedFiles.length > 0` branch en `study.js` |
| **Guard clause / early return** | Salir antes de trabajo caro si precondición cumplida | `startDocumentPreparation` — guard corregido a `isTier1PreparationComplete` |
| **Checkpoint persistence** | Escrituras intermedias durante pipeline largo | `persistCheckpoint` en `dpp-persistence.js`, llamado tras T1.1/T1.2 en `document-preparation.js` |
| **Write-on-complete vs write-on-progress** | Cuándo flush a durable storage | Hoy: ambos (checkpoints + final). Objetivo futuro: shared cache solo on-complete |
| **Multi-tenant row key** | Misma entidad lógica, filas distintas por tenant | Supabase `upsertSessionRow` — `onConflict: "id,user_id"` |
| **Predicate drift** | Dos funciones “casi iguales” con semánticas distintas | `isConceptInventoryValid` vs `isTier1PreparationComplete` vs `resolveCreateSessionPrepStatus` |

---

## 4. Deuda técnica y mejoras

**Bien hecho:**
- `docId` content-addressed evita duplicar markdown dentro del mismo usuario.
- DPP con fases, resume por `phaseResults`, dedupe de vuelo concurrente (`runDedupedDppFlight`).
- Separación markdown → Supabase Storage, metadata → `session_data`.

**Chapuza funcional / no escala:**
- **Persistir DPP incompleto como si fuera válido:** checkpoints + `finalizeAndPersist` con `tier1Complete` = solo inventario. Genera zombies en Supabase durante dev — exactamente lo que te pasó.
- **`resolveCreateSessionPrepStatus` más permisivo que el gate del botón:** puede decir “Document ready” con solo inventario mientras `isTier1PreparationComplete` es false. UX mentirosa.
- **`enterCreateSessionStartScreen` no resetea intent:** carga sesión activa, muestra insights de doc viejo, mezcla con staging nuevo.
- **Sin caché cross-user:** mismo PDF en 1000 usuarios = 1000× coste LLM. El hash está preparado pero no se explota a nivel servidor.
- **Sin GC de sesiones fallidas:** no hay TTL ni “discard run if !isTier1PreparationComplete after N hours”.
- **Dev cleanup manual:** no hay script repo para wipe local + Supabase; hay que hacerlo a mano o vía consola.

**No añadir:** botón “Clear cache” en UI de producción. Sí: script dev-only o comando documentado para wipe total en desarrollo.

---

## 5. Preguntas de consolidación

1. Si dos usuarios suben el mismo PDF, ¿qué partes de `DocumentSession.shared` deberían venir de un cache global y cuáles deben ser siempre per-user? (Pista: separar `shared` en `sharedArtifacts` inmutable vs `sharedUserState` mutable.)

2. ¿Por qué `persistCheckpoint` después de T1.2 puede dejar la app en un estado peor que no persistir nada hasta `isTier1PreparationComplete`? ¿Qué pasa en create-screen si `preparation.status === "partial"` y solo existe inventario?

3. Dado que `docId` es global pero la fila Supabase es `(docId, user_id)`, ¿qué ocurre cuando el mismo usuario borra su sesión y vuelve a subir el mismo archivo? ¿Se reutiliza la fila upsert o quedan restos en Storage?

---

## 6. Actualización sugerida para `.cursorrules`

```markdown
- Create-session / upload flows: if staged files exist, NEVER gate Continue on getActiveSession() or isTier1PreparationComplete — process upload first.
- DPP persistence: do not treat preparation as complete for gates or cross-session reuse until isTier1PreparationComplete() is true (inventory + blockRecommendation + modeRecommendation). Checkpoints may write in-progress state but must not mark ready/partial-final unless that predicate holds.
- Shared DPP cache (future): content-keyed artifacts are global; user session rows are per-user. Never expose a user-facing "clear cache" for pipeline artifacts — incomplete runs should be discarded or GC'd server-side, not managed by the learner.
```

---

## Apéndice: wipe dev (localStorage + Supabase) estando logueado

Ver [`scripts/dev-wipe-user-data.md`](../scripts/dev-wipe-user-data.md) y `src/js/dev/wipe-user-data.js`.

```javascript
const { wipeUserDevData } = await import("./src/js/dev/wipe-user-data.js");
await wipeUserDevData({ confirm: true });
```

---

## Respuesta directa a tu modelo mental

| Afirmación | Verdad |
|------------|--------|
| “Se cachea por usuario” | **Sí** para persistencia (Supabase row + storage path). |
| “Debería cachearse por documento” | **Parcialmente ya** (docId = hash). **Falta** capa compartida de artefactos DPP cross-user. |
| “Otro usuario con mismo texto no debería repetir DPP” | **Correcto como objetivo**, **no implementado hoy**. |
| “El problema es cachear cuando no terminó bien” | **Sí, exacto.** Checkpoints + status `partial`/`ready` prematuro en semanas de bugs = deuda en tu cuenta Supabase + puntero activo local. |
| “Botón borrar caché para usuario final” | **No.** Wipe dev manual o GC automático de runs incompletos. |
