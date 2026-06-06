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
