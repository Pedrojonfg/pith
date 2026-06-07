# Quickstart: Slow Mode — Lectura Profunda

**Feature**: `20260528-slow-mode`  
**Prereqs**: API key DeepSeek (o Gemini); archivo `pdf`/`md`/`txt` argumentativo (ensayo filosófico corto ~10–30 páginas ideal para primera prueba).

## 1. Selector de modo (SC-001)

1. Abrir app → pantalla crear sesión.
2. **Expect**: RSVP y Slow visibles; **ninguno** preseleccionado.
3. Elegir **Slow Mode** → confirmar.
4. **Expect**: controles de bloques RSVP ocultos.

## 2. Scope + Fase 0 (SC-002)

1. Subir ensayo `.md` o `.pdf`.
2. Elegir scope (capítulo o documento completo).
3. Opcional: activar **Modo Crítico** o **Mapa rellenable**.
4. Esperar Fase 0 → **Expect**: tesis, mapa argumental, conceptos, pregunta guía.
5. Colapsar/confirmar → entrar lectura.

## 3. Lectura paginada + anotaciones (SC-002, SC-004)

1. Leer ≥3 páginas (next/swipe).
2. Seleccionar fragmento → anotación `≈` con texto propio.
3. Cambiar tamaño fuente → **Expect**: anotación sigue en margen correcto.
4. Recargar pestaña → elegir Slow → **Continuar** → **Expect**: misma página y anotaciones &lt;2s.

## 4. IA anti-spoiler (SC-003)

1. En página 2, preguntar en sidebar algo del final del documento.
2. **Expect**: IA declina revelar contenido no leído.
3. Preguntar sobre página actual → respuesta breve en overlay dismissable.

## 5. Checkpoints (SC-005)

1. Llegar al fin de una sección (heading).
2. Esperar ~10s en última página de sección.
3. **Expect**: chip checkpoint aparece; swipe dismiss → lectura continúa.
4. Repetir y responder → anotación `→` creada.

## 6. Fase 3 + depth score (SC-006, SC-007)

1. Marcar lectura completa.
2. Abrir módulos: revisión argumental, preguntas retrieval.
3. **Expect**: depth score visible; hallazgos silenciosos revelados.
4. Convertir anotación `≈` a flashcard.

## 7. Sesiones por modo (SC-001)

1. Tener sesión Slow a medias.
2. Volver a inicio → elegir **RSVP** → nueva sesión RSVP.
3. Volver a inicio → elegir **Slow** → **Continuar**.
4. **Expect**: sesión Slow intacta; RSVP no borrada al alternar.

## 8. Map-reduce Fase 0 (scope largo)

1. Subir texto ≥60k caracteres (o scope grande).
2. **Expect**: progreso "Fase 0: sección X/Y"; mapa coherente al final.

## 9. Regresión RSVP

1. Crear sesión RSVP estándar → generar bloques → estudiar bloque 1.
2. **Expect**: flujo prefetch/transición sin cambios.

## 10. Export

1. Tras Fase 3, exportar `.md`.
2. **Expect**: sección Slow con anotaciones y phase0.

---

# Wave 2 — Gaps `slow_mode_spec.md`

Manual QA Wave 2 (T01–T13). Tests automatizados: `cursor-tests/20260528_t20-sidebar-jump.mjs`, `20260528_t21-phase3-diff.mjs`.

## 11. Sidebar anotaciones (T01)

1. Crear ≥3 anotaciones de tipos distintos (`≈`, `?`, `→`) en páginas distintas.
2. Abrir sidebar (20% derecho) o tab `#slowSidebarTab` si colapsada.
3. **Expect**: grupos `≈ Paráfrasis (n)` con contador; cada ítem excerpt ≤40 chars + `p.N` (1-based).
4. **Expect**: diccionario con términos Fase 0 + sesión; input IA y lista `ia-query`.
5. Colapsar sidebar → **Expect**: lectura limpia; tab discreta reaparece.

## 12. Tap-to-source + long-press (T02, T05)

1. Estar en página 1; crear anotación en página ≥3.
2. Tap ítem en sidebar → **Expect**: salto a página correcta; highlight `.slow-highlight-pulse` ~2s.
3. Cambiar fuente → **Expect**: marcas margen Y ancladas (o fallback proporcional).
4. Long-press anotación → editar `userText` o eliminar → **Expect**: sidebar y margen sincronizados.
5. Enlazar `⟷` desde picker → **Expect**: `graphLinks` persisten tras recarga.

## 13. IA overlay (T03)

1. Leer hasta mitad del scope; preguntar en sidebar sobre texto ya leído.
2. **Expect**: overlay breve dismissable; posición intacta al cerrar.
3. Preguntar sobre final no leído → **Expect**: anti-spoiler declina.
4. **Expect**: query guardada como `ia-query` en sidebar.

## 14. Fase 0 editable (T04)

1. Editar nodo del mapa; añadir pregunta guía propia.
2. Activar **Mapa rellenable**; rellenar blank vinculado a anotación.
3. Recargar → **Expect**: ediciones persisten.
4. Mismo material + scope, nueva sesión → **Expect**: Fase 0 colapsada (sin re-IA); primera sesión sin skip.

## 15. Checkpoint IA (T06)

1. Llegar a fin de sección con Fase 0 completa; esperar ~10s en última página.
2. **Expect**: chip con pregunta de integración argumental (`30 seg`); swipe dismiss continúa lectura.
3. Responder → **Expect**: anotación `→` creada.

## 16. Steel-man nudge (T07)

1. Modo crítico ON; confirmar `⊘` sin `⇑` previo en ±500 chars.
2. **Expect**: modal steel-man con [Pedir steel man] [Continuar].
3. **Expect**: depth score crítico con multiplicador ×1.25 en tipos `⊘ ↯ ⚠`.

## 17. Phase 3 + retrieval (T08–T10, T09)

1. Completar lectura; elegir módulos A/B/C en picker.
2. Módulo A → **Expect**: ✓/✗ por nodo con snippet de anotación real (±200 chars del anchor).
3. Módulo B → **Expect**: retrieval por tipo; abogado del diablo en `⊘`/`↯`/`⚠`.
4. Panel gamificación → **Expect**: depth score, hallazgos silenciosos, feedback accionable.

## 18. Grafo enriquecido (T11)

1. Tras Fase 3 o módulo C, abrir vista grafo.
2. **Expect**: capa lista/árbol; nodos `[Pedro:]` con enlaces `⟷`.
3. Tap nodo → **Expect**: salto a fuente (misma lógica tap-to-source).

## 19. Flashcards (T12)

1. En Fase 3, lista anotaciones `→`/`≈`/`⊘`/`↯` convertibles.
2. Tap **Convertir** → confirmación visual.
3. Review/spaced repetition → **Expect**: flashcard `source: slow_mode` con texto de anotación.

## 20. Triage §13 (T13)

1. Create screen → expandir "¿Qué modo elijo?".
2. **Expect**: matriz (filosofía/literatura → Slow; apuntes → RSVP).
3. **Expect**: heurística "¿POR QUÉ cree el autor (Slow) o QUÉ cree (RSVP)?"
4. **Expect**: diagrama bibliografía → RSVP → Slow → RSVP revisión.
