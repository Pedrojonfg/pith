# Research: RSVP Reading UX

**Feature**: `20260526-rsvp-reading-ux` | **Date**: 2026-05-26

## R1 — Por qué falla el punto focal actual

**Decision**: El ORP se aplica sobre el **string completo del chunk** (`getORP(raw)` donde `raw` = "era jerárquico: defendía una"), no sobre una palabra ancla.

**Rationale**: Con `wordsPerFlash > 1`, `getORP` usa la longitud alfabética total del chunk (>13 → índice 4). El carácter resaltado es `raw[4]` = `'j'` en "jerárquico", pero el bloque entero está **centrado con flex** sin compensar offset → la mirada debe ir a la izquierda del centro del cuadro. Esto contradice el patrón RSVP/Spritz: la letra óptima debe coincidir con el **punto de fijación central**.

**Alternatives considered**:
| Opción | Descartada porque |
|--------|-------------------|
| Quitar ORP en multi-palabra | Pierde beneficio de fijación en WPF alto |
| Resaltar primera palabra | No coincide con literatura ORP (palabra media del grupo) |
| Más letras rojas (una por palabra) | Saturación visual a 1000 WPM |

## R2 — Centrado óptico del ORP

**Decision**: Tras renderizar, medir `orp.getBoundingClientRect()` vs centro del contenedor y aplicar `transform: translateX(delta)` al `#rsvp-word-display`. Resetear transform en cada flash.

**Rationale**: CSS `justify-content: center` centra la **caja del texto**, no el glifo ORP. La compensación por medición es el patrón estándar en lectores RSVP comerciales (Spritz, Blinkist prototypes). Coste: una lectura de layout por flash (aceptable < 5ms).

**Alternatives considered**:
| Opción | Descartada porque |
|--------|-------------------|
| Tabla de anchos por carácter | Frágil con fuentes variables y español |
| `text-align` por segmentos | No alinea un glifo al 50% del contenedor |
| Posicionamiento absoluto del ORP | Rompe espaciado entre palabras |

## R3 — Palabra ancla en chunks multi-palabra

**Decision**: `anchorIndex = Math.floor((words.length - 1) / 2)`; ORP solo en esa palabra; resto de palabras en color normal.

**Rationale**: Con 4 palabras, la fijación natural cae en la 2ª–3ª; índice `floor((n-1)/2)` da la central (0-based: palabra 1 o 2 según paridad). Alineado con guías Spritz para "group displays".

## R4 — Tamaño de fuente constante por sesión

**Decision**: Calcular `fontSizePx` **una vez** al abrir RSVP / cambiar WPF / resize del contenedor, usando **cadena probe** = `wordsPerFlash` repeticiones de una palabra ancha fija (`"internacionalización "` o fallback `"caracterización "` si probe no cabe).

**Rationale**: El binary-search actual (`calcRSVPFontSize`) corre en **cada flash** con distinto `scrollWidth` → flashes cortos → fuente grande; flashes largos → pequeña. Eso explica la queja "within block". El peor caso lo define WPF y el ancho del contenedor, no el chunk actual.

**Alternatives considered**:
| Opción | Descartada porque |
|--------|-------------------|
| Slider manual de fuente | Más UI; no pedido |
| Media del bloque | Sigue variando si hay outlier tardío |
| `clamp` solo max | No fija mínimo consistente entre flashes cortos/largos |

**Probe refinement (opcional WP2)**: Escanear `sourceExplanation` del bloque una vez y usar la palabra más larga × WPF como probe — mejora LaTeX/símbolos sin romper constancia intra-sesión.

## R5 — ORP y caracteres españoles

**Decision**: v1 mantiene `getORP` basado en `/[a-zA-Z]/` (como hoy); documentar limitación: tildes no cuentan para longitud ORP.

**Rationale**: Cambiar a `\p{L}` requiere verificar Unicode en todos los navegadores objetivo; mejora separable. El bug principal reportado es **centrado**, no la tabla ORP.

**Alternatives considered**: `\p{L}` en `getORP` — pospuesto a v1.1 si quickstart muestra desalineación en palabras acentuadas.

## R6 — Chunks matemáticos

**Decision**: `fontSizePx * 0.85` fijo; sin ORP; centrado del contenedor MathJax sin translate ORP.

**Rationale**: Ya existía `0.6 * lastCalculatedNormalFontSize` atado al último flash de texto — inconsistente. Factor fijo sobre perfil de sesión.

## R7 — Archivos a tocar

**Decision**: `src/js/rsvp.js` (lógica), `src/css/main.css` (`.rsvp-word-display` transform, opcional `will-change`), `tests/rsvp-latex.html` o snippet de diagnóstico si aplica.

**Rationale**: Alineado con `.cursorrules` — RSVP es módulo aislado; cero impacto en session/LLM.
