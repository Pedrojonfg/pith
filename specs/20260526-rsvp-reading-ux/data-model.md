# Data Model: RSVP Reading UX

**Feature**: `20260526-rsvp-reading-ux`

## Entities

### RsvpTypographyProfile (runtime, module scope)

Período de validez: desde `startRsvpForText` / cambio WPF / resize contenedor hasta `finishRsvp` o nuevo perfil.

| Field | Type | Description |
|-------|------|-------------|
| `fontSizePx` | `number` | Tamaño en px aplicado a todos los flashes de texto |
| `mathScale` | `number` | Factor sobre `fontSizePx` para chunks math (default `0.85`) |
| `containerWidth` | `number` | Último ancho usado en el cálculo |
| `containerHeight` | `number` | Último alto usado en el cálculo |
| `wordsPerFlash` | `number` | WPF al calcular |
| `computedAt` | `number` | `Date.now()` para debug |

**Validation**: `fontSizePx >= 16` (mínimo legible). Si binary-search falla, fallback `32`.

**Lifecycle**:
```
overlay open → computeProfile() → [flash loop uses profile.fontSizePx]
resize end → computeProfile() → flashes unchanged except new px
wpf change mid-session → rebuild chunks → computeProfile()
finishRsvp → profile cleared
```

### RsvpTextFlash (derived per chunk, not persisted)

| Field | Type | Description |
|-------|------|-------------|
| `content` | `string` | Texto del chunk (palabras + espacios) |
| `words` | `string[]` | Tokens whitespace-preserving |
| `anchorWordIndex` | `number` | Índice palabra ancla |
| `orpLocalIndex` | `number` | Índice ORP dentro de palabra ancla |
| `centerOffsetPx` | `number` | translateX aplicado post-layout |

### RsvpChunk (existing, unchanged)

```ts
{ type: "text" | "math", content: string, preRenderedHtml?: string }
```

## Storage (localStorage)

Sin cambios de schema. Claves existentes:

| Key | Relation |
|-----|----------|
| `rsvp_default_wpm` | Sin cambio |
| `rsvp_default_wpf` | Dispara recálculo de perfil al cambiar |
| `rsvp_container_size` | Resize dispara `computeProfile()` |

## State transitions (rsvpState)

```
playing + displayedChunkIndex
  → applyChunkToDom(meta)
      → text: renderRSVPChunk + applySessionFontSize + centerOrp()
      → math: applyMathFontSize + center content (no ORP)
```

## Invariants

1. `fontSizePx` constante entre `applyChunkToDom` calls si `containerWidth/Height` y `wordsPerFlash` no cambian.
2. ORP highlight existe como máximo en un carácter por flash de texto.
3. `centerOffsetPx` recalculado cada flash (depende del ancho del chunk), pero `fontSizePx` no.
