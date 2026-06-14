# Deep Dive: Exposure / Retrieval Hub

**Feature**: `20260622-exposure-retrieval-hub` | **Date**: 2026-06-14

---

## 1. Qué construimos

Formalizamos la taxonomía **exposure vs retrieval** y añadimos `screenRetrievalHub` como punto neutro de decisión tras leer un documento (RSVP/Slow) o al pulsar "Practice this document". El hub ofrece Questions, Cloze y Recall sin badges de recomendación; cada opción delega en `enterModeWithContinuity` existente. **Review** deja de ser per-documento en el mode select y pasa a ser **vault-level**: cola SM-2 agregada con `getSmItemsDueToday()` sin `docId`, con escritura por `item.docId` origen. Questions prioriza bloques débiles vía `prioritizeByAssessmentSignals` cuando hay `shared.assessmentSignals`.

---

## 2. Decisiones de diseño

### Hub como navegación pura, no orquestador de modos

- **Elegido**: `enterRetrievalHub` renderiza cards desde `getDocumentRetrievalModes()` y los clicks llaman `enterModeWithContinuity(mode)`.
- **Alternativa descartada**: lógica de bootstrap/generate duplicada en el hub — violaría mode-continuity y duplicaría `mode-bootstrap.js`.
- **Trade-off**: el hub no puede personalizar flujos por modo; cualquier cambio de entrada sigue viviendo en bootstrap/resume paths.

### Taxonomía en módulo puro (`mode-taxonomy.js`)

- **Elegido**: `MODE_TAXONOMY` estático + `getDocumentRetrievalModes()` con orden explícito `questions → cloze → recall`.
- **Alternativa descartada**: hardcodear tres botones en HTML — rompe extensibilidad (FR-002) y duplica labels.
- **Trade-off**: añadir un cuarto modo document-scoped requiere tocar constante de orden y taxonomía; no hay plugin registry.

### Review vault con flag `sm2ReviewDocId === ''`

- **Elegido**: `runVaultSm2ReviewSession()` deja `sm2ReviewDocId` vacío; `handleSm2QualityClick` usa `sm2ReviewDocId || item.docId`.
- **Alternativa descartada**: `setActiveSession(originDocId)` en cada rating — corrompería el doc activo del usuario.
- **Trade-off**: `runSm2ReviewSession(docId)` per-doc sigue existiendo pero ya no se expone en UI; dos code paths en `review.js`.

### Questions block order en `state.questionsStudyOrder` (transient)

- **Elegido**: calcular orden al `startStudyingNow`, guardar en `state`, usar en `finishQuestions` vía `resolveNextStudyBlockForSession`.
- **Alternativa descartada**: persistir `studyOrder` en slice Questions como Cloze — más migración, YAGNI para v1.
- **Trade-off**: reanudar mid-session no re-aplica priorización; solo cold start desde bloque 0.

### Strip `modes.review` en `normalizeSessionModes` (session-store)

- **Elegido**: borrar clave `review` al cargar sesión; `stripLegacyReviewSlot` exportado en `session-migration.js` para tests.
- **Alternativa descartada**: `schemaVersion` bump — innecesario si el slot se ignora y `smItems` viven en `shared`.
- **Trade-off**: config legacy en `modes.review` se pierde silenciosamente (aceptable: Review ya no es per-doc).

### Post-exposure → hub vía CTA explícito (no auto-redirect)

- **Elegido**: Slow phase 3 → `enterRetrievalHub` directo; RSVP complete → botón "Practice retrieval".
- **Alternativa descartada**: reemplazar `screenComplete` por hub automático — rompe "Save session" y review LLM del complete screen.
- **Trade-off**: el usuario puede quedarse en complete sin ir al hub; spec quickstart asume click en CTA.

---

## 3. Conceptos aplicados

| Concepto | Qué es | Dónde en nuestro código |
|----------|--------|-------------------------|
| **Pure module / no I/O** | Funciones sin DOM ni storage | `mode-taxonomy.js` — solo datos y filtros |
| **Delegation pattern** | UI delega lógica a subsistema existente | `onRetrievalHubPick` → `enterModeWithContinuity` |
| **Facade / entry point** | API única para entrar al hub | `enterRetrievalHub({ docId, entrySource })` en `study.js` |
| **Cross-cutting aggregation** | Query sin filtro de scope | `getSmItemsDueToday()` sin `docId` en `runVaultSm2ReviewSession` |
| **Origin-aware write** | Persistir en el documento fuente del dato | `upsertSmItem(originDocId, updated)` en vault review |
| **Stable sort / explicit ordering** | Orden no dependiente de key order de objeto | `DOCUMENT_RETRIEVAL_ORDER` en `mode-taxonomy.js` |
| **Greedy prioritization** | Reordenar por peso de señales débiles | `prioritizeByAssessmentSignals` + proxies por bloque en `buildQuestionsStudyOrder` |
| **Session normalization pipeline** | Transform al load | `normalizeLoadedSession` → strip `modes.review` |
| **Transient UI context** | Estado no persistido | `retrievalHubContext` en `study.js` |
| **Event delegation** | Un listener en contenedor padre | `retrievalHubOptions` click → `[data-retrieval-mode]` |

---

## 4. Deuda técnica y mejoras

**Bien hecho**
- Taxonomía desacoplada y testeable.
- Hub no duplica bootstrap; Cloze/Recall/Questions siguen un solo camino.
- Vault review no toca `activeSession` al puntuar.
- Tests de agregación cross-doc y migración legacy.

**Chapuza funcional**
- `state.questionsStudyOrder` no persistido: resume mid-session ignora priorización.
- `refreshReviewBadge` eliminado pero SM-2 test ahora hace string-matching en `study.js` (contrato frágil).
- `enterRetrievalHub` sin material muestra hub vacío con mensaje en lead, no redirige a upload con formulario claro.
- Duplicación strip review: `stripLegacyReviewSlot` en migration + lógica inline en `normalizeSessionModes`.

**No escalaría**
- Render HTML de hub options como template strings en `study.js` — XSS risk bajo (datos propios) pero no hay component layer.
- `getSmItemsDueToday()` O(n docs × m items) en cada badge refresh sin cache.
- Sin tests E2E de `enterRetrievalHub` / `showScreen('retrievalHub')` — solo unit + source contracts.
- Mid-block RSVP → hub: solo nota manual en tests, sin assertion automatizable sin DOM harness.

---

## 5. Preguntas de consolidación

1. **¿Por qué `runVaultSm2ReviewSession` deja `sm2ReviewDocId` vacío en lugar de usar un flag explícito `vaultMode: true`, y qué bug aparecería si un item de la cola no tuviera `docId`?**

2. **¿Cómo interactúan `buildQuestionsStudyOrder`, `resolveNextStudyBlockForSession` y `isLastQuestionsStudyBlock` cuando el último bloque en el orden priorizado no es `n_blocks - 1` (p.ej. Key terms skipped)?**

3. **Si mañana añades un cuarto modo retrieval document-scoped, ¿qué archivos debes tocar como mínimo y por qué `MODE_KEYS` en `session-types.js` no es la misma lista que `getDocumentRetrievalModes()`?**

---

## 6. Actualización sugerida para .cursorrules

```markdown
## Exposure / Retrieval Hub
- Document retrieval entry is `screenRetrievalHub` via `enterRetrievalHub`; hub options MUST come from `getDocumentRetrievalModes()`, never hardcoded in HTML.
- `review` is vault-scoped only: UI entry on `screenDocLibrary` (`btnVaultReview`); do not re-add per-doc Review on mode select.
- Vault SM-2 ratings MUST call `upsertSmItem(item.docId, ...)` without switching `setActiveSession` to the origin doc.
- Post-exposure navigation (Slow phase 3 finish, RSVP complete CTA) goes to hub; do not redirect mid-block RSVP test/socratic flows.
```
