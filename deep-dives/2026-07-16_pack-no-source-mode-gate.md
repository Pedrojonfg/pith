# Deep Dive — Pack no-source mode gate + feature validation

**Fecha:** 2026-07-16  
**Sesión:** `/validate` contra `20260716-pack-feature-test-plan-spec.md` + fix del camino `includeSourceDocument=false`

---

### 1. Qué construimos

Una batería de validación (163 asserts) que cubre export, editor de grafo e import de packs según el plan de pruebas legal/funcional. Al ejecutarla apareció un bug bloqueante: un pack publicado **sin** documento origen dejaba RSVP/Recall inutilizables porque `hasSharedMaterial` solo miraba `rawMarkdown`. Se añadió un gate explícito de origen de pack (`isPackImportSession` / `packImportHasSourceDocument`) para que el contenido derivado sea estudiable y Slow/Cloze queden bloqueados cuando no hay fuente.

### 2. Decisiones de diseño

**A. “Tiene material” ≠ “tiene rawMarkdown”**
- **Elegido:** `hasSharedMaterial` acepta packs con `preparation.status === "ready"` aunque `rawMarkdown` esté vacío.
- **Alternativas:** (1) dejar un placeholder de markdown sintético en el import; (2) bypass especial solo en `enterModeWithContinuity`. Descartadas: (1) reintroduce texto inventado y confunde fidelity/scope; (2) deja el gate central mentiroso para otros callers.
- **Trade-off:** el significado de `hasSharedMaterial` se amplia; hay que documentar que “material” puede ser solo slices derivados.

**B. Detección de “pack con fuente” por presencia de artefactos, no por flag en sesión**
- **Elegido:** `packImportHasSourceDocument` infiere fuente si hay `rawMarkdown`, `modes.slow`, `modes.cloze` o `images`.
- **Alternativas:** persistir `include_source_document` en `uploadMeta` al importar. Descartada por YAGNI en v1 (el snapshot ya materializa la decisión).
- **Trade-off:** si algún día un pack-with-source llega sin slow/cloze/images y con markdown vacío, se clasificaría mal; el flag en `uploadMeta` sería más robusto.

**C. Misma API de disponibilidad que interview (`isModeAvailableForSession`)**
- **Elegido:** extender `interview/origin.js` para ocultar Slow/Cloze en packs sin fuente, y reutilizarlo en `syncInterviewModeGate` + `enterModeWithContinuity`.
- **Alternativas:** un `syncPackModeGate` paralelo. Descartada para no duplicar listas de modos ocultos.
- **Trade-off:** el módulo “interview/origin” ahora es “session origin gating”; el nombre del archivo miente un poco.

**D. Tests de fixture + mutation check ligero, no E2E multi-cuenta**
- **Elegido:** Node fixtures con DB/session fakes; n-gram search para residuo copyright; mutation check 6 mutantes (83% killed).
- **Alternativas:** Playwright con dos usuarios Supabase reales. Descartada por coste y por no tener infra de UI automation en este repo.
- **Trade-off:** RLS live (§3.1.5/7.1) y Vault post-estudio (§5.2.9) quedan como deuda consciente.

### 3. Conceptos aplicados

| Concepto | Qué es | Dónde |
|---|---|---|
| **Feature flag implícito por shape** | El estado del dominio se deduce de qué campos existen tras una transformación, no de un booleano separado | `packImportHasSourceDocument` en `session-types.js` |
| **Gate / policy object** | Función pura que decide si una acción está permitida antes de orquestar UI | `isModeAvailableForSession`, `resolveModeEntryState` early-return `pack_without_source_document` |
| **Deep clone isolation** | Copia estructural para que mutaciones del draft no toquen la sesión origen | Cubierto en validate §3.1.3/3.1.4 sobre `buildPackSnapshot` / `createPackDraft` |
| **Allowlist de schema** | Diff de claves contra conjunto fijo; cualquier campo extra es fallo | Validate §3.1.2 `SNAPSHOT_TOP_KEYS` |
| **Jaccard / lexical overlap gate** | Métrica de solapamiento de tokens para rechazar paráfrasis demasiado literal | `assertRewriteOverlapOk` + `PACK_REWRITE_JACCARD_MAX` en `pack-export.js` |
| **N-gram / longest common word run** | Búsqueda de fragmentos literales consecutivos entre documento original y payload exportado | Validate §6.2 `longestCommonWordRun` |
| **Mutation testing (lightweight)** | Introducir fallos sintéticos y exigir que la suite falle | `cursor-tests/mutation-check-pack-feature.mjs` |
| **Dependency injection via deps** | Inyectar `supabase` / `llmChatCompletions` / session store para testear sin red | `createPackDraft`, `finalizePack`, `importPackAsSession` |

### 4. Deuda técnica y mejoras

**Bien**
- El bug legal/funcional del camino sin fuente quedó cerrado con asserts bloqueantes alineados al test-plan.
- La política Slow/Cloze está en un solo sitio (`PACK_SOURCE_REQUIRED_MODES` + `isModeAvailableForSession`) y la UI la reutiliza.
- Clone isolation y strip de copyright tienen cobertura fixture seria, no solo smoke.

**Chapuza funcional**
- `interview/origin.js` ya no es solo interview; debería renombrarse o moverse a `session-origin.js`.
- `packImportHasSourceDocument` es heurística OR de campos; un `uploadMeta.includeSourceDocument` sería más barato de mantener.
- `isSliceResumable` para slow/cloze ahora acepta shapes planos (pack) y anidados (sesión nativa) — parche pragmático; el import debería normalizar al shape canónico.

**No escala**
- Fake Supabase en tres archivos de test casi idénticos (`pack-export`, `pack-import`, `pack-feature-validate`) — extraer un helper compartido o se divergirán.
- Sin test RLS con dos JWTs reales, la premisa de aislamiento owner sigue siendo “confiar en el SQL leído”.
- El validate suite es monolítica (163 asserts en un archivo); cuando falle a mitad, el feedback es ruidoso.

### 5. Preguntas de consolidación

1. Si un pack-with-source se publica sin `modes.slow`/`cloze` y con `rawMarkdown` vacío (solo RSVP), ¿`packImportHasSourceDocument` debería ser true o false, y qué modos deben quedar abiertos?
2. ¿Quién más llama a `hasSharedMaterial` / `resolveModeEntryState` asumiendo que “sin markdown ⇒ upload_required”, y qué flujos (interview placeholder, rawMarkdownRef, pack) deben quedar explícitamente en la tabla de verdad?
3. Al importar, ¿debemos normalizar `modes.slow`/`cloze` al shape anidado canónico de las sesiones nativas, o seguir soportando ambos shapes en `isSliceResumable` para siempre?

### 6. Actualización sugerida para .cursorrules

1. **Pack / derived sessions:** Never equate “has study material” with non-empty `rawMarkdown` alone. Pack imports with `preparation.status === "ready"` must remain enterable for modes that only need derived slices (rsvp/questions/recall).
2. **Source-bearing modes:** Slow and Cloze require a source document. For `originalFormat === "pack"` without source artifacts, gate them in `isModeAvailableForSession` and `resolveModeEntryState` — do not leave radios visible but broken.
3. **Copyright-safe publish tests:** Any change to `stripSourceBearingFields` / `finalizePack(..., false)` must keep the blocking asserts: absent `rawMarkdown`/`slowSlice`/`cloze`/`images`, inventory anchors stripped, recall `source_chunks` rewritten under Jaccard max, and no >15-word literal runs vs the creator’s original text.
