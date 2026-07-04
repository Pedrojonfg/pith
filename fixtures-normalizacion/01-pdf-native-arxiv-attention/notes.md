# Fixture 01: pdf-native-arxiv-attention

**Source:** "Attention Is All You Need" (Vaswani et al., 2017), arXiv:1706.03762v7, fetched directly from https://arxiv.org/pdf/1706.03762 (2.16 MB, 15 pages).

**Why this fixture exists:** Baseline "clean" native-PDF case — LaTeX/pdfTeX-produced, two-column, fully numbered semantic sections, standard bordered tables, heavy inline math. Used as a control to confirm the pipeline handles the easy case before stress-testing the harder PDF variants (scanned OCR, Word-exported, Google-Docs-exported, split-table).

**Inspection method:** `pdftotext -layout` + `pdfinfo` run directly on the PDF (not through Pith). Verified section numbering via grep for numbered heading patterns, verified table locations via grep for "Table N" captions, verified page/producer metadata.

**Known risk areas for Pith:**
- Two-column layout: text-extraction must be column-aware or paragraphs will interleave incorrectly.
- No structural heading tags exist in a PDF; heading detection here relies entirely on font-size/boldness + numbering-pattern heuristics. Since this arXiv paper is clean and consistent, this should be the "easy" case.
- Table 3 (architecture variation grid, section 6.2) is wide (9 columns) and may wrap or visually fragment when converted from a two-column PDF layout — worth checking Pith doesn't split it into two separate tables.
- Math is dense and uses genuine LaTeX-typeset equations (not images) — good test of whether math-detection fires on the equation blocks in section 3 without also false-triggering on the numbered-heading digits (e.g., mistaking "3.2" for an equation).

**Confidence:** High across the board — this document was inspected directly and its structure is unambiguous. No `needs_human_review` flags on this fixture (it is not one of the two named weak-spot categories).
