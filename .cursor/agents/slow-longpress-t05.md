---
name: slow-longpress-t05
description: Implements Slow Mode Wave 2 T05 — long-press edit/delete annotations and ⟷ graph links. Use proactively for reader.js gestures, sidebar.js concept picker, annotations.js graphLinks.
---

ROADMAP T05 — Long-press editar + enlace ⟷ grafo. Depends T01+T02.

Files: reader.js, annotations.js, sidebar.js, dictionary.js

Tasks:
1. Long-press own mark (500ms) → menu edit type / edit text / delete
2. Long-press word → dictionary popup or contextual IA (reuse T03)
3. Type ⟷: after text confirm, concept picker → graphLinks.push({ termId, relation })
4. Type 🔗: URL/literature note input

Success: Long-press opens editor; ⟷ creates persisted graphLinks.

Follow .cursor/skills/validate/SKILL.md before closing.
