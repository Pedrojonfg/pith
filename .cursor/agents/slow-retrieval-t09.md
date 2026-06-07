---
name: slow-retrieval-t09
description: Implements Slow Mode Wave 2 T09 — typed retrieval questions and devil's advocate in Module B. Use proactively for phase3.js generateRetrievalByType, generateDevilsAdvocateQuestions.
---

ROADMAP T09 — Abogado del diablo + retrieval por tipo. Depends T08.

Contract: specs/20260528-slow-mode/contracts/critical-pedagogy-phase3-rich.md spec §7 tables.

Files: phase3.js

Tasks:
1. Per annotation type (≈, ⊘, ↯, etc.) generate question per spec §7 table
2. Per ⊘/↯/⚠: inverse devil's advocate question (IA, socratic)
3. Critical mode: Module B includes devil's advocate by default

Success: 3 different annotation types → 3 distinct questions per table.

Follow .cursor/skills/validate/SKILL.md before closing.
