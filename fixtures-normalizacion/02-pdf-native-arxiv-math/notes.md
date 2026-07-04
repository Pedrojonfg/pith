# Fixture 02: pdf-native-arxiv-math

**Source:** "Denoising Diffusion Probabilistic Models" (Ho, Jain, Abbeel, 2020), arXiv:2006.11239v2, fetched directly from https://arxiv.org/pdf/2006.11239 (~10 MB, 25 pages).

**Why this fixture exists:** A second native-PDF data point, chosen specifically because several of its section headings contain embedded mathematical notation (e.g. "3.1 Forward process and L_T"). This directly stresses the boundary between heading detection and math detection — a naive implementation of either could misfire on the other.

**Inspection method:** `pdftotext -layout` + `pdfinfo` run directly. Section list, table captions, and appendix structure verified via grep on the extracted text.

**Known risk areas for Pith:**
- Headings containing math notation (subscripted L_T, L_1:T-1, L_0) — verify these are still detected as headings, not stripped or misclassified as equations.
- Appendices use letter-numbering (A, B, C, D) rather than digit-numbering — a heading-numbering heuristic hardcoded to `\d+(\.\d+)*` patterns will miss these entirely.
- Table 4's exact dimensions were not independently re-verified beyond its caption text (flagged `confidence: low` in rubric.json) — a human should open the PDF at ~page 15 and confirm row/column count before treating this as ground truth.
- 25 pages, two-column layout, same interleaving risk as fixture 01.

**Confidence:** High overall; one specific low-confidence item (Table 4 exact dimensions) flagged in rubric.json. This fixture is not one of the two named weak-spot categories, so `needs_human_review` is false at the fixture level, but the Table 4 entry should still be spot-checked.
