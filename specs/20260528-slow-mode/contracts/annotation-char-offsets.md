# Contract: Annotations (Character Offsets)

**Feature**: `20260528-slow-mode` | **FR**: FR-004, FR-013

## Selection → annotation flow

1. Usuario selecciona texto en página actual.
2. Resolver offsets scope: `charStart`, `charEnd` vía `Range` → texto plano del scope (normalizar whitespace colapsado igual que almacenamiento).
3. Micro-menú una línea: tipos visibles según `criticalMode` (ver `ANNOTATION_TYPES`).
4. Campo texto mínimo; confirmar → push a `slow.annotations[]`.
5. Marca en margen derecho (punto color por tipo); **no** inline en texto.

## Type registry

| Symbol | tier | criticalMenu |
|--------|------|--------------|
| ≈ ? → ⟷ ⚑ | primary | always |
| ⊘ ↯ ⚠ ★ ⇑ | critical | criticalMode |
| 📌 ⚡ ↩ 🔗 | secondary | `···` expand |

## Persistence

- Offsets en coordenadas scope; no guardar `pageIndex`.
- Re-render: `charOffsetToPage` + highlight range en página visible.
- Long-press marca propia → editar tipo/texto.

## IA hooks

- `⚑` → ofrecer explicación contextual (ver phase1-reader-ia).
- `⇑` → steel man prompt.
