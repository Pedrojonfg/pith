# Contract: Orphan annotation consumers

## Pre-fix audit (R5.1)

| Consumer | Checks orphaned? | Position-sensitive? | Action |
|----------|------------------|---------------------|--------|
| Reader highlight overlays | Yes | Yes | Keep |
| PDF annotation overlays | Yes | Yes | Keep |
| Sidebar list | Surfaces orphan UX | Jump uses position | Keep list; fix navigate |
| `navigateToAnnotation` | No | Yes | **Patch** — no-op / orphan UX |
| Phase 3 Module A proximity | No | Yes | **Patch** — exclude |
| Devil’s advocate / context slice | No | Yes | **Patch** — exclude |
| Flashcards / Module C text / gamification depth | No | No (text/type) | **Do not skip** |
| Graph proximity linking | No | Yes | **Patch** — exclude from position link |
| Export | No | Labels may use legacy ranges | Optional later; text include OK |

## Rule

`if (annotation.orphaned)` skip **only** when resolving or comparing **position**. Never blanket-filter `session.slow.annotations` at the store layer.
